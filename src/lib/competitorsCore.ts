/**
 * 競合価格まわりの純粋関数（サーバー／ブラウザ共通）。
 */

export type Competitor = {
  id: string;
  name: string;
  /** 指定日の1名1室・最安プラン料金（税込・円） */
  price: number;
  distanceKm: number | null;
  rating: number | null;
  station: string | null;
  url: string | null;
};

export type CompetitorStats = {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  average: number;
};

export type CompetitorResponse = {
  source: "rakuten" | "demo" | "manual";
  message?: string;
  checkinDate: string;
  radiusKm: number;
  fetchedAt: string;
  hotels: Competitor[];
  stats: CompetitorStats | null;
};

export type CompetitorQuery = {
  lat: number;
  lng: number;
  radiusKm: number;
  checkinDate: string;
  /** デモデータの価格水準（自社想定ADR・税抜） */
  refAdr: number;
};


export function build(source: CompetitorResponse["source"], q: CompetitorQuery, hotels: Competitor[], message?: string): CompetitorResponse {
  const sorted = [...hotels].sort((a, b) => a.price - b.price);
  return {
    source,
    message,
    checkinDate: q.checkinDate,
    radiusKm: q.radiusKm,
    fetchedAt: new Date().toISOString(),
    hotels: sorted,
    stats: computeStats(sorted.map((h) => h.price)),
  };
}

export function computeStats(prices: number[]): CompetitorStats | null {
  if (prices.length === 0) return null;
  const s = [...prices].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return Math.round(s[lo] + (s[hi] - s[lo]) * (idx - lo));
  };
  return {
    count: s.length,
    min: s[0],
    p25: q(0.25),
    median: q(0.5),
    p75: q(0.75),
    max: s[s.length - 1],
    average: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
  };
}


/** デモ用：地点と日付から決まる再現性のある疑似データ */
export function demoCompetitors(q: CompetitorQuery): Competitor[] {
  let seed = (Math.floor(Math.abs(q.lat * 1000 + q.lng * 7919)) ^ hashString(q.checkinDate)) >>> 0;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const day = new Date(q.checkinDate + "T00:00:00Z").getUTCDay();
  const weekendFactor = day === 5 || day === 6 ? 1.25 : day === 0 ? 0.92 : 1;
  const base = q.refAdr * 1.1 * weekendFactor; // 税込換算
  const names = ["ステーション", "セントラル", "シティ", "イン", "グランド", "ビジネス", "ネクスト", "テラス", "ベイ", "パーク", "スマート", "リバーサイド"];
  const n = 10 + Math.floor(rand() * 6);
  const list: Competitor[] = [];
  for (let k = 0; k < n; k++) {
    const tier = rand();
    const factor = tier < 0.3 ? 0.75 + rand() * 0.15 : tier < 0.8 ? 0.9 + rand() * 0.25 : 1.2 + rand() * 0.5;
    list.push({
      id: `demo-${k}`,
      name: `（デモ）ホテル${names[k % names.length]}${String.fromCharCode(65 + k)}`,
      price: Math.round((base * factor) / 100) * 100,
      distanceKm: Math.round(rand() * q.radiusKm * 100) / 100,
      rating: Math.round((3.4 + rand() * 1.3) * 100) / 100,
      station: null,
      url: null,
    });
  }
  return list;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
