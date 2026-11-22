"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AREAS, ROOM_PRESETS, findArea } from "@/data/areas";
import { DEFAULT_INPUT, buildInputForArea, simulate, type OperationModel } from "@/lib/profitSimulator";
import {
  DEFAULT_SETTINGS,
  STORE_STATUSES,
  loadPortfolio,
  minRoomsForTarget,
  newStore,
  normalizePortfolio,
  projectPortfolio,
  savePortfolio,
  type Portfolio,
  type PortfolioSettings,
  type Store,
  type StoreStatus,
} from "@/lib/portfolio";

const man = (v: number) => `${(v / 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`;
const yen = (v: number) => `${Math.round(v).toLocaleString()}円`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

const STATUS_STYLE: Record<StoreStatus, string> = {
  候補: "bg-slate-100 text-slate-700",
  交渉中: "bg-amber-100 text-amber-800",
  契約済: "bg-blue-100 text-blue-800",
  開業済: "bg-emerald-100 text-emerald-800",
};

function NumberSetting({
  label,
  value,
  onChange,
  unit,
  step = 1,
  percent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  percent?: boolean;
}) {
  const shown = percent ? +(value * 100).toFixed(1) : value;
  return (
    <label className="block text-xs text-slate-600">
      {label}
      <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white">
        <input
          type="number"
          className="w-full min-w-0 rounded-md px-2 py-1.5 text-right text-sm tabular-nums outline-none"
          value={shown}
          step={percent ? 1 : step}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            const v = Number.isFinite(n) ? n : 0;
            onChange(percent ? v / 100 : v);
          }}
        />
        <span className="pr-2 text-xs text-slate-500">{percent ? "%" : unit}</span>
      </div>
    </label>
  );
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio>({ stores: [], settings: DEFAULT_SETTINGS });
  const [loaded, setLoaded] = useState(false);
  const [areaRooms, setAreaRooms] = useState(100);
  const [areaModel, setAreaModel] = useState<OperationModel>("lease");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPortfolio(loadPortfolio());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) savePortfolio(portfolio);
  }, [portfolio, loaded]);

  const { stores, settings } = portfolio;
  const setSetting = <K extends keyof PortfolioSettings>(k: K) => (v: PortfolioSettings[K]) =>
    setPortfolio((p) => ({ ...p, settings: { ...p.settings, [k]: v } }));
  const updateStore = (id: string, patch: Partial<Store>) =>
    setPortfolio((p) => ({ ...p, stores: p.stores.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)) }));

  const rows = useMemo(
    () =>
      stores.map((s) => {
        const r = simulate(s.input);
        return { s, r, achieved: r.operatingProfit >= s.input.targetProfit };
      }),
    [stores],
  );

  const totals = useMemo(() => {
    const sum = (f: (x: (typeof rows)[number]) => number) => rows.reduce((a, x) => a + f(x), 0);
    const storeProfit = sum((x) => x.r.operatingProfit);
    const n = rows.length;
    return {
      n,
      rooms: sum((x) => x.s.input.rooms),
      revenue: sum((x) => x.r.totalRevenue),
      storeProfit,
      companyProfit: storeProfit - settings.hqAnnualCost,
      achieved: rows.filter((x) => x.achieved).length,
      investment: sum((x) => (x.s.input.model === "lease" ? x.s.input.leaseInitialInvestment : 0)),
      avgProfit: n ? storeProfit / n : 0,
      hqPerStore: n ? settings.hqAnnualCost / n : 0,
      leaseCount: rows.filter((x) => x.s.input.model === "lease").length,
    };
  }, [rows, settings.hqAnnualCost]);

  const projection = useMemo(() => projectPortfolio(portfolio), [portfolio]);
  const payback = useMemo(() => {
    const firstInv = projection.findIndex((y) => y.investment > 0);
    if (firstInv < 0) return undefined;
    return projection.find((y, i) => i >= firstInv && projection.slice(i).every((z) => z.cumulativeCash >= 0));
  }, [projection]);

  const areaRanking = useMemo(() => {
    const base = { ...DEFAULT_INPUT, model: areaModel, targetProfit: settings.targetPerStore };
    return AREAS.map((a) => {
      const input = buildInputForArea(a, areaRooms, base);
      const r = simulate(input);
      return { a, r, minRooms: minRoomsForTarget(a, base), achieved: r.operatingProfit >= base.targetProfit };
    }).sort((x, y) => y.r.operatingProfit - x.r.operatingProfit);
  }, [areaRooms, areaModel, settings.targetPerStore]);

  const duplicate = (s: Store) =>
    setPortfolio((p) => ({ ...p, stores: [...p.stores, { ...newStore(`${s.name}（コピー）`, s.input, s.openMonth), status: s.status }] }));
  const remove = (s: Store) => {
    if (confirm(`「${s.name}」を多店舗計画から削除しますか？`)) setPortfolio((p) => ({ ...p, stores: p.stores.filter((x) => x.id !== s.id) }));
  };
  const addFromArea = (areaId: string, rooms: number, model: OperationModel) => {
    const a = findArea(areaId)!;
    const input = buildInputForArea(a, rooms, { ...DEFAULT_INPUT, model, targetProfit: settings.targetPerStore });
    setPortfolio((p) => ({ ...p, stores: [...p.stores, newStore(`${a.name} ${rooms}室`, input)] }));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(portfolio, null, 2)], { type: "application/json" });
    download(blob, `hotel-portfolio-${new Date().toISOString().slice(0, 10)}.json`);
  };
  const exportCsv = () => {
    const head = ["店舗名", "ステータス", "開業予定", "エリア", "方式", "客室数", "ADR", "相場ADR", "稼働率", "RevPAR", "年間売上", "GOP", "GOP率", "営業利益", "本部費按分後", "目標", "判定"];
    const lines = rows.map(({ s, r, achieved }) => [
      s.name,
      s.status,
      s.openMonth,
      findArea(s.input.areaId)?.name ?? "カスタム",
      s.input.model === "lease" ? "賃貸" : "MC",
      s.input.rooms,
      s.input.adr,
      s.input.marketAdr ?? "",
      (r.occupancy * 100).toFixed(1),
      Math.round(r.revPar),
      Math.round(r.totalRevenue),
      Math.round(r.gop),
      (r.gopRate * 100).toFixed(1),
      Math.round(r.operatingProfit),
      Math.round(r.operatingProfit - totals.hqPerStore),
      s.input.targetProfit,
      achieved ? "達成" : "未達",
    ]);
    const csv = "﻿" + [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), "hotel-portfolio.csv");
  };
  const importJson = async (file: File) => {
    try {
      const parsed = normalizePortfolio(JSON.parse(await file.text()));
      const mode = confirm(`${parsed.stores.length}店舗を読み込みます。\nOK：現在の計画に追加　キャンセル：置き換え`);
      setPortfolio((p) => (mode ? { ...p, stores: [...p.stores, ...parsed.stores] } : parsed));
    } catch {
      alert("JSONファイルを読み込めませんでした。");
    }
  };

  const maxAbs = Math.max(1, ...projection.map((y) => Math.abs(y.companyProfit)));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent">MULTI-HOTEL EXPANSION PLAN</p>
          <h1 className="text-2xl font-bold sm:text-3xl">多店舗展開プランナー</h1>
          <p className="mt-1 text-sm text-slate-600">
            出店候補・計画中の店舗をまとめて管理し、全社の利益・投資回収・次の出店エリアを比較します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm print:hidden">
          <Link href="/simulator" className="rounded-md bg-accent px-3 py-1.5 font-medium text-white">
            ＋ 店舗を試算して追加
          </Link>
          <button onClick={exportCsv} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
            CSV出力
          </button>
          <button onClick={exportJson} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
            計画を書き出し（JSON）
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
            読み込み
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {/* 全社KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Kpi label="店舗数" value={`${totals.n}店`} sub={`賃貸${totals.leaseCount}／MC${totals.n - totals.leaseCount}`} />
        <Kpi label="総客室数" value={`${totals.rooms.toLocaleString()}室`} />
        <Kpi label="売上合計（平年度）" value={man(totals.revenue)} />
        <Kpi label="店舗営業利益合計" value={man(totals.storeProfit)} sub={`1店平均 ${man(totals.avgProfit)}`} />
        <Kpi label="本部経費" value={man(settings.hqAnnualCost)} sub={`1店あたり ${man(totals.hqPerStore)}`} />
        <Kpi label="全社営業利益" value={man(totals.companyProfit)} tone={totals.companyProfit >= 0 ? "good" : "bad"} sub="店舗利益−本部経費" />
        <Kpi
          label="目標達成店舗"
          value={`${totals.achieved}/${totals.n}店`}
          tone={totals.n && totals.achieved === totals.n ? "good" : totals.n ? "bad" : undefined}
        />
        <Kpi label="開業投資合計" value={man(totals.investment)} sub={payback ? `回収見込み ${payback.year}年` : "期間内に未回収"} />
      </div>

      {/* 店舗一覧 */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <h2 className="font-semibold">店舗一覧（平年度の試算）</h2>
          <span className="text-xs text-slate-500">店舗名をクリックすると収支シミュレーターで編集できます</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 pb-6 text-sm text-slate-500">
            まだ店舗がありません。<Link href="/simulator" className="text-accent underline">収支シミュレーター</Link>
            で試算して「多店舗計画に保存」するか、下の「エリア比較」から追加してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {["店舗", "ステータス", "開業予定", "方式", "客室", "ADR", "相場比", "稼働率", "RevPAR", "年間売上", "GOP率", "営業利益", "本部費按分後", "判定", ""].map((h, i) => (
                    <th key={i} className={`px-3 py-2 font-medium ${i >= 4 && i <= 12 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...rows]
                  .sort((a, b) => a.s.openMonth.localeCompare(b.s.openMonth))
                  .map(({ s, r, achieved }) => {
                    const mkt = s.input.marketAdr;
                    return (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Link href={`/simulator?store=${s.id}`} className="font-medium text-accent hover:underline">
                            {s.name}
                          </Link>
                          <div className="text-[11px] text-slate-400">{findArea(s.input.areaId)?.name ?? "カスタム"}</div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={s.status}
                            onChange={(e) => updateStore(s.id, { status: e.target.value as StoreStatus })}
                            className={`rounded-full border-0 px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.status]}`}
                          >
                            {STORE_STATUSES.map((st) => (
                              <option key={st}>{st}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="month"
                            value={s.openMonth}
                            onChange={(e) => updateStore(s.id, { openMonth: e.target.value })}
                            className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs">{s.input.model === "lease" ? "賃貸" : "MC"}</td>
                        <td className="px-3 py-2 text-right">{s.input.rooms}</td>
                        <td className="px-3 py-2 text-right">{yen(s.input.adr)}</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500">{mkt ? `${s.input.adr >= mkt ? "+" : ""}${((s.input.adr / mkt - 1) * 100).toFixed(0)}%` : "未取得"}</td>
                        <td className="px-3 py-2 text-right">{pct(r.occupancy)}</td>
                        <td className="px-3 py-2 text-right">{yen(r.revPar)}</td>
                        <td className="px-3 py-2 text-right">{man(r.totalRevenue)}</td>
                        <td className="px-3 py-2 text-right">{pct(r.gopRate)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{man(r.operatingProfit)}</td>
                        <td className={`px-3 py-2 text-right ${r.operatingProfit - totals.hqPerStore < 0 ? "text-fall" : ""}`}>{man(r.operatingProfit - totals.hqPerStore)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${achieved ? "bg-rise" : "bg-fall"}`}>{achieved ? "✓ 達成" : "✗ 未達"}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs">
                          <button onClick={() => duplicate(s)} className="mr-2 text-slate-600 hover:underline">
                            複製
                          </button>
                          <button onClick={() => remove(s)} className="text-fall hover:underline">
                            削除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* 前提条件 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">全社の前提条件</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <NumberSetting label="本部経費（年）" value={settings.hqAnnualCost} onChange={setSetting("hqAnnualCost")} unit="円" step={1_000_000} />
              <p className="mt-0.5 text-[11px] text-slate-400">本部人員・採用・出店開発・システム・広告等</p>
            </div>
            <NumberSetting label="開業1年目の稼働係数" value={settings.rampYear1} onChange={setSetting("rampYear1")} percent />
            <NumberSetting label="開業2年目の稼働係数" value={settings.rampYear2} onChange={setSetting("rampYear2")} percent />
            <NumberSetting label="予測開始年" value={settings.startYear} onChange={setSetting("startYear")} unit="年" />
            <NumberSetting label="予測年数" value={settings.years} onChange={(v) => setSetting("years")(Math.max(1, Math.min(15, Math.round(v))))} unit="年" />
            <div className="col-span-2">
              <NumberSetting label="1店舗あたり目標営業利益" value={settings.targetPerStore} onChange={setSetting("targetPerStore")} unit="円" step={1_000_000} />
              <p className="mt-0.5 text-[11px] text-slate-400">エリア比較の判定に使用（各店舗の判定は店舗ごとの目標）</p>
            </div>
          </div>
        </section>

        {/* 年度別予測 */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">年度別 全社収支予測</h2>
          <p className="text-xs text-slate-500">開業月から計上し、立ち上がり期は稼働率に係数をかけています。累計CFは「全社利益＋減価償却−開業投資」の概算です。</p>

          <div className="mt-4 flex h-40 items-stretch gap-2" role="img" aria-label="年度別の全社営業利益">
            {projection.map((y) => {
              const h = (Math.abs(y.companyProfit) / maxAbs) * 50;
              const pos = y.companyProfit >= 0;
              return (
                <div key={y.year} className="group relative flex flex-1 flex-col" title={`${y.year}年：全社営業利益 ${man(y.companyProfit)}（稼働${y.activeStores}店）`}>
                  <div className="relative flex-1">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-slate-300" />
                    <div
                      className={`absolute left-1/2 w-3/5 max-w-[48px] -translate-x-1/2 ${pos ? "rounded-t bg-accent" : "rounded-b bg-fall/80"}`}
                      style={pos ? { bottom: "50%", height: `${h}%` } : { top: "50%", height: `${h}%` }}
                    />
                    <span
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-slate-600"
                      style={pos ? { bottom: `calc(50% + ${h}% + 2px)` } : { top: `calc(50% + ${h}% + 2px)` }}
                    >
                      {man(y.companyProfit)}
                    </span>
                  </div>
                  <div className="pt-1 text-center text-[11px] text-slate-500">{y.year}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs tabular-nums">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["年度", "新規開業", "稼働店舗", "売上", "店舗利益", "本部経費", "全社営業利益", "開業投資", "累計CF"].map((h, i) => (
                    <th key={h} className={`px-2 py-1.5 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projection.map((y) => (
                  <tr key={y.year} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{y.year}年</td>
                    <td className="px-2 py-1.5 text-right">{y.openings}店</td>
                    <td className="px-2 py-1.5 text-right">{y.activeStores}店</td>
                    <td className="px-2 py-1.5 text-right">{man(y.revenue)}</td>
                    <td className="px-2 py-1.5 text-right">{man(y.storeProfit)}</td>
                    <td className="px-2 py-1.5 text-right">{man(y.hqCost)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${y.companyProfit < 0 ? "text-fall" : ""}`}>{man(y.companyProfit)}</td>
                    <td className="px-2 py-1.5 text-right">{man(y.investment)}</td>
                    <td className={`px-2 py-1.5 text-right ${y.cumulativeCash < 0 ? "text-fall" : "text-rise"}`}>{man(y.cumulativeCash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* エリア比較 */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">次の出店エリア比較（エリア標準値での試算）</h2>
            <p className="text-xs text-slate-500">
              同じ客室数・方式で全エリアを試算し、営業利益の高い順に並べます。「必要最小室数」は目標 {man(settings.targetPerStore)} を達成できる最小の客室数です。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={areaRooms} onChange={(e) => setAreaRooms(parseInt(e.target.value, 10))} className="rounded-md border border-slate-300 bg-white px-2 py-1.5">
              {ROOM_PRESETS.map((r) => (
                <option key={r} value={r}>
                  {r}室
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
              {(["lease", "mc"] as const).map((m) => (
                <button key={m} onClick={() => setAreaModel(m)} className={`rounded-md px-3 py-1 ${areaModel === m ? "bg-accent text-white" : "text-slate-600"}`}>
                  {m === "lease" ? "賃貸" : "MC"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm tabular-nums">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {["順位", "エリア", "ADR", "稼働率", "RevPAR", "年間売上", "GOP率", "賃料比", "営業利益", "判定", "必要最小室数", ""].map((h, i) => (
                  <th key={i} className={`px-3 py-2 font-medium ${i >= 2 && i <= 8 ? "text-right" : i === 10 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areaRanking.map(({ a, r, minRooms, achieved }, idx) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2">
                    {a.name}
                    <span className="ml-1 text-[11px] text-slate-400">{a.prefecture}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{yen(a.adr)}</td>
                  <td className="px-3 py-2 text-right">{pct(a.occupancy, 0)}</td>
                  <td className="px-3 py-2 text-right">{yen(r.revPar)}</td>
                  <td className="px-3 py-2 text-right">{man(r.totalRevenue)}</td>
                  <td className="px-3 py-2 text-right">{pct(r.gopRate)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{areaModel === "lease" ? pct(r.lease.rent / r.totalRevenue) : "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{man(r.operatingProfit)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${achieved ? "bg-rise" : "bg-fall"}`}>{achieved ? "✓ 達成" : "✗ 未達"}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{minRooms ? `${minRooms}室〜` : "400室でも未達"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    <Link href={`/simulator?area=${a.id}&rooms=${areaRooms}&model=${areaModel}`} className="mr-2 text-accent hover:underline">
                      詳細試算
                    </Link>
                    <button onClick={() => addFromArea(a.id, areaRooms, areaModel)} className="text-slate-600 hover:underline">
                      計画に追加
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          ※ エリア標準値（ADR・稼働率・賃料・最低賃金）は社内検討用の仮の目安です。実際の出店判断では「詳細試算」で競合価格を取得し、物件条件で上書きしてください。
        </p>
      </section>

      <p className="mt-6 text-[11px] text-slate-400">店舗データはこのブラウザに保存されます。チームで共有する場合は「計画を書き出し（JSON）」したファイルを渡し、「読み込み」してください。</p>
    </main>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${tone === "good" ? "text-rise" : tone === "bad" ? "text-fall" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
