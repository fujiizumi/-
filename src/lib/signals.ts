import { seededRandom, pick } from "./random";

/**
 * These functions simulate the external data feeds a real deployment would
 * pull from live APIs. Each one is isolated so it can be swapped for a real
 * connector without touching the pricing engine:
 *  - Competitors: RateGain / OTA Insight / scraping OTA search pages
 *  - Events: Ticketmaster, PIA, local convention-center calendars, Google Events
 *  - Weather: Japan Meteorological Agency API, OpenWeatherMap
 *  - Economy: e-Stat (景気動向指数), exchange rate (JPY strength -> inbound demand)
 *  - Area: Google Popular Times / mobile location aggregate demand, PMS-wide occupancy
 */

export type CompetitorSignal = {
  averagePrice: number;
  cheapestPrice: number;
  mostExpensivePrice: number;
  demandIndex: number; // 0.7 - 1.3, >1 means competitors are pricing up (high demand)
  sampleSize: number;
};

export type EventSignal = {
  events: { name: string; category: string; expectedAttendance: number }[];
  demandBoost: number; // 0 - 0.6 additive multiplier boost
};

export type WeatherSignal = {
  condition: "晴れ" | "曇り" | "雨" | "雪" | "台風";
  highTempC: number;
  demandImpact: number; // -0.15 - 0.1
};

export type EconomicSignal = {
  exchangeRateJpyPerUsd: number;
  consumerConfidenceIndex: number; // 30-70
  inboundDemandImpact: number; // -0.1 - 0.15
};

export type AreaSignal = {
  nearbyOccupancyIndex: number; // 0.4 - 0.98 average occupancy of comparable hotels in area
  searchDemandIndex: number; // 0.6 - 1.4 relative search volume for the area
};

export type DayOfWeekSeasonSignal = {
  isWeekend: boolean;
  isHoliday: boolean;
  season: "春" | "夏" | "秋" | "冬";
  seasonalityMultiplier: number;
};

const JP_HOLIDAYS_2026 = new Set([
  "2026-01-01",
  "2026-01-12",
  "2026-02-11",
  "2026-02-23",
  "2026-03-20",
  "2026-04-29",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  "2026-05-06",
  "2026-07-20",
  "2026-08-11",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-10-12",
  "2026-11-03",
  "2026-11-23",
]);

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getCompetitorSignal(date: Date, roomBasePrice: number): CompetitorSignal {
  const rng = seededRandom(`competitor-${iso(date)}`);
  const demandIndex = 0.75 + rng() * 0.55; // 0.75 - 1.3
  const spread = 0.15 + rng() * 0.15;
  const averagePrice = Math.round(roomBasePrice * demandIndex);
  return {
    averagePrice,
    cheapestPrice: Math.round(averagePrice * (1 - spread)),
    mostExpensivePrice: Math.round(averagePrice * (1 + spread)),
    demandIndex: Number(demandIndex.toFixed(3)),
    sampleSize: 5 + Math.floor(rng() * 8),
  };
}

const EVENT_POOL = [
  { name: "国際展示場 大型見本市", category: "展示会", weight: 0.5 },
  { name: "東京ベイ花火大会", category: "花火大会", weight: 0.35 },
  { name: "音楽フェスティバル", category: "コンサート", weight: 0.3 },
  { name: "国際会議（学会）", category: "MICE", weight: 0.25 },
  { name: "スポーツ国際大会", category: "スポーツ", weight: 0.2 },
];

export function getEventSignal(date: Date): EventSignal {
  const rng = seededRandom(`event-${iso(date)}`);
  const events: EventSignal["events"] = [];
  let demandBoost = 0;
  for (const candidate of EVENT_POOL) {
    if (rng() < candidate.weight * 0.35) {
      const expectedAttendance = 2000 + Math.floor(rng() * 40000);
      events.push({
        name: candidate.name,
        category: candidate.category,
        expectedAttendance,
      });
      demandBoost += Math.min(0.35, expectedAttendance / 120000);
    }
  }
  return { events, demandBoost: Number(Math.min(demandBoost, 0.6).toFixed(3)) };
}

export function getWeatherSignal(date: Date): WeatherSignal {
  const rng = seededRandom(`weather-${iso(date)}`);
  const month = date.getMonth() + 1;
  const conditions: WeatherSignal["condition"][] =
    month >= 6 && month <= 9
      ? ["晴れ", "晴れ", "曇り", "雨", "台風"]
      : month === 12 || month <= 2
      ? ["晴れ", "曇り", "曇り", "雪"]
      : ["晴れ", "晴れ", "曇り", "雨"];
  const condition = pick(rng, conditions);
  const highTempC = Math.round(
    (month >= 6 && month <= 9 ? 27 : month >= 3 && month <= 5 ? 19 : month >= 10 && month <= 11 ? 18 : 7) +
      (rng() - 0.5) * 8
  );
  let demandImpact = 0;
  if (condition === "晴れ") demandImpact = 0.05 + rng() * 0.05;
  if (condition === "雨") demandImpact = -0.05 - rng() * 0.05;
  if (condition === "台風") demandImpact = -0.12 - rng() * 0.03;
  if (condition === "雪") demandImpact = -0.05;
  return { condition, highTempC, demandImpact: Number(demandImpact.toFixed(3)) };
}

export function getEconomicSignal(date: Date): EconomicSignal {
  const rng = seededRandom(`economy-${iso(date)}`);
  const exchangeRateJpyPerUsd = Math.round((140 + rng() * 25) * 10) / 10;
  const consumerConfidenceIndex = Math.round(35 + rng() * 30);
  // Weaker yen (higher JPY/USD) tends to boost inbound tourism demand.
  const fxImpact = (exchangeRateJpyPerUsd - 150) / 400;
  const confidenceImpact = (consumerConfidenceIndex - 50) / 400;
  const inboundDemandImpact = Number((fxImpact + confidenceImpact).toFixed(3));
  return { exchangeRateJpyPerUsd, consumerConfidenceIndex, inboundDemandImpact };
}

export function getAreaSignal(date: Date): AreaSignal {
  const rng = seededRandom(`area-${iso(date)}`);
  return {
    nearbyOccupancyIndex: Number((0.4 + rng() * 0.58).toFixed(3)),
    searchDemandIndex: Number((0.6 + rng() * 0.8).toFixed(3)),
  };
}

export function getSeasonSignal(date: Date): DayOfWeekSeasonSignal {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 5 || day === 6; // Fri/Sat/Sun treated as weekend demand
  const isHoliday = JP_HOLIDAYS_2026.has(iso(date));
  const month = date.getMonth() + 1;
  const season: DayOfWeekSeasonSignal["season"] =
    month >= 3 && month <= 5 ? "春" : month >= 6 && month <= 8 ? "夏" : month >= 9 && month <= 11 ? "秋" : "冬";
  let seasonalityMultiplier = 1.0;
  if (isWeekend) seasonalityMultiplier += 0.12;
  if (isHoliday) seasonalityMultiplier += 0.15;
  if (season === "春" || season === "秋") seasonalityMultiplier += 0.05; // travel seasons in Japan
  return { isWeekend, isHoliday, season, seasonalityMultiplier: Number(seasonalityMultiplier.toFixed(3)) };
}
