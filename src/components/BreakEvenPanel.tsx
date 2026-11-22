"use client";

import type { BreakEvenAnalysis, OperationModel } from "@/lib/profitSimulator";

const man = (v: number) => `${(v / 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

function safetyStatus(m: number | null): { label: string; cls: string } {
  if (m === null) return { label: "—", cls: "bg-slate-100 text-slate-600" };
  if (m < 0) return { label: "✗ 赤字", cls: "bg-fall text-white" };
  if (m < 0.1) return { label: "▲ 危険", cls: "bg-red-100 text-red-800" };
  if (m < 0.2) return { label: "▲ 注意", cls: "bg-amber-100 text-amber-800" };
  return { label: "✓ 安全", cls: "bg-emerald-100 text-emerald-800" };
}

type Props = {
  be: BreakEvenAnalysis;
  model: OperationModel;
  currentSales: number;
  months: number;
  targetProfit: number;
};

export function BreakEvenPanel({ be, model, currentSales, months, targetProfit }: Props) {
  const status = safetyStatus(be.safetyMargin);
  const overCapacity = be.breakEvenOccupancy !== null && be.breakEvenOccupancy > 1;
  const isLease = model === "lease";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">損益分岐点分析</h2>
        <span className="text-xs text-slate-500">{isLease ? "賃貸方式・自社の営業利益ベース" : "MC方式・運営会社の営業利益ベース（ホテル売上高で表示）"}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="損益分岐点売上高（年）"
          value={be.breakEvenSales === null ? "満室でも届かない" : man(be.breakEvenSales)}
          sub={be.breakEvenSales === null ? undefined : `月 ${man(be.breakEvenSales / months)}`}
          strong
        />
        <Tile
          label={`目標利益（${man(targetProfit)}）達成売上高`}
          value={be.targetSales === null ? "満室でも届かない" : man(be.targetSales)}
          sub={be.targetSales === null ? undefined : `月 ${man(be.targetSales / months)}／現在比 ${pct(be.targetSales / Math.max(currentSales, 1) - 1)}`}
        />
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">安全余裕率</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-bold tabular-nums">{be.safetyMargin === null ? "—" : pct(be.safetyMargin)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
          </div>
          <div className="text-[11px] text-slate-400">売上がこの割合まで下がっても赤字にならない</div>
        </div>
        <Tile
          label="損益分岐点稼働率"
          value={be.breakEvenOccupancy === null ? "—" : pct(be.breakEvenOccupancy)}
          sub={overCapacity ? "▲ 100%を超えるため満室でも赤字" : "ADR・客単価は現在の入力のまま"}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        {isLease ? (
          <>
            <Pair label="固定費（年）" value={man(be.fixedCosts)} />
            <Pair label="変動費率" value={be.variableCostRatio === null ? "—" : pct(be.variableCostRatio)} />
            <Pair label="限界利益率" value={be.contributionMarginRatio === null ? "—" : pct(be.contributionMarginRatio)} />
            <Pair label="損益分岐点比率" value={be.breakEvenRatio === null ? "—" : pct(be.breakEvenRatio)} />
          </>
        ) : (
          <>
            <Pair label="自社負担コスト（年）" value={man(be.fixedCosts)} />
            <Pair label="オーナーの損益分岐点売上高" value={be.ownerBreakEvenSales == null ? "満室でも届かない" : man(be.ownerBreakEvenSales)} />
            <Pair label="損益分岐点比率" value={be.breakEvenRatio === null ? "—" : pct(be.breakEvenRatio)} />
            <Pair label="満室時の売上高" value={man(be.maxSales)} />
          </>
        )}
      </div>

      {isLease && be.variableCostRatio !== null && <BreakEvenChart be={be} currentSales={currentSales} />}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {isLease
          ? "損益分岐点売上高 ＝ 固定費 ÷ 限界利益率。固定費は正社員・固定シフトのパート・賃料・固定経費・減価償却など、変動費はOTA/決済手数料・朝食原価・清掃・リネン・アメニティ・光熱費（変動分）など販売室数に比例する費用です。"
          : "MC方式の運営会社利益はフィー（売上比のベースフィー＋GOP比のインセンティブフィー）で決まり、売上に対して折れ線になるため、稼働率を動かして利益が0になる売上高を数値計算しています。"}
      </p>
    </div>
  );
}

function Tile({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? "border-accent/40 bg-blue-50/50" : "border-slate-200"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** 損益分岐点図表：売上高線と総費用線（固定費＋変動費）の交点が損益分岐点 */
function BreakEvenChart({ be, currentSales }: { be: BreakEvenAnalysis; currentSales: number }) {
  const W = 640;
  const H = 260;
  const m = { l: 56, r: 16, t: 16, b: 36 };
  const v = be.variableCostRatio ?? 0;
  const xMax = Math.max(be.maxSales, currentSales, (be.breakEvenSales ?? 0) * 1.1) * 1.05;
  const yMax = Math.max(xMax, be.fixedCosts + v * xMax);
  const x = (s: number) => m.l + (s / xMax) * (W - m.l - m.r);
  const y = (c: number) => H - m.b - (c / yMax) * (H - m.t - m.b);
  const cost = (s: number) => be.fixedCosts + v * s;
  const ticks = niceTicks(xMax, 4);
  const yTicks = niceTicks(yMax, 4);
  const beS = be.breakEvenSales;
  const curProfit = currentSales - cost(currentSales);

  return (
    <figure className="mt-4">
      <figcaption className="mb-1 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-[#2563eb]" />売上高
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-[#d97706]" />総費用（固定費＋変動費）
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-slate-400" />固定費
        </span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[480px]" role="img" aria-label="損益分岐点図表">
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="#64748b">
                {(t / 1e8).toFixed(t % 1e8 === 0 ? 0 : 1)}億
              </text>
            </g>
          ))}
          {ticks.map((t) => (
            <text key={`x${t}`} x={x(t)} y={H - m.b + 14} textAnchor="middle" fontSize={10} fill="#64748b">
              {(t / 1e8).toFixed(t % 1e8 === 0 ? 0 : 1)}億
            </text>
          ))}
          <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#64748b">
            売上高（年）
          </text>

          {/* 利益・損失の領域 */}
          {beS !== null && (
            <>
              <polygon points={`${x(0)},${y(0)} ${x(0)},${y(cost(0))} ${x(beS)},${y(cost(beS))}`} fill="#dc2626" fillOpacity={0.08} />
              <polygon points={`${x(beS)},${y(beS)} ${x(xMax)},${y(xMax)} ${x(xMax)},${y(cost(xMax))}`} fill="#059669" fillOpacity={0.1} />
            </>
          )}

          <line x1={x(0)} x2={x(xMax)} y1={y(be.fixedCosts)} y2={y(be.fixedCosts)} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1} />
          <line x1={x(0)} x2={x(xMax)} y1={y(cost(0))} y2={y(cost(xMax))} stroke="#d97706" strokeWidth={2} />
          <line x1={x(0)} x2={x(xMax)} y1={y(0)} y2={y(xMax)} stroke="#2563eb" strokeWidth={2} />

          {/* 満室上限 */}
          <line x1={x(be.maxSales)} x2={x(be.maxSales)} y1={m.t} y2={H - m.b} stroke="#94a3b8" strokeWidth={1} strokeDasharray="1 3" />
          <text x={x(be.maxSales) - 4} y={m.t + 10} textAnchor="end" fontSize={10} fill="#64748b">
            満室
          </text>

          {/* 現在 */}
          <line x1={x(currentSales)} x2={x(currentSales)} y1={y(cost(currentSales))} y2={y(currentSales)} stroke={curProfit >= 0 ? "#059669" : "#dc2626"} strokeWidth={2} />
          <circle cx={x(currentSales)} cy={y(currentSales)} r={4} fill="#2563eb" stroke="#fff" strokeWidth={2}>
            <title>{`現在の売上高 ${man(currentSales)}／営業利益 ${man(curProfit)}`}</title>
          </circle>
          <text x={x(currentSales) - 6} y={y(Math.max(currentSales, cost(currentSales))) - 10} textAnchor="end" fontSize={10} fill="#0f172a">
            現在 {curProfit >= 0 ? "利益" : "損失"} {man(Math.abs(curProfit))}
          </text>

          {/* 損益分岐点 */}
          {beS !== null && beS <= xMax && (
            <g>
              <line x1={x(beS)} x2={x(beS)} y1={y(beS)} y2={H - m.b} stroke="#0f172a" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={x(beS)} cy={y(beS)} r={5} fill="#0f172a" stroke="#fff" strokeWidth={2}>
                <title>{`損益分岐点売上高 ${man(beS)}`}</title>
              </circle>
              <text x={x(beS) - 8} y={y(beS) - 8} textAnchor="end" fontSize={11} fontWeight={600} fill="#0f172a">
                損益分岐点 {man(beS)}
              </text>
            </g>
          )}
        </svg>
      </div>
    </figure>
  );
}

function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = 0; t <= max + 1e-6; t += step) out.push(t);
  return out;
}
