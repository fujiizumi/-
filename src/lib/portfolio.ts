/**
 * 多店舗展開計画：店舗リストの保存と、全社の年度別収支予測。
 * 店舗データはブラウザの localStorage に保存し、JSONで書き出し／読み込みできます。
 */
import { DEFAULT_INPUT, buildInputForArea, simulate, simulateMonthly, type MonthlySimulation, type SimulationInput } from "./profitSimulator";
import type { AreaPreset } from "@/data/areas";

export type StoreStatus = "候補" | "交渉中" | "契約済" | "開業済";
export const STORE_STATUSES: StoreStatus[] = ["候補", "交渉中", "契約済", "開業済"];

export type Store = {
  id: string;
  name: string;
  status: StoreStatus;
  /** 開業予定月（YYYY-MM） */
  openMonth: string;
  input: SimulationInput;
  updatedAt: string;
};

export type PortfolioSettings = {
  /** 本部経費（円/年：本部人件費・システム・採用・出店開発費等） */
  hqAnnualCost: number;
  /** 開業1年目の稼働率係数（立ち上がり期） */
  rampYear1: number;
  /** 開業2年目の稼働率係数 */
  rampYear2: number;
  /** 予測開始年 */
  startYear: number;
  /** 予測年数 */
  years: number;
  /** エリア比較で使う1店舗あたり目標営業利益 */
  targetPerStore: number;
};

export type Portfolio = {
  stores: Store[];
  settings: PortfolioSettings;
};

export const PORTFOLIO_KEY = "hotel-profit-sim:portfolio";
const LEGACY_SCENARIOS_KEY = "hotel-profit-sim:scenarios";

export const DEFAULT_SETTINGS: PortfolioSettings = {
  hqAnnualCost: 30_000_000,
  rampYear1: 0.85,
  rampYear2: 0.95,
  startYear: new Date().getFullYear() + 1,
  years: 5,
  targetPerStore: 15_000_000,
};

export function loadPortfolio(): Portfolio {
  let p: Portfolio = { stores: [], settings: DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Portfolio>;
      p = normalizePortfolio(parsed);
    } else {
      // 旧バージョンの「シナリオ保存」を店舗候補として引き継ぐ
      const legacy = localStorage.getItem(LEGACY_SCENARIOS_KEY);
      if (legacy) {
        const scenarios = JSON.parse(legacy) as Record<string, SimulationInput>;
        p.stores = Object.entries(scenarios).map(([name, input]) => newStore(name, input));
      }
    }
  } catch {
    /* storage unavailable */
  }
  return p;
}

export function normalizePortfolio(parsed: Partial<Portfolio>): Portfolio {
  return {
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    stores: (parsed.stores ?? []).map((s) => ({
      ...s,
      status: STORE_STATUSES.includes(s.status) ? s.status : "候補",
      input: { ...DEFAULT_INPUT, ...s.input },
    })),
  };
}

export function savePortfolio(p: Portfolio) {
  try {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function newStore(name: string, input: SimulationInput, openMonth?: string): Store {
  const d = new Date();
  const fallbackOpen = `${d.getFullYear() + 1}-04`;
  return {
    id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    status: "候補",
    openMonth: openMonth ?? fallbackOpen,
    input,
    updatedAt: new Date().toISOString(),
  };
}

export function upsertStore(store: Store) {
  const p = loadPortfolio();
  const idx = p.stores.findIndex((s) => s.id === store.id);
  const next = { ...store, updatedAt: new Date().toISOString() };
  if (idx >= 0) p.stores[idx] = next;
  else p.stores.push(next);
  savePortfolio(p);
  return p;
}

/** 開業後の経過月数に応じた稼働率係数 */
function rampFactor(monthsSinceOpen: number, s: PortfolioSettings) {
  if (monthsSinceOpen < 12) return s.rampYear1;
  if (monthsSinceOpen < 24) return s.rampYear2;
  return 1;
}

export type YearProjection = {
  year: number;
  activeStores: number;
  openings: number;
  revenue: number;
  storeProfit: number;
  hqCost: number;
  companyProfit: number;
  investment: number;
  depreciation: number;
  /** 累計キャッシュフロー（全社利益＋減価償却−開業投資）の概算 */
  cumulativeCash: number;
};

/** 店舗ごとの「自社の営業利益」（賃貸＝ホテル営業利益、MC＝運営会社利益） */
export const storeProfit = (input: SimulationInput, occFactor = 1) =>
  simulate({ ...input, occupancy: Math.min(1, input.occupancy * occFactor) });

export function projectPortfolio(p: Portfolio): YearProjection[] {
  const { settings } = p;
  const out: YearProjection[] = [];
  let cumulative = 0;
  // ランプ係数ごとの結果をキャッシュ（店舗×係数）
  // 店舗×稼働係数ごとの月別試算をキャッシュ（季節変動を反映）
  const memo = new Map<string, MonthlySimulation>();
  const get = (st: Store, f: number) => {
    const k = `${st.id}:${f}`;
    let r = memo.get(k);
    if (!r) {
      r = simulateMonthly(st.input, f);
      memo.set(k, r);
    }
    return r;
  };

  for (let y = 0; y < settings.years; y++) {
    const year = settings.startYear + y;
    let revenue = 0;
    let profit = 0;
    let investment = 0;
    let depreciation = 0;
    let openings = 0;
    const active = new Set<string>();

    for (const st of p.stores) {
      const [oy, om] = st.openMonth.split("-").map(Number);
      if (!oy || !om) continue;
      if (oy === year) {
        openings++;
        if (st.input.model === "lease") investment += st.input.leaseInitialInvestment;
      }
      for (let m = 1; m <= 12; m++) {
        const since = (year - oy) * 12 + (m - om);
        if (since < 0) continue;
        active.add(st.id);
        const r = get(st, rampFactor(since, settings)).months[m - 1].result;
        revenue += r.totalRevenue;
        profit += r.operatingProfit;
        if (st.input.model === "lease") {
          const yearsSince = since / 12;
          if (yearsSince < st.input.leaseDepreciationYears) depreciation += r.lease.depreciation;
        }
      }
    }
    const hqCost = settings.hqAnnualCost;
    const companyProfit = profit - hqCost;
    cumulative += companyProfit + depreciation - investment;
    out.push({
      year,
      activeStores: active.size,
      openings,
      revenue,
      storeProfit: profit,
      hqCost,
      companyProfit,
      investment,
      depreciation,
      cumulativeCash: cumulative,
    });
  }
  return out;
}

/** エリア標準値で、目標利益を達成するのに必要な最小客室数（見つからなければ null） */
export function minRoomsForTarget(area: AreaPreset, base: SimulationInput, maxRooms = 400): number | null {
  for (let rooms = 20; rooms <= maxRooms; rooms += 5) {
    const r = simulate(buildInputForArea(area, rooms, base));
    if (r.operatingProfit >= base.targetProfit) return rooms;
  }
  return null;
}
