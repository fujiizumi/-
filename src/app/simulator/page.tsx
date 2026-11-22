"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AREAS, ROOM_PRESETS, findArea } from "@/data/areas";
import { CompetitorPanel } from "@/components/CompetitorPanel";
import { ExportDialog } from "@/components/ExportDialog";
import { BreakEvenPanel } from "@/components/BreakEvenPanel";
import { MonthlyPanel } from "@/components/MonthlyPanel";
import { getQuery, isStandalone, setStoreInUrl, tryDownload } from "@/lib/env";
import { STORE_STATUSES, loadPortfolio, newStore, upsertStore, type StoreStatus } from "@/lib/portfolio";
import {
  breakEvenAnalysis,
  simulateMonthly,
  buildInputForArea,
  DEFAULT_INPUT,
  computeRequirements,
  newId,
  sensitivityMatrix,
  simulate,
  type FullTimeStaff,
  type LineItem,
  type PartTimeStaff,
  type SimulationInput,
} from "@/lib/profitSimulator";

const STORAGE_KEY = "hotel-profit-sim:current";

const yen = (v: number) => `${Math.round(v).toLocaleString()}円`;
const man = (v: number) => `${(v / 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`;
const pctText = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type FieldProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  /** 0〜1 の値を % 表示で編集する */
  percent?: boolean;
  hint?: string;
};

function Field({ label, value, onChange, unit, step = 1, percent, hint }: FieldProps) {
  const shown = percent ? +(value * 100).toFixed(2) : value;
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white focus-within:border-accent">
        <input
          type="number"
          inputMode="decimal"
          className="w-full min-w-0 rounded-md bg-transparent px-2 py-1.5 text-right text-sm tabular-nums outline-none"
          value={Number.isFinite(shown) ? shown : 0}
          step={percent ? 0.1 : step}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            const v = Number.isFinite(n) ? n : 0;
            onChange(percent ? v / 100 : v);
          }}
        />
        <span className="shrink-0 pr-2 text-xs text-slate-500">{percent ? "%" : unit}</span>
      </div>
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
        {title}
        <span className="text-slate-400 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

const GROUP_LABEL: Record<LineItem["group"], string> = {
  revenue: "売上",
  cogs: "売上原価・販売手数料",
  labor: "人件費",
  expense: "運営経費",
  model: "",
};

export default function ProfitSimulator() {
  const [input, setInput] = useState<SimulationInput>(DEFAULT_INPUT);
  const [loaded, setLoaded] = useState(false);
  const [store, setStore] = useState<{ id: string | null; name: string; status: StoreStatus; openMonth: string }>({
    id: null,
    name: "",
    status: "候補",
    openMonth: "",
  });
  const [exportText, setExportText] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [areaNotice, setAreaNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = getQuery();
    const storeId = params.get("store");
    const areaParam = findArea(params.get("area") ?? undefined);
    const roomsParam = parseInt(params.get("rooms") ?? "", 10);
    const saved = safeGet<SimulationInput>(STORAGE_KEY);
    const base = saved ? { ...DEFAULT_INPUT, ...saved } : DEFAULT_INPUT;
    const st = storeId ? loadPortfolio().stores.find((x) => x.id === storeId) : undefined;
    if (st) {
      setInput({ ...DEFAULT_INPUT, ...st.input });
      setStore({ id: st.id, name: st.name, status: st.status, openMonth: st.openMonth });
    } else if (areaParam) {
      const model = params.get("model") === "mc" ? "mc" : base.model;
      setInput(buildInputForArea(areaParam, Number.isFinite(roomsParam) ? roomsParam : base.rooms, { ...base, model }));
      setStore((p) => ({ ...p, name: `${areaParam.name} ${Number.isFinite(roomsParam) ? roomsParam : base.rooms}室` }));
    } else {
      setInput(base);
    }
    setStandalone(isStandalone());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) safeSet(STORAGE_KEY, input);
  }, [input, loaded]);

  const set = <K extends keyof SimulationInput>(key: K) => (v: SimulationInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: v }));

  const result = useMemo(() => simulate(input), [input]);
  const req = useMemo(() => computeRequirements(input), [input]);
  const be = useMemo(() => breakEvenAnalysis(input), [input]);
  const monthly = useMemo(() => simulateMonthly(input), [input]);
  const leaseResult = useMemo(() => simulate({ ...input, model: "lease" }), [input]);
  const mcResult = useMemo(() => simulate({ ...input, model: "mc" }), [input]);

  const occDeltas = [-0.15, -0.1, -0.05, 0, 0.05, 0.1];
  const adrFactors = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.2];
  const matrix = useMemo(() => sensitivityMatrix(input, occDeltas, adrFactors), [input]);

  const months = input.operatingDays / (365 / 12);
  const costLines = result.lines.filter((l) => l.group !== "revenue");
  const maxCost = Math.max(...costLines.map((l) => l.amount), 1);

  // --- staff editors ---
  const updateFt = (id: string, patch: Partial<FullTimeStaff>) =>
    setInput((p) => ({ ...p, fullTime: p.fullTime.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const updatePt = (id: string, patch: Partial<PartTimeStaff>) =>
    setInput((p) => ({ ...p, partTime: p.partTime.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const exportCsv = () => {
    const rows: (string | number)[][] = [["区分", "項目", "年間(円)", "月平均(円)", "売上比(%)", "販売1室あたり(円)"]];
    for (const l of result.lines) {
      rows.push([
        GROUP_LABEL[l.group] || (input.model === "lease" ? "賃貸方式" : "MC方式"),
        l.label,
        Math.round(l.amount),
        Math.round(l.amount / months),
        ((l.amount / result.totalRevenue) * 100).toFixed(2),
        Math.round(l.amount / result.soldRoomNights),
      ]);
    }
    rows.push(["", "GOP", Math.round(result.gop), Math.round(result.gop / months), (result.gopRate * 100).toFixed(2), ""]);
    rows.push(["", "営業利益（自社）", Math.round(result.operatingProfit), Math.round(result.operatingProfit / months), "", ""]);
    if (be.breakEvenSales !== null) rows.push(["損益分岐点", "損益分岐点売上高", Math.round(be.breakEvenSales), Math.round(be.breakEvenSales / months), "", ""]);
    if (be.targetSales !== null) rows.push(["損益分岐点", "目標利益達成売上高", Math.round(be.targetSales), Math.round(be.targetSales / months), "", ""]);
    if (be.safetyMargin !== null) rows.push(["損益分岐点", "安全余裕率(%)", (be.safetyMargin * 100).toFixed(1), "", "", ""]);
    rows.push([]);
    rows.push(["月別", "月", "稼働率(%)", "ADR(円)", "売上高(円)", "GOP(円)", "営業利益(円)", "累計営業利益(円)"]);
    for (const m of monthly.months) {
      rows.push([
        "月別",
        `${m.month}月`,
        (m.occupancy * 100).toFixed(1),
        Math.round(m.adr),
        Math.round(m.result.totalRevenue),
        Math.round(m.result.gop),
        Math.round(m.result.operatingProfit),
        Math.round(m.cumulativeProfit),
      ]);
    }
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    if (!tryDownload(csv, `hotel-profit-${input.model}.csv`, "text/csv;charset=utf-8")) setExportText(csv.replace(/^\uFEFF/, ""));
  };

  const area = findArea(input.areaId);

  const applyArea = (areaId: string, rooms: number) => {
    const a = findArea(areaId);
    if (!a) {
      setInput((p) => ({ ...p, areaId: "custom", rooms }));
      return;
    }
    setInput((p) => buildInputForArea(a, rooms, p));
    setAreaNotice(`「${a.name}・${rooms}室」の標準値（ADR・稼働率・時給・人員配置・賃料・固定費）を反映しました。各項目は個別に修正できます。`);
  };

  const saveStore = (asNew: boolean) => {
    const name = store.name.trim() || `${area?.name ?? "新規ホテル"} ${input.rooms}室`;
    const base = newStore(name, input, store.openMonth || undefined);
    const id = !asNew && store.id ? store.id : base.id;
    upsertStore({ ...base, id, status: store.status, openMonth: store.openMonth || base.openMonth });
    setStore({ id, name, status: store.status, openMonth: store.openMonth || base.openMonth });
    setStoreInUrl(id);
    setSavedMsg(`「${name}」を多店舗計画に保存しました。`);
    setTimeout(() => setSavedMsg(null), 4000);
  };

  const isLease = input.model === "lease";
  const profitLabel = isLease ? "営業利益（賃貸・自社）" : "営業利益（MC・運営会社）";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent">NEW HOTEL P&amp;L SIMULATOR</p>
          <h1 className="text-2xl font-bold sm:text-3xl">新規ホテル 収支シミュレーター</h1>
          <p className="mt-1 text-sm text-slate-600">
            賃貸方式／MC方式で、1ホテルあたり年間営業利益 {man(input.targetProfit)} 以上を出せるかを試算します。
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm print:hidden">
          <Link href="/portfolio" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
            多店舗計画を見る
          </Link>
          <button onClick={exportCsv} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
            CSV出力
          </button>
          {!standalone && (
            <button onClick={() => window.print()} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
              印刷
            </button>
          )}
          <button
            onClick={() => setInput({ ...DEFAULT_INPUT, model: input.model })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
          >
            初期値に戻す
          </button>
        </nav>
      </header>

      {/* 経営方式 */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 text-sm">
          {(["lease", "mc"] as const).map((m) => (
            <button
              key={m}
              onClick={() => set("model")(m)}
              className={`rounded-md px-4 py-1.5 font-medium ${input.model === m ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {m === "lease" ? "賃貸方式" : "MC方式"}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {isLease
            ? "建物を借りて自社でホテルを経営。売上・経費・賃料をすべて自社が負担し、残りが自社の営業利益になります。"
            : "オーナーが経営主体、自社は運営受託。ホテル収支はオーナー帰属で、自社はフィー収入（ベース＋インセンティブ）から自社負担コストを引いた額が営業利益です。"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ===== 入力 ===== */}
        <aside className="space-y-4 print:hidden">
          <Section title="出店エリア・客室数">
            <label className="block text-xs text-slate-600">
              エリア
              <select
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={input.areaId}
                onChange={(e) => applyArea(e.target.value, input.rooms)}
              >
                <option value="custom">カスタム（手入力）</option>
                {AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}（{a.prefecture}）
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 text-xs text-slate-600">客室数</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ROOM_PRESETS.map((r) => (
                <button
                  key={r}
                  onClick={() => applyArea(input.areaId, r)}
                  className={`rounded-md border px-2.5 py-1 text-sm tabular-nums ${input.rooms === r ? "border-accent bg-accent text-white" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                >
                  {r}室
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <Field label="客室数（任意の数）" value={input.rooms} onChange={set("rooms")} unit="室" />
              </div>
              <button
                onClick={() => applyArea(input.areaId, input.rooms)}
                disabled={!area}
                className="mb-0.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40"
                title="入力した客室数で、人員配置・賃料・固定費を標準値に再計算します"
              >
                規模に合わせて再計算
              </button>
            </div>
            {area && (
              <p className="mt-2 text-[11px] text-slate-500">
                エリア目安：ADR {yen(area.adr)}／稼働率 {pctText(area.occupancy, 0)}／最低賃金 {yen(area.minWage)}／賃料 {yen(area.rentPerRoomMonthly)}/室・月
              </p>
            )}
            {areaNotice && <p className="mt-2 rounded bg-blue-50 p-2 text-[11px] text-blue-800">{areaNotice}</p>}
            <p className="mt-2 text-[11px] text-slate-400">※ エリア標準値は社内検討用の仮の目安です。物件条件・競合価格・最新の最低賃金で必ず上書きしてください。</p>
          </Section>

          <Section title="目標・客室・売上">
            <div className="grid grid-cols-2 gap-3">
              <Field label="目標営業利益（年）" value={input.targetProfit} onChange={set("targetProfit")} unit="円" step={1_000_000} />
              <Field label="年間営業日数" value={input.operatingDays} onChange={set("operatingDays")} unit="日" />
              <Field label="稼働率（OCC）" value={input.occupancy} onChange={set("occupancy")} percent />
              <Field label="客室単価（ADR）" value={input.adr} onChange={set("adr")} unit="円" step={100} />
              <Field label="1室あたり平均人数" value={input.guestsPerRoom} onChange={set("guestsPerRoom")} unit="人" step={0.05} />
              <Field label="朝食単価" value={input.breakfastPrice} onChange={set("breakfastPrice")} unit="円/人" step={50} />
              <Field label="朝食喫食率" value={input.breakfastRate} onChange={set("breakfastRate")} percent />
              <Field label="その他付帯売上" value={input.otherRevenuePerRoom} onChange={set("otherRevenuePerRoom")} unit="円/室" step={10} hint="自販機・駐車場・ランドリー等" />
            </div>
            <input
              type="range"
              min={30}
              max={100}
              step={0.5}
              value={input.occupancy * 100}
              onChange={(e) => set("occupancy")(parseFloat(e.target.value) / 100)}
              className="mt-4 w-full accent-blue-600"
              aria-label="稼働率スライダー"
            />
            <input
              type="range"
              min={3000}
              max={30000}
              step={100}
              value={input.adr}
              onChange={(e) => set("adr")(parseFloat(e.target.value))}
              className="mt-2 w-full accent-blue-600"
              aria-label="客室単価スライダー"
            />
            <p className="text-[11px] text-slate-400">上：稼働率 30〜100%　下：ADR 3,000〜30,000円</p>
          </Section>

          <Section title="売上原価・販売手数料">
            <div className="grid grid-cols-2 gap-3">
              <Field label="朝食原価率" value={input.breakfastCostRate} onChange={set("breakfastCostRate")} percent />
              <Field label="付帯売上原価率" value={input.otherCostRate} onChange={set("otherCostRate")} percent />
              <Field label="OTA販売比率" value={input.otaShare} onChange={set("otaShare")} percent hint="客室売上のうちOTA経由" />
              <Field label="OTA手数料率" value={input.otaCommission} onChange={set("otaCommission")} percent />
              <Field label="決済手数料率" value={input.paymentFeeRate} onChange={set("paymentFeeRate")} percent hint="総売上に対して" />
            </div>
          </Section>

          <Section title="正社員人件費">
            <div className="space-y-3">
              {input.fullTime.map((s) => (
                <div key={s.id} className="rounded-lg bg-slate-50 p-2">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                      value={s.role}
                      onChange={(e) => updateFt(s.id, { role: e.target.value })}
                      aria-label="役職"
                    />
                    <button
                      onClick={() => setInput((p) => ({ ...p, fullTime: p.fullTime.filter((x) => x.id !== s.id) }))}
                      className="text-xs text-fall hover:underline"
                    >
                      削除
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="人数" value={s.headcount} onChange={(v) => updateFt(s.id, { headcount: v })} unit="人" />
                    <Field label="月給" value={s.monthlySalary} onChange={(v) => updateFt(s.id, { monthlySalary: v })} unit="円" step={5000} />
                    <Field label="賞与" value={s.bonusMonths} onChange={(v) => updateFt(s.id, { bonusMonths: v })} unit="か月" step={0.5} />
                    <Field label="交通費" value={s.commuteMonthly} onChange={(v) => updateFt(s.id, { commuteMonthly: v })} unit="円/月" step={1000} />
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  setInput((p) => ({
                    ...p,
                    fullTime: [...p.fullTime, { id: newId(), role: "社員", headcount: 1, monthlySalary: 240_000, bonusMonths: 2, commuteMonthly: 10_000 }],
                  }))
                }
                className="w-full rounded-md border border-dashed border-slate-300 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                ＋ 正社員を追加
              </button>
              <Field label="法定福利費率（正社員）" value={input.welfareRateFullTime} onChange={set("welfareRateFullTime")} percent hint="健保・厚年・雇用・労災・子育て拠出金の会社負担 目安15〜16%" />
            </div>
          </Section>

          <Section title="パート・アルバイト人件費（時給×労働時間）">
            <div className="space-y-3">
              {input.partTime.map((s) => (
                <div key={s.id} className="rounded-lg bg-slate-50 p-2">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                      value={s.role}
                      onChange={(e) => updatePt(s.id, { role: e.target.value })}
                      aria-label="職種"
                    />
                    <button
                      onClick={() => setInput((p) => ({ ...p, partTime: p.partTime.filter((x) => x.id !== s.id) }))}
                      className="text-xs text-fall hover:underline"
                    >
                      削除
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="人数" value={s.headcount} onChange={(v) => updatePt(s.id, { headcount: v })} unit="人" />
                    <Field label="時給" value={s.hourlyWage} onChange={(v) => updatePt(s.id, { hourlyWage: v })} unit="円" step={10} />
                    <Field label="1日労働時間" value={s.hoursPerDay} onChange={(v) => updatePt(s.id, { hoursPerDay: v })} unit="h" step={0.5} />
                    <Field label="月勤務日数" value={s.daysPerMonth} onChange={(v) => updatePt(s.id, { daysPerMonth: v })} unit="日" />
                    <Field label="交通費" value={s.commutePerDay} onChange={(v) => updatePt(s.id, { commutePerDay: v })} unit="円/日" step={50} />
                  </div>
                  <p className="mt-1 text-right text-[11px] text-slate-500">
                    月 {yen(s.headcount * s.hourlyWage * s.hoursPerDay * s.daysPerMonth)}／延べ {(s.headcount * s.hoursPerDay * s.daysPerMonth).toLocaleString()}h
                  </p>
                </div>
              ))}
              <button
                onClick={() =>
                  setInput((p) => ({
                    ...p,
                    partTime: [...p.partTime, { id: newId(), role: "パート", headcount: 1, hourlyWage: 1_100, hoursPerDay: 5, daysPerMonth: 16, commutePerDay: 400 }],
                  }))
                }
                className="w-full rounded-md border border-dashed border-slate-300 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                ＋ パートを追加
              </button>
              <div className="rounded-lg border border-slate-200 p-2">
                <p className="mb-2 text-xs font-semibold text-slate-700">客室清掃（販売室数に連動）</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="1室あたり清掃時間" value={input.cleaningHoursPerRoom} onChange={set("cleaningHoursPerRoom")} unit="h" step={0.05} />
                  <Field label="清掃 時給" value={input.cleaningHourlyWage} onChange={set("cleaningHourlyWage")} unit="円" step={10} />
                  <Field label="1人1日の勤務時間" value={input.cleaningShiftHours} onChange={set("cleaningShiftHours")} unit="h" step={0.5} />
                  <Field label="清掃 交通費" value={input.cleaningCommutePerDay} onChange={set("cleaningCommutePerDay")} unit="円/日" step={50} />
                  <Field label="清掃外注単価" value={input.cleaningOutsourcePerRoom} onChange={set("cleaningOutsourcePerRoom")} unit="円/室" step={50} hint="外注する場合（清掃時間を0に）" />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  1日あたり必要人数 約 {((result.soldRoomNights / input.operatingDays) * input.cleaningHoursPerRoom / Math.max(input.cleaningShiftHours, 0.1)).toFixed(1)} 人
                </p>
              </div>
              <Field label="法定福利費率（パート）" value={input.welfareRatePartTime} onChange={set("welfareRatePartTime")} percent hint="社保加入者の比率により調整（雇用・労災のみなら1%前後）" />
            </div>
          </Section>

          <Section title="水道光熱費・備品・リネン等">
            <div className="grid grid-cols-2 gap-3">
              <Field label="水道光熱費（変動）" value={input.utilitiesPerRoom} onChange={set("utilitiesPerRoom")} unit="円/室" step={10} />
              <Field label="水道光熱費（基本）" value={input.utilitiesFixedMonthly} onChange={set("utilitiesFixedMonthly")} unit="円/月" step={10000} />
              <Field label="備品消耗品・アメニティ" value={input.suppliesPerRoom} onChange={set("suppliesPerRoom")} unit="円/室" step={10} />
              <Field label="洗濯リネン費" value={input.linenPerRoom} onChange={set("linenPerRoom")} unit="円/室" step={10} />
              <Field label="通信・システム費" value={input.systemMonthly} onChange={set("systemMonthly")} unit="円/月" step={10000} hint="PMS・サイトコントローラー等" />
              <Field label="修繕費" value={input.repairMonthly} onChange={set("repairMonthly")} unit="円/月" step={10000} />
              <Field label="その他経費" value={input.otherFixedMonthly} onChange={set("otherFixedMonthly")} unit="円/月" step={10000} />
              <Field label="広告宣伝費率" value={input.advertisingRate} onChange={set("advertisingRate")} percent />
            </div>
          </Section>

          <Section title={isLease ? "賃貸方式の条件" : "MC方式の条件"}>
            {isLease ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="固定賃料" value={input.leaseFixedRentMonthly} onChange={set("leaseFixedRentMonthly")} unit="円/月" step={100000} />
                <Field label="変動賃料率" value={input.leaseVariableRentRate} onChange={set("leaseVariableRentRate")} percent hint="売上歩合（総売上に対して）" />
                <Field label="保険料等" value={input.leaseInsuranceMonthly} onChange={set("leaseInsuranceMonthly")} unit="円/月" step={10000} />
                <Field label="開業投資（FF&E等）" value={input.leaseInitialInvestment} onChange={set("leaseInitialInvestment")} unit="円" step={1_000_000} />
                <Field label="償却年数" value={input.leaseDepreciationYears} onChange={set("leaseDepreciationYears")} unit="年" />
                <div className="text-xs text-slate-500">
                  1室1日あたり賃料
                  <div className="mt-1 text-sm font-semibold tabular-nums text-ink">{yen(result.lease.rent / result.availableRoomNights)}</div>
                  <div>売上比 {pctText(result.lease.rent / result.totalRevenue)}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="ベースフィー率" value={input.mcBaseFeeRate} onChange={set("mcBaseFeeRate")} percent hint="総売上に対して" />
                <Field label="インセンティブフィー率" value={input.mcIncentiveFeeRate} onChange={set("mcIncentiveFeeRate")} percent hint="GOP（ベースフィー控除後）に対して" />
                <Field label="自社負担コスト" value={input.mcOperatorCostMonthly} onChange={set("mcOperatorCostMonthly")} unit="円/月" step={10000} hint="本部経費・SV・派遣人員等" />
                <Field label="オーナー負担固定費" value={input.mcOwnerFixedMonthly} onChange={set("mcOwnerFixedMonthly")} unit="円/月" step={100000} hint="固定資産税・保険・建物償却等" />
              </div>
            )}
          </Section>

          <Section title={store.id ? `多店舗計画：「${store.name}」を編集中` : "多店舗計画に保存"}>
            <div className="space-y-2">
              <label className="block text-xs text-slate-600">
                店舗名
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder={`${area?.name ?? "新規ホテル"} ${input.rooms}室`}
                  value={store.name}
                  onChange={(e) => setStore((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-slate-600">
                  ステータス
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    value={store.status}
                    onChange={(e) => setStore((p) => ({ ...p, status: e.target.value as StoreStatus }))}
                  >
                    {STORE_STATUSES.map((st) => (
                      <option key={st}>{st}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-slate-600">
                  開業予定月
                  <input
                    type="month"
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={store.openMonth}
                    onChange={(e) => setStore((p) => ({ ...p, openMonth: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => saveStore(false)} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
                  {store.id ? "上書き保存" : "多店舗計画に保存"}
                </button>
                {store.id && (
                  <button onClick={() => saveStore(true)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
                    別店舗として保存
                  </button>
                )}
              </div>
              {savedMsg && (
                <p className="text-xs text-rise">
                  ✓ {savedMsg} <Link href="/portfolio" className="underline">多店舗計画を開く</Link>
                </p>
              )}
            </div>
          </Section>
        </aside>

        {/* ===== 結果 ===== */}
        <section className="min-w-0 space-y-6">
          {/* 判定 */}
          <div
            className={`rounded-2xl border p-5 ${result.achieved ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-700">{profitLabel}</div>
                <div className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">{man(result.operatingProfit)}</div>
                <div className="mt-1 text-xs text-slate-600">
                  月平均 {man(result.operatingProfit / months)}
                  {isLease ? `売上高営業利益率 ${pctText(result.operatingProfitRate)}` : `フィー収入 ${man(result.mc.baseFee + result.mc.incentiveFee)}`}
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${result.achieved ? "bg-rise text-white" : "bg-fall text-white"}`}>
                  {result.achieved ? "✓ 目標達成" : "✗ 目標未達"}
                </div>
                <div className="mt-2 text-sm tabular-nums">
                  目標 {man(input.targetProfit)} に対して{" "}
                  <span className={result.achieved ? "text-rise" : "text-fall"}>
                    {result.targetGap >= 0 ? "+" : ""}
                    {man(result.targetGap)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg bg-white/70 p-3">
                <div className="text-xs text-slate-500">目標に必要な稼働率（ADR据置）</div>
                <div className="font-semibold tabular-nums">{req.occupancyNeeded === null ? "100%でも未達" : pctText(req.occupancyNeeded)}</div>
              </div>
              <div className="rounded-lg bg-white/70 p-3">
                <div className="text-xs text-slate-500">目標に必要なADR（稼働率据置）</div>
                <div className="font-semibold tabular-nums">{req.adrNeeded === null ? "算出不可" : yen(Math.ceil(req.adrNeeded / 10) * 10)}</div>
              </div>
              <div className="rounded-lg bg-white/70 p-3">
                <div className="text-xs text-slate-500">目標に必要なRevPAR</div>
                <div className="font-semibold tabular-nums">{req.revParNeeded === null ? "—" : yen(req.revParNeeded)}</div>
              </div>
              <div className="rounded-lg bg-white/70 p-3">
                <div className="text-xs text-slate-500">損益分岐稼働率</div>
                <div className="font-semibold tabular-nums">{req.breakEvenOccupancy === null ? "100%でも赤字" : pctText(req.breakEvenOccupancy)}</div>
              </div>
            </div>
            {!result.achieved && (
              <p className="mt-3 text-xs text-slate-700">
                あと {man(req.costReductionNeeded)}（月 {man(req.costReductionNeeded / months)}）の利益改善が必要です。
                {isLease
                  ? "ADR・稼働率の引き上げ、OTA比率の削減（自社予約強化）、清掃時間の短縮、賃料条件の見直しなどを検討してください。"
                  : "フィー率（ベース・インセンティブ）の条件交渉、GOP改善によるインセンティブ増、自社負担コストの圧縮などを検討してください。"}
              </p>
            )}
          </div>

          <BreakEvenPanel be={be} model={input.model} currentSales={result.totalRevenue} months={months} targetProfit={input.targetProfit} />

          <MonthlyPanel input={input} monthly={monthly} onSeason={(patch) => setInput((p) => ({ ...p, ...patch }))} />

          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi label="客室単価（ADR）" value={yen(result.adr)} sub="販売1室あたり" />
            <Kpi label="客単価" value={yen(result.revenuePerGuest)} sub={`朝食・付帯込み ${yen(result.totalSpendPerGuest)}`} />
            <Kpi label="稼働率" value={pctText(result.occupancy)} sub={`年間販売 ${Math.round(result.soldRoomNights).toLocaleString()}室`} />
            <Kpi label="RevPAR" value={yen(result.revPar)} sub={`TRevPAR ${yen(result.trevPar)}`} />
            <Kpi label="年間総売上" value={man(result.totalRevenue)} sub={`月 ${man(result.totalRevenue / months)}`} />
            <Kpi label="GOP" value={man(result.gop)} sub={`GOP率 ${pctText(result.gopRate)}`} />
            <Kpi label="人件費率" value={pctText(result.laborRate)} sub={`人件費計 ${man(result.laborTotal)}`} />
            <Kpi label="パート総労働時間" value={`${Math.round(result.partTimeHours).toLocaleString()}h`} sub="清掃含む・年間" />
            <Kpi label="CPOR" value={yen(result.costPerOccupiedRoom)} sub="販売1室あたり運営コスト" />
            <Kpi label="延べ宿泊者数" value={`${Math.round(result.guestNights).toLocaleString()}人`} sub="年間" />
            {isLease ? (
              <Kpi label="賃料" value={man(result.lease.rent)} sub={`売上比 ${pctText(result.lease.rent / result.totalRevenue)}`} />
            ) : (
              <Kpi label="オーナー営業利益" value={man(result.mc.ownerProfit)} sub="フィー・固定費控除後" />
            )}
            <Kpi label="販売室あたり利益" value={yen(result.operatingProfit / Math.max(result.soldRoomNights, 1))} sub="自社営業利益÷販売室" />
          </div>

          <CompetitorPanel
            lat={input.latitude}
            lng={input.longitude}
            adr={input.adr}
            marketAdr={input.marketAdr}
            onLocation={(latitude, longitude) => setInput((p) => ({ ...p, latitude, longitude }))}
            onMarketAdr={(marketAdr) => setInput((p) => ({ ...p, marketAdr }))}
            onApplyAdr={(adr) => setInput((p) => ({ ...p, adr }))}
          />

          {/* 損益計算書 */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="font-semibold">損益シミュレーション（P&amp;L）</h2>
              <span className="text-xs text-slate-500">{input.operatingDays}日・{input.rooms}室</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">項目</th>
                    <th className="px-3 py-2 text-right font-medium">年間</th>
                    <th className="px-3 py-2 text-right font-medium">月平均</th>
                    <th className="px-3 py-2 text-right font-medium">売上比</th>
                    <th className="px-3 py-2 text-right font-medium">販売1室あたり</th>
                    <th className="px-4 py-2 text-left font-medium">備考</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(["revenue", "cogs", "labor", "expense"] as const).map((g) => {
                    const items = result.lines.filter((l) => l.group === g);
                    const subtotal = items.reduce((a, b) => a + b.amount, 0);
                    return (
                      <PlGroup key={g} title={GROUP_LABEL[g]} items={items} subtotal={subtotal} total={result.totalRevenue} months={months} sold={result.soldRoomNights}>
                        {g === "cogs" && <PlRow label="売上総利益" amount={result.grossProfit} total={result.totalRevenue} months={months} sold={result.soldRoomNights} strong />}
                      </PlGroup>
                    );
                  })}
                  <PlRow label="GOP（営業総利益）" amount={result.gop} total={result.totalRevenue} months={months} sold={result.soldRoomNights} strong highlight />
                  <PlGroup
                    title={isLease ? "賃貸方式の費用" : "MC方式（オーナー側の控除）"}
                    items={result.lines.filter((l) => l.group === "model")}
                    subtotal={result.lines.filter((l) => l.group === "model").reduce((a, b) => a + b.amount, 0)}
                    total={result.totalRevenue}
                    months={months}
                    sold={result.soldRoomNights}
                  />
                  {isLease ? (
                    <PlRow label="営業利益（自社）" amount={result.lease.operatingProfit} total={result.totalRevenue} months={months} sold={result.soldRoomNights} strong highlight />
                  ) : (
                    <>
                      <PlRow label="オーナー営業利益" amount={result.mc.ownerProfit} total={result.totalRevenue} months={months} sold={result.soldRoomNights} strong />
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-slate-600">運営会社（自社）の収支</td>
                      </tr>
                      <PlRow label="フィー収入（ベース＋インセンティブ）" amount={result.mc.baseFee + result.mc.incentiveFee} total={result.totalRevenue} months={months} sold={result.soldRoomNights} />
                      <PlRow label="自社負担コスト" amount={-result.mc.operatorCost} total={result.totalRevenue} months={months} sold={result.soldRoomNights} />
                      <PlRow label="営業利益（運営会社・自社）" amount={result.mc.operatorProfit} total={result.totalRevenue} months={months} sold={result.soldRoomNights} strong highlight />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 費用構成 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">費用構成（年間・売上比）</h2>
            <p className="mb-3 text-xs text-slate-500">金額の大きい費用ほど、改善した時の利益インパクトが大きくなります。</p>
            <ul className="space-y-1.5">
              {[...costLines]
                .sort((a, b) => b.amount - a.amount)
                .filter((l) => l.amount > 0)
                .map((l) => (
                  <li key={l.key} className="grid grid-cols-[8.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs sm:grid-cols-[11rem_minmax(0,1fr)_7rem]" title={`${l.label}：${yen(l.amount)}（売上比 ${pctText(l.amount / result.totalRevenue)}）`}>
                    <span className="truncate text-slate-700">{l.label}</span>
                    <span className="h-3 rounded-r bg-slate-100">
                      <span className="block h-3 rounded-r bg-accent/80" style={{ width: `${(l.amount / maxCost) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-slate-600">
                      {man(l.amount)} <span className="text-slate-400">{pctText(l.amount / result.totalRevenue)}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          {/* 方式比較 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">賃貸方式 vs MC方式（同じ前提での比較）</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { key: "lease", title: "賃貸方式", r: leaseResult, profit: leaseResult.lease.operatingProfit, detail: `賃料 ${man(leaseResult.lease.rent)}／償却 ${man(leaseResult.lease.depreciation)}`, risk: "売上変動リスクを自社が負う。稼働が上がれば利益も大きく伸びる。" },
                { key: "mc", title: "MC方式", r: mcResult, profit: mcResult.mc.operatorProfit, detail: `ベース ${man(mcResult.mc.baseFee)}／インセンティブ ${man(mcResult.mc.incentiveFee)}`, risk: "赤字リスクはオーナー側。利益はフィー率と自社コストで決まり、上振れは限定的。" },
              ].map((c) => {
                const ok = c.profit >= input.targetProfit;
                return (
                  <button
                    key={c.key}
                    onClick={() => set("model")(c.key as SimulationInput["model"])}
                    className={`rounded-xl border p-3 text-left transition ${input.model === c.key ? "border-accent ring-1 ring-accent" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{c.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${ok ? "bg-rise" : "bg-fall"}`}>{ok ? "✓ 達成" : "✗ 未達"}</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold tabular-nums">{man(c.profit)}</div>
                    <div className="text-xs text-slate-500">{c.detail}</div>
                    <div className="mt-2 text-xs text-slate-600">{c.risk}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 感応度 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">感応度分析：稼働率 × 客室単価 → {isLease ? "営業利益（賃貸）" : "営業利益（MC・自社）"}</h2>
            <p className="mb-3 text-xs text-slate-500">
              単位：万円。<span className="font-semibold text-rise">✓</span> は目標 {man(input.targetProfit)} 以上、<span className="font-semibold text-fall">✗</span> は未達。太枠が現在の条件です。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs tabular-nums">
                <thead>
                  <tr>
                    <th className="p-1.5 text-left font-medium text-slate-500">稼働率＼ADR</th>
                    {matrix[0].cells.map((c) => (
                      <th key={c.adr} className="p-1.5 text-right font-medium text-slate-500">
                        {c.adr.toLocaleString()}円
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, ri) => (
                    <tr key={ri}>
                      <th className="p-1.5 text-left font-medium text-slate-500">{pctText(row.occupancy, 0)}</th>
                      {row.cells.map((c, ci) => {
                        const ok = c.profit >= input.targetProfit;
                        const current = occDeltas[ri] === 0 && adrFactors[ci] === 1;
                        return (
                          <td
                            key={ci}
                            title={`稼働率 ${pctText(row.occupancy)}・ADR ${yen(c.adr)} → ${man(c.profit)}`}
                            className={`border border-white p-1.5 text-right ${ok ? "bg-emerald-50 text-emerald-800" : c.profit < 0 ? "bg-red-100 text-red-800" : "bg-red-50 text-red-700"} ${current ? "outline outline-2 outline-ink" : ""}`}
                          >
                            {ok ? "✓" : "✗"} {Math.round(c.profit / 10_000).toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            ※ 本シミュレーションは概算です。法人税・借入金利息・開業前費用の一時計上・季節変動は含みません。法定福利費率・時給は地域や加入状況により異なるため、実際の条件に合わせて調整してください。
            入力内容はこのブラウザに自動保存されます。
          </p>
        </section>
      </div>

      {exportText !== null && <ExportDialog title="損益表（CSV）" content={exportText} onClose={() => setExportText(null)} />}

      {/* スマホ用：入力中も利益を常に表示 */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-lg backdrop-blur lg:hidden print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-sm">
          <span className="text-xs text-slate-500">{profitLabel}</span>
          <span className="font-bold tabular-nums">{man(result.operatingProfit)}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${result.achieved ? "bg-rise" : "bg-fall"}`}>
            {result.achieved ? "✓ 達成" : "✗ 未達"}
          </span>
        </div>
      </div>
      <div className="h-12 lg:hidden" />
    </main>
  );
}

function PlRow({
  label,
  amount,
  total,
  months,
  sold,
  strong,
  highlight,
  note,
  indent,
}: {
  label: string;
  amount: number;
  total: number;
  months: number;
  sold: number;
  strong?: boolean;
  highlight?: boolean;
  note?: string;
  indent?: boolean;
}) {
  return (
    <tr className={`border-t border-slate-100 ${highlight ? "bg-blue-50/60" : ""} ${strong ? "font-semibold" : ""}`}>
      <td className={`px-4 py-1.5 ${indent ? "pl-8 text-slate-700" : ""}`}>{label}</td>
      <td className={`px-3 py-1.5 text-right ${amount < 0 ? "text-fall" : ""}`}>{Math.round(amount).toLocaleString()}</td>
      <td className="px-3 py-1.5 text-right">{Math.round(amount / months).toLocaleString()}</td>
      <td className="px-3 py-1.5 text-right text-slate-500">{total > 0 ? pctText(amount / total) : "—"}</td>
      <td className="px-3 py-1.5 text-right text-slate-500">{sold > 0 ? Math.round(amount / sold).toLocaleString() : "—"}</td>
      <td className="px-4 py-1.5 text-xs font-normal text-slate-400">{note}</td>
    </tr>
  );
}

function PlGroup({
  title,
  items,
  subtotal,
  total,
  months,
  sold,
  children,
}: {
  title: string;
  items: LineItem[];
  subtotal: number;
  total: number;
  months: number;
  sold: number;
  children?: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold text-slate-600">
          {title}
        </td>
      </tr>
      {items.map((l) => (
        <PlRow key={l.key} label={l.label} amount={l.amount} total={total} months={months} sold={sold} note={l.note} indent />
      ))}
      <PlRow label={`${title} 計`} amount={subtotal} total={total} months={months} sold={sold} strong />
      {children}
    </>
  );
}
