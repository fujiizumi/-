import { PLANS, ROOM_TYPES, RoomType, Plan, TOTAL_ROOMS } from "@/data/hotel";
import {
  getAreaSignal,
  getCompetitorSignal,
  getEconomicSignal,
  getEventSignal,
  getSeasonSignal,
  getWeatherSignal,
} from "./signals";

export type PriceFactor = {
  key: string;
  label: string;
  /** Contribution to expected demand/occupancy at the reference price, e.g. +0.08 = +8pt. */
  impact: number;
  detail: string;
};

export type PriceCandidate = {
  price: number;
  occupancy: number;
  revPar: number;
};

export type PriceRecommendation = {
  date: string;
  roomTypeId: string;
  planId: string;
  /** Room-only reference (rack) price used as the elasticity anchor. */
  basePrice: number;
  /** Optimized best-available-rate for the room type, before the plan multiplier. */
  optimalRoomPrice: number;
  /** Final price shown to the guest for this room type + plan. */
  recommendedPrice: number;
  occupancyForecast: number; // 0-1, at the optimal room price
  revPar: number; // optimalRoomPrice * occupancyForecast
  referencePrice: number; // = basePrice, kept for clarity in API responses
  referenceOccupancy: number; // occupancy if sold at the reference price
  referenceRevPar: number;
  revParUplift: number; // (revPar / referenceRevPar - 1)
  demandIndex: number; // multiplier on baseline occupancy from external signals
  priceSensitivity: number; // elasticity coefficient used for this date
  factors: PriceFactor[];
  candidateCurve: PriceCandidate[]; // sampled price/occupancy/revPar curve for transparency
  rationale: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Portfolio-average target occupancy at the reference price, before any signal adjustment. */
const BASELINE_OCCUPANCY = 0.6;

/**
 * Demand-curve model: occupancy decays exponentially as price rises above the
 * reference price and grows as it falls below it, scaled by how much extra
 * demand today's signals imply (demandIndex) and how price-sensitive guests
 * are expected to be today (priceSensitivity).
 */
function occupancyAtPrice(
  price: number,
  referencePrice: number,
  occupancyAtReference: number,
  priceSensitivity: number
): number {
  const relativeGap = (price - referencePrice) / referencePrice;
  return clamp(occupancyAtReference * Math.exp(-priceSensitivity * relativeGap), 0.03, 0.98);
}

/** Grid-search the price that maximizes RevPAR (price x occupancy) within the allowed band. */
function optimizeForRevPar(
  referencePrice: number,
  occupancyAtReference: number,
  priceSensitivity: number,
  minPrice: number,
  maxPrice: number
): { best: PriceCandidate; curve: PriceCandidate[] } {
  const steps = 48;
  const curve: PriceCandidate[] = [];
  let best: PriceCandidate | null = null;
  for (let i = 0; i <= steps; i++) {
    const price = Math.round(minPrice + ((maxPrice - minPrice) * i) / steps);
    const occupancy = occupancyAtPrice(price, referencePrice, occupancyAtReference, priceSensitivity);
    const revPar = Number((price * occupancy).toFixed(1));
    const candidate = { price, occupancy: Number(occupancy.toFixed(3)), revPar };
    curve.push(candidate);
    if (!best || candidate.revPar > best.revPar) best = candidate;
  }
  return { best: best as PriceCandidate, curve };
}

function buildRationale(params: {
  roomName: string;
  planName: string;
  factors: PriceFactor[];
  occupancy: number;
  referenceOccupancy: number;
  price: number;
  referencePrice: number;
  revPar: number;
  referenceRevPar: number;
  revParUplift: number;
  priceSensitivity: number;
  daysOut: number;
}): string {
  const {
    roomName,
    planName,
    factors,
    occupancy,
    price,
    referencePrice,
    revPar,
    referenceRevPar,
    revParUplift,
    priceSensitivity,
    daysOut,
  } = params;

  const ranked = [...factors].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const drivers = ranked
    .filter((f) => Math.abs(f.impact) >= 0.02)
    .slice(0, 3)
    .map((f) => `${f.label}（${f.detail}）`);

  const driverText =
    drivers.length > 0
      ? `${drivers.join("、")}により、基準需要より${ranked[0].impact >= 0 ? "強い" : "弱い"}需要を予測。`
      : "特筆すべき変動要因はなく、平常時の需要を想定。";

  const sensitivityText =
    priceSensitivity <= 1.1
      ? "宿泊日直前または高需要日で価格への抵抗感が小さいと判断し、"
      : priceSensitivity >= 1.9
      ? "予約期間に余裕がありレジャー客中心で価格に敏感な時期と判断し、"
      : "";

  const direction = price >= referencePrice ? "引き上げても" : "引き下げることで";
  const uplift = (revParUplift * 100).toFixed(1);

  return (
    `${roomName}（${planName}）: ${driverText}${sensitivityText}` +
    `基準価格¥${referencePrice.toLocaleString()}を¥${price.toLocaleString()}まで${direction}` +
    `稼働率${(occupancy * 100).toFixed(0)}%を確保できると予測。` +
    `このときのRevPARは¥${revPar.toLocaleString()}で、基準価格のままの場合（RevPAR¥${referenceRevPar.toLocaleString()}）` +
    `と比べて${revParUplift >= 0 ? "+" : ""}${uplift}%高く、宿泊日まで${daysOut}日の時点で試算した価格帯の中で` +
    `RevPARが最大となるためこの価格を推奨します。`
  );
}

export function recommendPrice(date: Date, room: RoomType, plan: Plan): PriceRecommendation {
  const competitor = getCompetitorSignal(date, room.basePrice);
  const event = getEventSignal(date);
  const weather = getWeatherSignal(date);
  const economy = getEconomicSignal(date);
  const area = getAreaSignal(date);
  const season = getSeasonSignal(date);

  const daysOut = Math.max(0, Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const competitorImpact = Number((competitor.demandIndex - 1).toFixed(3));
  const areaImpact = Number(
    ((area.nearbyOccupancyIndex - 0.6) * 0.3 + (area.searchDemandIndex - 1) * 0.1).toFixed(3)
  );
  const seasonImpact = Number((season.seasonalityMultiplier - 1).toFixed(3));

  const factors: PriceFactor[] = [
    {
      key: "season",
      label: "季節・曜日・祝日",
      impact: seasonImpact,
      detail: `${season.season} / ${season.isWeekend ? "週末" : "平日"}${season.isHoliday ? " / 祝日" : ""}`,
    },
    {
      key: "competitor",
      label: "競合ホテル価格動向",
      impact: competitorImpact,
      detail: `周辺${competitor.sampleSize}軒平均 ¥${competitor.averagePrice.toLocaleString()}（¥${competitor.cheapestPrice.toLocaleString()}〜¥${competitor.mostExpensivePrice.toLocaleString()}）`,
    },
    {
      key: "event",
      label: "近隣イベント",
      impact: event.demandBoost,
      detail:
        event.events.length > 0
          ? event.events.map((e) => `${e.name}（想定${e.expectedAttendance.toLocaleString()}人）`).join(" / ")
          : "大規模イベントなし",
    },
    {
      key: "weather",
      label: "天候予測",
      impact: weather.demandImpact,
      detail: `${weather.condition} / 最高気温${weather.highTempC}℃`,
    },
    {
      key: "economy",
      label: "景気・為替（インバウンド需要）",
      impact: economy.inboundDemandImpact,
      detail: `為替 ${economy.exchangeRateJpyPerUsd}円/USD / 消費者信頼感指数 ${economy.consumerConfidenceIndex}`,
    },
    {
      key: "area",
      label: "近隣地域の稼働・検索需要",
      impact: areaImpact,
      detail: `周辺稼働率 ${(area.nearbyOccupancyIndex * 100).toFixed(0)}% / 検索需要指数 ${area.searchDemandIndex.toFixed(2)}`,
    },
  ];

  // How much extra (or less) baseline demand today carries, driven by external signals.
  const demandIndex = Number((1 + factors.reduce((sum, f) => sum + f.impact, 0)).toFixed(3));
  const occupancyAtReference = clamp(BASELINE_OCCUPANCY * demandIndex, 0.05, 0.97);

  // Price sensitivity (demand elasticity): lower = guests tolerate higher prices.
  // High-demand days (events, weekends, holidays, last-minute urgency) make demand
  // less elastic; long lead times (leisure planners comparison-shopping) make it more elastic.
  let priceSensitivity =
    1.6 -
    event.demandBoost * 0.9 -
    (season.isWeekend ? 0.15 : 0) -
    (season.isHoliday ? 0.2 : 0) -
    (daysOut <= 3 ? 0.35 : 0) +
    (daysOut >= 45 ? 0.3 : 0);
  priceSensitivity = clamp(priceSensitivity, 0.5, 2.2);

  const { best, curve } = optimizeForRevPar(
    room.basePrice,
    occupancyAtReference,
    priceSensitivity,
    room.minPrice,
    room.maxPrice
  );

  const optimalRoomPrice = Math.round(best.price / 100) * 100;
  const occupancyForecast = occupancyAtPrice(optimalRoomPrice, room.basePrice, occupancyAtReference, priceSensitivity);
  const revPar = Number((optimalRoomPrice * occupancyForecast).toFixed(1));

  const referenceOccupancy = occupancyAtReference;
  const referenceRevPar = Number((room.basePrice * referenceOccupancy).toFixed(1));
  const revParUplift = referenceRevPar > 0 ? Number((revPar / referenceRevPar - 1).toFixed(4)) : 0;

  const recommendedPrice = Math.round((optimalRoomPrice * plan.priceMultiplier) / 100) * 100;

  const rationale = buildRationale({
    roomName: room.name,
    planName: plan.name,
    factors,
    occupancy: occupancyForecast,
    referenceOccupancy,
    price: optimalRoomPrice,
    referencePrice: room.basePrice,
    revPar,
    referenceRevPar,
    revParUplift,
    priceSensitivity,
    daysOut,
  });

  return {
    date: date.toISOString().slice(0, 10),
    roomTypeId: room.id,
    planId: plan.id,
    basePrice: room.basePrice,
    optimalRoomPrice,
    recommendedPrice,
    occupancyForecast: Number(occupancyForecast.toFixed(3)),
    revPar,
    referencePrice: room.basePrice,
    referenceOccupancy: Number(referenceOccupancy.toFixed(3)),
    referenceRevPar,
    revParUplift,
    demandIndex,
    priceSensitivity: Number(priceSensitivity.toFixed(2)),
    factors,
    candidateCurve: curve,
    rationale,
  };
}

export type PortfolioDay = {
  date: string;
  totalRooms: number;
  expectedRoomsSold: number;
  occupancyForecast: number; // hotel-wide, weighted by room count
  revPar: number; // hotel-wide, weighted by room count
  roomRevenue: number; // revPar * totalRooms
  referenceRevPar: number;
  revParUplift: number;
};

/**
 * Hotel-wide RevPAR for a given date: each room type is priced at its own
 * RevPAR-optimal Best Available Rate (room-only plan), then results are
 * weighted by each room type's inventory share of the 94 total rooms.
 */
export function recommendPortfolioForDate(date: Date): PortfolioDay {
  const baseplan = PLANS.find((p) => p.id === "room-only") ?? PLANS[0];
  const perRoomType = ROOM_TYPES.map((room) => recommendPrice(date, room, baseplan));

  const roomRevenue = perRoomType.reduce((sum, r, i) => sum + r.revPar * ROOM_TYPES[i].totalRooms, 0);
  const expectedRoomsSold = perRoomType.reduce(
    (sum, r, i) => sum + r.occupancyForecast * ROOM_TYPES[i].totalRooms,
    0
  );
  const referenceRevenue = perRoomType.reduce(
    (sum, r, i) => sum + r.referenceRevPar * ROOM_TYPES[i].totalRooms,
    0
  );

  const revPar = Number((roomRevenue / TOTAL_ROOMS).toFixed(1));
  const referenceRevPar = Number((referenceRevenue / TOTAL_ROOMS).toFixed(1));

  return {
    date: date.toISOString().slice(0, 10),
    totalRooms: TOTAL_ROOMS,
    expectedRoomsSold: Number(expectedRoomsSold.toFixed(1)),
    occupancyForecast: Number((expectedRoomsSold / TOTAL_ROOMS).toFixed(3)),
    revPar,
    roomRevenue: Number(roomRevenue.toFixed(0)),
    referenceRevPar,
    revParUplift: referenceRevPar > 0 ? Number((revPar / referenceRevPar - 1).toFixed(4)) : 0,
  };
}
