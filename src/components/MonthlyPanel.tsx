"use client";

import { useState } from "react";
import { SEASON_PROFILES, findSeasonProfile } from "@/data/seasonality";
import type { MonthlySimulation, SimulationInput } from "@/lib/profitSimulator";

const man = (v: number) =>
  `${(v / 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`;
const manShort = (v: number) =>
  (v / 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 });
const yen = (v: number) => `${Math.round(v).toLocaleString()}円`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

type Props = {
  input: SimulationInput;
  monthly: MonthlySimulation;
  onSeason: (
    patch: Pick<SimulationInput, "seasonProfile" | "seasonOcc" | "seasonAdr">,
  ) => void;
};

export function MonthlyPanel({ input, monthly, onSeason }: Props) {
  const [editing, setEditing] = useState(false);
  const isLease = input.model === "lease";
  const months = monthly.months;
  const hasLoss = months.some((m) => m.result.operatingProfit < 0);
  const hasProfit = months.some((m) => m.result.operatingProfit > 0);
  // 0円の基準線の位置（上下の振れ幅に応じて）
  const posMax = Math.max(0, ...months.map((m) => m.result.operatingProfit));
  const negMax = Math.max(0, ...months.map((m) => -m.result.operatingProfit));
  const zeroAt = posMax + negMax > 0 ? posMax / (posMax + negMax) : 1;

  const setIdx = (kind: "seasonOcc" | "seasonAdr", k: number, v: number) => {
    const next = [...input[kind]];
    next[k] = Math.max(0, v);
    onSeason({
      seasonProfile: "custom",
      seasonOcc: kind === "seasonOcc" ? next : input.seasonOcc,
      seasonAdr: kind === "seasonAdr" ? next : input.seasonAdr,
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">月別試算</h2>
          <p className="text-xs text-slate-500">
            季節指数で稼働率とADRを各月に配分します。年平均の稼働率・ADRは入力値のまま保たれます。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            id="season-profile"
            value={input.seasonProfile}
            onChange={(e) => {
              const p = findSeasonProfile(e.target.value);
              if (p)
                onSeason({
                  seasonProfile: p.id,
                  seasonOcc: p.occ,
                  seasonAdr: p.adr,
                });
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5"
            aria-label="季節パターン"
          >
            {SEASON_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {input.seasonProfile === "custom" && (
              <option value="custom">カスタム（編集済み）</option>
            )}
          </select>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
          >
            {editing ? "指数の編集を閉じる" : "季節指数を編集"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3">
          <p className="mb-2 text-[11px] text-slate-500">
            100 = 年平均。例：8月の稼働率指数120
            は「年平均より2割高い」。自社や周辺の月別実績があれば、その比率を入れてください。
          </p>
          <table className="text-xs tabular-nums">
            <thead>
              <tr>
                <th className="pr-2 text-left font-medium text-slate-500">
                  指数
                </th>
                {months.map((m) => (
                  <th
                    key={m.month}
                    className="px-0.5 font-medium text-slate-500"
                  >
                    {m.month}月
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["seasonOcc", "seasonAdr"] as const).map((kind) => (
                <tr key={kind}>
                  <th className="whitespace-nowrap pr-2 text-left font-medium text-slate-600">
                    {kind === "seasonOcc" ? "稼働率" : "ADR"}
                  </th>
                  {months.map((m, k) => (
                    <td key={k} className="px-0.5 py-0.5">
                      <input
                        id={`${kind}-${k}`}
                        type="number"
                        inputMode="numeric"
                        value={input[kind][k] ?? 100}
                        onChange={(e) =>
                          setIdx(kind, k, parseFloat(e.target.value) || 0)
                        }
                        className="w-14 rounded border border-slate-300 bg-white px-1 py-1 text-right"
                        aria-label={`${m.month}月の${kind === "seasonOcc" ? "稼働率" : "ADR"}指数`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* サマリー */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">赤字の月</div>
          <div
            className={`mt-1 text-lg font-bold tabular-nums ${monthly.lossMonths ? "text-fall" : "text-rise"}`}
          >
            {monthly.lossMonths ? `▲ ${monthly.lossMonths}か月` : "✓ なし"}
          </div>
          <div className="text-[11px] text-slate-400">
            {monthly.lossMonths
              ? months
                  .filter((m) => m.result.operatingProfit < 0)
                  .map((m) => `${m.month}月`)
                  .join("・")
              : "全月で黒字"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">最も利益の出る月</div>
          <div className="mt-1 text-lg font-bold tabular-nums">
            {monthly.best.month}月
          </div>
          <div className="text-[11px] text-slate-400">
            {man(monthly.best.result.operatingProfit)}・稼働{" "}
            {pct(monthly.best.occupancy, 0)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">最も厳しい月</div>
          <div className="mt-1 text-lg font-bold tabular-nums">
            {monthly.worst.month}月
          </div>
          <div className="text-[11px] text-slate-400">
            {man(monthly.worst.result.operatingProfit)}・稼働{" "}
            {pct(monthly.worst.occupancy, 0)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">累計の最大落ち込み</div>
          <div
            className={`mt-1 text-lg font-bold tabular-nums ${monthly.worstCumulative < 0 ? "text-fall" : ""}`}
          >
            {man(monthly.worstCumulative)}
          </div>
          <div className="text-[11px] text-slate-400">
            1月からの累計営業利益の最小値。運転資金の目安
          </div>
        </div>
      </div>

      {/* 月別営業利益のグラフ */}
      <figure className="mt-4">
        <figcaption className="mb-1 text-xs text-slate-600">
          月別 {isLease ? "営業利益（賃貸・自社）" : "営業利益（MC・運営会社）"}
          （万円）
        </figcaption>
        <div
          className="flex h-44 gap-1 sm:gap-2"
          role="img"
          aria-label="月別営業利益の棒グラフ"
        >
          {months.map((m) => {
            const p = m.result.operatingProfit;
            const h = (Math.abs(p) / Math.max(posMax + negMax, 1)) * 100;
            return (
              <div
                key={m.month}
                className="flex min-w-0 flex-1 flex-col"
                title={`${m.month}月：営業利益 ${man(p)}／稼働率 ${pct(m.occupancy)}／ADR ${yen(m.adr)}`}
              >
                <div className="relative flex-1">
                  <div className="absolute inset-x-0 bottom-4 top-4">
                    {hasLoss && hasProfit && (
                      <div
                        className="absolute inset-x-0 h-px bg-slate-300"
                        style={{ top: `${zeroAt * 100}%` }}
                      />
                    )}
                    <div
                      className={`absolute left-1/2 w-3/4 max-w-[28px] -translate-x-1/2 ${p >= 0 ? "rounded-t bg-accent" : "rounded-b bg-fall/80"}`}
                      style={
                        p >= 0
                          ? {
                              bottom: `${(1 - zeroAt) * 100}%`,
                              height: `${h}%`,
                            }
                          : { top: `${zeroAt * 100}%`, height: `${h}%` }
                      }
                    />
                    <span
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] tabular-nums text-slate-600 sm:text-[10px]"
                      style={
                        p >= 0
                          ? { bottom: `calc(${(1 - zeroAt) * 100 + h}% + 1px)` }
                          : { top: `calc(${zeroAt * 100 + h}% + 1px)` }
                      }
                    >
                      {manShort(p)}
                    </span>
                  </div>
                </div>
                <div className="pt-1 text-center text-[10px] text-slate-500 sm:text-[11px]">
                  {m.month}月
                </div>
              </div>
            );
          })}
        </div>
      </figure>

      {/* 月別表 */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-xs tabular-nums">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {[
                "月",
                "稼働率",
                "ADR",
                "RevPAR",
                "販売室数",
                "売上高",
                "原価・人件費・経費",
                "GOP",
                isLease ? "賃料・償却等" : "フィー（自社収入）",
                "営業利益",
                "累計",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`whitespace-nowrap px-2 py-1.5 font-medium ${i === 0 ? "text-left" : "text-right"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const r = m.result;
              const op = r.cogs + r.laborTotal + r.operatingExpenses;
              const modelCol = isLease
                ? r.lease.rent + r.lease.insurance + r.lease.depreciation
                : r.mc.baseFee + r.mc.incentiveFee;
              return (
                <tr
                  key={m.month}
                  className={`border-t border-slate-100 ${r.operatingProfit < 0 ? "bg-red-50/60" : ""}`}
                >
                  <td className="px-2 py-1.5">{m.month}月</td>
                  <td className="px-2 py-1.5 text-right">{pct(m.occupancy)}</td>
                  <td className="px-2 py-1.5 text-right">{yen(m.adr)}</td>
                  <td className="px-2 py-1.5 text-right">{yen(r.revPar)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {Math.round(r.soldRoomNights).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {man(r.totalRevenue)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{man(op)}</td>
                  <td className="px-2 py-1.5 text-right">{man(r.gop)}</td>
                  <td className="px-2 py-1.5 text-right">{man(modelCol)}</td>
                  <td
                    className={`px-2 py-1.5 text-right font-semibold ${r.operatingProfit < 0 ? "text-fall" : ""}`}
                  >
                    {man(r.operatingProfit)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right ${m.cumulativeProfit < 0 ? "text-fall" : "text-slate-600"}`}
                  >
                    {man(m.cumulativeProfit)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-200 font-semibold">
              <td className="px-2 py-1.5">年計</td>
              <td className="px-2 py-1.5 text-right">{pct(input.occupancy)}</td>
              <td className="px-2 py-1.5 text-right">{yen(input.adr)}</td>
              <td className="px-2 py-1.5 text-right">
                {yen(input.adr * input.occupancy)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {Math.round(
                  months.reduce((a, m) => a + m.result.soldRoomNights, 0),
                ).toLocaleString()}
              </td>
              <td className="px-2 py-1.5 text-right">
                {man(monthly.totalRevenue)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {man(
                  months.reduce(
                    (a, m) =>
                      a +
                      m.result.cogs +
                      m.result.laborTotal +
                      m.result.operatingExpenses,
                    0,
                  ),
                )}
              </td>
              <td className="px-2 py-1.5 text-right">
                {man(months.reduce((a, m) => a + m.result.gop, 0))}
              </td>
              <td className="px-2 py-1.5 text-right">
                {man(
                  months.reduce(
                    (a, m) =>
                      a +
                      (isLease
                        ? m.result.lease.rent +
                          m.result.lease.insurance +
                          m.result.lease.depreciation
                        : m.result.mc.baseFee + m.result.mc.incentiveFee),
                    0,
                  ),
                )}
              </td>
              <td
                className={`px-2 py-1.5 text-right ${monthly.totalProfit < 0 ? "text-fall" : ""}`}
              >
                {man(monthly.totalProfit)}
              </td>
              <td className="px-2 py-1.5" />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        ※
        正社員給与・固定シフトのパート・賃料などの固定費は毎月同額、賞与は12か月で按分しています。清掃・リネン・OTA手数料などは各月の販売室数に比例します。
      </p>
    </div>
  );
}
