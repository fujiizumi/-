"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { HOTEL, PLANS, ROOM_TYPES, TOTAL_ROOMS } from "@/data/hotel";
import type { PortfolioDay, PriceRecommendation } from "@/lib/pricingEngine";

type ForecastResponse = {
  generatedAt: string;
  count: number;
  results: PriceRecommendation[];
};

type PortfolioResponse = {
  generatedAt: string;
  results: PortfolioDay[];
};

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_JA[d.getDay()]})`;
}

function pct(v: number, digits = 1): string {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
}

export default function Dashboard() {
  const [days, setDays] = useState(21);
  const [roomTypeId, setRoomTypeId] = useState(ROOM_TYPES[0].id);
  const [planId, setPlanId] = useState(PLANS[0].id);
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days), roomTypeId, planId });
    Promise.all([
      fetch(`/api/forecast?${params.toString()}`).then((r) => r.json()),
      fetch(`/api/portfolio?days=${days}`).then((r) => r.json()),
    ]).then(([forecastJson, portfolioJson]) => {
      setData(forecastJson);
      setPortfolio(portfolioJson);
      setLoading(false);
    });
  }, [days, roomTypeId, planId]);

  const room = ROOM_TYPES.find((r) => r.id === roomTypeId)!;
  const plan = PLANS.find((p) => p.id === planId)!;

  const summary = useMemo(() => {
    if (!data) return null;
    const prices = data.results.map((r) => r.recommendedPrice);
    const occ = data.results.map((r) => r.occupancyForecast);
    const revPar = data.results.map((r) => r.revPar);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      avgPrice: Math.round(avg(prices)),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgOccupancy: avg(occ),
      avgRevPar: Math.round(avg(revPar)),
    };
  }, [data]);

  const portfolioSummary = useMemo(() => {
    if (!portfolio) return null;
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const revPar = portfolio.results.map((r) => r.revPar);
    const occ = portfolio.results.map((r) => r.occupancyForecast);
    const uplift = portfolio.results.map((r) => r.revParUplift);
    const totalRevenue = portfolio.results.reduce((sum, r) => sum + r.roomRevenue, 0);
    return {
      avgRevPar: Math.round(avg(revPar)),
      avgOccupancy: avg(occ),
      avgUplift: avg(uplift),
      totalRevenue: Math.round(totalRevenue),
    };
  }, [portfolio]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm text-slate-500">
          {HOTEL.name} ／ {HOTEL.location.area} ／ 全{TOTAL_ROOMS}室
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          レベニューマネジメント AI ダッシュボード
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          競合価格・イベント情報・天候・景気動向・近隣地域の需要から日別の需要曲線を推定し、
          <strong>RevPAR（販売可能な客室1室あたり収益）が最大になる価格</strong>
          を部屋タイプ／プランごとに算出します。各行を開くと、その価格が合理的である理由を確認できます。
        </p>
      </header>

      {portfolioSummary && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">ホテル全体（全{TOTAL_ROOMS}室）のRevPAR最適化サマリー</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="期間平均RevPAR" value={`¥${portfolioSummary.avgRevPar.toLocaleString()}`} />
            <SummaryCard label="期間平均稼働率" value={`${(portfolioSummary.avgOccupancy * 100).toFixed(1)}%`} />
            <SummaryCard
              label="基準価格販売時との比較"
              value={pct(portfolioSummary.avgUplift)}
              accent={portfolioSummary.avgUplift >= 0 ? "rise" : "fall"}
            />
            <SummaryCard label="期間合計客室収入見込み" value={`¥${portfolioSummary.totalRevenue.toLocaleString()}`} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            全室を基準価格のまま販売した場合と比較したRevPARの改善率です。プラスであれば、AIが提案する価格設定の方が固定価格より収益性が高いことを意味します。
          </p>
        </section>
      )}

      <section className="mb-6 flex flex-wrap gap-3">
        <label className="flex flex-col text-sm">
          部屋タイプ
          <select
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
          >
            {ROOM_TYPES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}（全{r.totalRooms}室）
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          プラン
          <select
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          表示日数
          <select
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 21, 30, 60].map((d) => (
              <option key={d} value={d}>
                {d}日間
              </option>
            ))}
          </select>
        </label>
      </section>

      {summary && (
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="平均推奨価格" value={`¥${summary.avgPrice.toLocaleString()}`} />
          <SummaryCard label="平均RevPAR" value={`¥${summary.avgRevPar.toLocaleString()}`} />
          <SummaryCard label="平均稼働予測" value={`${(summary.avgOccupancy * 100).toFixed(0)}%`} />
          <SummaryCard label="基準価格" value={`¥${room.basePrice.toLocaleString()}`} />
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">日付</th>
              <th className="px-4 py-2 font-medium">推奨価格</th>
              <th className="px-4 py-2 font-medium">基準比</th>
              <th className="px-4 py-2 font-medium">稼働予測</th>
              <th className="px-4 py-2 font-medium">RevPAR</th>
              <th className="px-4 py-2 font-medium">主な要因</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  分析中...
                </td>
              </tr>
            )}
            {!loading &&
              data?.results.map((row) => {
                const diffPct = row.recommendedPrice / (room.basePrice * plan.priceMultiplier) - 1;
                const topFactors = [...row.factors]
                  .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
                  .slice(0, 2);
                const isOpen = expandedDate === row.date;
                return (
                  <Fragment key={row.date}>
                    <tr
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      onClick={() => setExpandedDate(isOpen ? null : row.date)}
                    >
                      <td className="px-4 py-2 font-medium">{formatDateLabel(row.date)}</td>
                      <td className="px-4 py-2 font-semibold">¥{row.recommendedPrice.toLocaleString()}</td>
                      <td className={`px-4 py-2 ${diffPct >= 0 ? "text-rise" : "text-fall"}`}>{pct(diffPct)}</td>
                      <td className="px-4 py-2">{(row.occupancyForecast * 100).toFixed(0)}%</td>
                      <td className="px-4 py-2">
                        ¥{Math.round(row.revPar).toLocaleString()}
                        <span
                          className={`ml-1 text-xs ${row.revParUplift >= 0 ? "text-rise" : "text-fall"}`}
                        >
                          （{pct(row.revParUplift)} vs 基準価格）
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{topFactors.map((f) => f.label).join(" / ")}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-slate-100 bg-slate-50/60">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="mb-3 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm leading-relaxed">
                            <span className="mb-1 block text-xs font-semibold text-accent">
                              なぜこの価格が合理的か（RevPAR最大化の根拠）
                            </span>
                            {row.rationale}
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {row.factors.map((f) => (
                              <div key={f.key} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{f.label}</span>
                                  <span className={f.impact >= 0 ? "text-rise" : "text-fall"}>
                                    {f.impact >= 0 ? "+" : ""}
                                    {(f.impact * 100).toFixed(1)}pt
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{f.detail}</p>
                              </div>
                            ))}
                            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">価格感度（弾力性）</span>
                                <span>{row.priceSensitivity}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                数値が小さいほど、この日は値上げしても稼働率が落ちにくい（強気の価格設定が有効）ことを示します。
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </section>

      <footer className="mt-6 text-xs text-slate-400">
        ※ 現在は競合価格・イベント・天候・景気・地域データはデモ用の疑似データで生成しています。
        実運用では外部API（OTA価格比較、気象庁/OpenWeatherMap、イベントカレンダー、経済指標、PMS稼働データ）に接続してください。詳細はREADME参照。
      </footer>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "rise" | "fall";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          accent === "rise" ? "text-rise" : accent === "fall" ? "text-fall" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
