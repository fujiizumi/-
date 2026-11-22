/**
 * 周辺競合ホテルの販売価格を取得する（サーバー側専用）。
 *
 * - 環境変数 RAKUTEN_APP_ID が設定されていれば、楽天トラベル「空室検索API」
 *   (VacantHotelSearch) から、指定地点の半径内で実際に販売中の1名1室の最安料金を取得します。
 * - 未設定、または API がエラーを返した場合は、デモ用の疑似データを返します（source: "demo"）。
 *
 * 楽天ウェブサービスは接続先・認証方式の変更が告知されることがあるため、
 * エンドポイントは RAKUTEN_TRAVEL_ENDPOINT で、追加の認証キーは RAKUTEN_ACCESS_KEY で
 * 差し替えられるようにしています。
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
  source: "rakuten" | "demo";
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

const DEFAULT_ENDPOINT = "https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426";
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: CompetitorResponse }>();

export async function fetchCompetitors(q: CompetitorQuery): Promise<CompetitorResponse> {
  const key = `${q.lat.toFixed(4)},${q.lng.toFixed(4)},${q.radiusKm},${q.checkinDate}`;
  const appId = process.env.RAKUTEN_APP_ID;

  if (appId) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
    try {
      const hotels = await fetchFromRakuten(q, appId);
      const value = build("rakuten", q, hotels);
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return build("demo", q, demoCompetitors(q), `楽天トラベルAPIの取得に失敗したため、デモデータを表示しています（${msg}）`);
    }
  }
  return build(
    "demo",
    q,
    demoCompetitors(q),
    "RAKUTEN_APP_ID が未設定のため、デモデータを表示しています。実データの取得方法は README を参照してください。",
  );
}

function build(source: CompetitorResponse["source"], q: CompetitorQuery, hotels: Competitor[], message?: string): CompetitorResponse {
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

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchFromRakuten(q: CompetitorQuery, appId: string): Promise<Competitor[]> {
  const endpoint = process.env.RAKUTEN_TRAVEL_ENDPOINT || DEFAULT_ENDPOINT;
  const radius = Math.min(3, Math.max(0.1, q.radiusKm));
  const results: Competitor[] = [];

  // hits の上限は30件。最大3ページ（90軒）まで取得する。
  for (let page = 1; page <= 3; page++) {
    const params = new URLSearchParams({
      applicationId: appId,
      format: "json",
      checkinDate: q.checkinDate,
      checkoutDate: addDays(q.checkinDate, 1),
      latitude: String(q.lat),
      longitude: String(q.lng),
      searchRadius: String(radius),
      datumType: "1", // 世界測地系・度単位
      adultNum: "1",
      hits: "30",
      page: String(page),
      sort: "+roomCharge",
    });
    if (process.env.RAKUTEN_ACCESS_KEY) params.set("accessKey", process.env.RAKUTEN_ACCESS_KEY);
    if (process.env.RAKUTEN_AFFILIATE_ID) params.set("affiliateId", process.env.RAKUTEN_AFFILIATE_ID);

    const res = await fetch(`${endpoint}?${params.toString()}`, { cache: "no-store" });
    if (res.status === 404) break; // 該当なし（空室なし）
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = json?.error_description || json?.error || `HTTP ${res.status}`;
      throw new Error(detail);
    }

    for (const entry of json?.hotels ?? []) {
      // formatVersion=1: { hotel: [ {hotelBasicInfo}, {roomInfo:[...]}, ... ] }
      // formatVersion=2: [ {hotelBasicInfo}, {roomInfo:[...]} ]
      const parts: any[] = Array.isArray(entry) ? entry : entry?.hotel ?? [];
      const basic = parts.find((p) => p?.hotelBasicInfo)?.hotelBasicInfo;
      if (!basic) continue;

      let best = Infinity;
      for (const p of parts) {
        const roomInfo: any[] = p?.roomInfo ?? [];
        for (const r of roomInfo) {
          const charge = r?.dailyCharge;
          if (!charge) continue;
          const total = Number(charge.total ?? charge.rakutenCharge);
          if (Number.isFinite(total) && total > 0) best = Math.min(best, total);
        }
      }
      if (!Number.isFinite(best)) best = Number(basic.hotelMinCharge) || NaN;
      if (!Number.isFinite(best)) continue;

      const lat = Number(basic.latitude);
      const lng = Number(basic.longitude);
      const looksLikeDegrees = Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && lat !== 0;

      results.push({
        id: String(basic.hotelNo),
        name: String(basic.hotelName ?? ""),
        price: Math.round(best),
        distanceKm: looksLikeDegrees ? Math.round(haversineKm(q.lat, q.lng, lat, lng) * 100) / 100 : null,
        rating: basic.reviewAverage != null && Number(basic.reviewAverage) > 0 ? Number(basic.reviewAverage) : null,
        station: basic.nearestStation ? String(basic.nearestStation) : null,
        url: basic.hotelInformationUrl ? String(basic.hotelInformationUrl) : null,
      });
    }

    const pageCount = Number(json?.pagingInfo?.pageCount ?? 1);
    if (page >= pageCount) break;
    await new Promise((r) => setTimeout(r, 1100)); // APIの利用制限（1秒1回程度）に配慮
  }

  // 同一ホテルの重複を除去（最安値を採用）
  const byId = new Map<string, Competitor>();
  for (const c of results) {
    const prev = byId.get(c.id);
    if (!prev || c.price < prev.price) byId.set(c.id, c);
  }
  return [...byId.values()];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** デモ用：地点と日付から決まる再現性のある疑似データ */
function demoCompetitors(q: CompetitorQuery): Competitor[] {
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
