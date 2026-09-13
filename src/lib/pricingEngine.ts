import { RoomType, Plan } from "@/data/hotel";
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
  impact: number; // additive multiplier contribution, e.g. +0.08 = +8%
  detail: string;
};

export type PriceRecommendation = {
  date: string;
  roomTypeId: string;
  planId: string;
  basePrice: number;
  recommendedPrice: number;
  totalMultiplier: number;
  occupancyForecast: number; // 0-1
  factors: PriceFactor[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function recommendPrice(date: Date, room: RoomType, plan: Plan): PriceRecommendation {
  const competitor = getCompetitorSignal(date, room.basePrice);
  const event = getEventSignal(date);
  const weather = getWeatherSignal(date);
  const economy = getEconomicSignal(date);
  const area = getAreaSignal(date);
  const season = getSeasonSignal(date);

  const daysOut = Math.max(
    0,
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const leadTimeImpact = daysOut <= 3 ? 0.08 : daysOut <= 10 ? 0.02 : daysOut >= 60 ? -0.04 : 0;

  const competitorImpact = Number((competitor.demandIndex - 1).toFixed(3));
  const areaImpact = Number(((area.nearbyOccupancyIndex - 0.6) * 0.3 + (area.searchDemandIndex - 1) * 0.1).toFixed(3));
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
    {
      key: "leadtime",
      label: "予約リードタイム",
      impact: leadTimeImpact,
      detail: `宿泊日まで${daysOut}日`,
    },
  ];

  const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0);
  const totalMultiplier = Number((1 + totalImpact).toFixed(3));

  const dynamicRoomPrice = clamp(room.basePrice * totalMultiplier, room.minPrice, room.maxPrice);
  const recommendedPrice = Math.round((dynamicRoomPrice * plan.priceMultiplier) / 100) * 100;

  const occupancyForecast = clamp(
    0.55 + season.seasonalityMultiplier - 1 + event.demandBoost * 0.6 + (area.nearbyOccupancyIndex - 0.6) * 0.5,
    0.15,
    0.99
  );

  return {
    date: date.toISOString().slice(0, 10),
    roomTypeId: room.id,
    planId: plan.id,
    basePrice: room.basePrice,
    recommendedPrice,
    totalMultiplier,
    occupancyForecast: Number(occupancyForecast.toFixed(2)),
    factors,
  };
}
