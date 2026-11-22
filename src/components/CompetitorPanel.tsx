"use client";

import { useEffect, useMemo, useState } from "react";
import { build, type Competitor, type CompetitorResponse } from "@/lib/competitorsCore";
import { loadCompetitors } from "@/lib/env";

const TAX = 1.1;
const yen = (v: number) => `${Math.round(v).toLocaleString()}円`;

/** today から minDaysAhead 日以上先の、指定曜日の日付（YYYY-MM-DD） */
function nextDow(dow: number, minDaysAhead = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + minDaysAhead);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Props = {
  lat: number;
  lng: number;
  adr: number;
  marketAdr: number | null;
  onLocation: (lat: number, lng: number) => void;
  onMarketAdr: (v: number | null) => void;
  onApplyAdr: (adr: number) => void;
};

export function CompetitorPanel({ lat, lng, adr, marketAdr, onLocation, onMarketAdr, onApplyAdr }: Props) {
  const [radius, setRadius] = useState(1);
  const [weekday, setWeekday] = useState("");
  const [weekend, setWeekend] = useState("");
  const [data, setData] = useState<{ weekday: CompetitorResponse; weekend: CompetitorResponse } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyPct, setApplyPct] = useState(100);
  const [showAll, setShowAll] = useState(false);
  const [latText, setLatText] = useState(String(lat));
  const [lngText, setLngText] = useState(String(lng));
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  /** 「ホテル名, 平日料金, 休前日料金」を1行1軒で読み取る */
  const applyManual = () => {
    const wdList: Competitor[] = [];
    const weList: Competitor[] = [];
    const bad: number[] = [];
    manualText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, i) => {
        const cols = line.split(/[,，\t]/).map((c) => c.trim());
        const num = (v?: string) => {
          const n = parseFloat((v ?? "").replace(/[円¥,\s]/g, ""));
          return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
        };
        const name = cols[0];
        const wd = num(cols[1]);
        const we = num(cols[2]);
        if (!name || (!wd && !we)) {
          bad.push(i + 1);
          return;
        }
        const base = { id: `m${i}`, name, distanceKm: null, rating: null, station: null, url: null };
        if (wd) wdList.push({ ...base, price: wd });
        if (we) weList.push({ ...base, price: we });
      });
    if (wdList.length + weList.length === 0) {
      setManualError("読み取れる行がありません。「ホテル名, 平日料金, 休前日料金」の形で1行に1軒ずつ入力してください。");
      return;
    }
    setManualError(bad.length ? `${bad.join("・")}行目は読み取れなかったため除外しました。` : null);
    const q = { lat, lng, radiusKm: radius, refAdr: adr };
    const wd = build("manual", { ...q, checkinDate: weekday || "平日" }, wdList);
    const we = build("manual", { ...q, checkinDate: weekend || "休前日" }, weList);
    setData({ weekday: wd, weekend: we });
    onMarketAdr(estimateMarketAdr(wd, we));
  };

  useEffect(() => {
    setWeekday(nextDow(3)); // 水曜
    setWeekend(nextDow(6)); // 土曜
  }, []);
  useEffect(() => {
    setLatText(String(lat));
    setLngText(String(lng));
    setData(null);
  }, [lat, lng]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = (d: string) => loadCompetitors({ lat, lng, radius, radiusKm: radius, checkinDate: d, refAdr: adr });
      const [wd, we] = await Promise.all([q(weekday), q(weekend)]);
      setData({ weekday: wd, weekend: we });
      const m = estimateMarketAdr(wd, we);
      onMarketAdr(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { c: Competitor; wd?: number; we?: number }>();
    for (const c of data.weekday.hotels) map.set(c.id, { c, wd: c.price });
    for (const c of data.weekend.hotels) {
      const prev = map.get(c.id);
      if (prev) prev.we = c.price;
      else map.set(c.id, { c, we: c.price });
    }
    return [...map.values()].sort((a, b) => (a.c.distanceKm ?? 99) - (b.c.distanceKm ?? 99));
  }, [data]);

  const ownTaxIncl = adr * TAX;
  const gap = marketAdr ? adr / marketAdr - 1 : null;
  const source = data?.weekday.source;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">周辺競合ホテルの価格比較</h2>
        {source && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${source === "rakuten" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
          >
            {source === "rakuten" ? "● 楽天トラベル 実データ" : source === "manual" ? "● 手入力データ" : "▲ デモデータ"}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        物件の所在地から半径内で販売中の「1名1室・最安プラン（税込）」を、平日と休前日で自動取得します。
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
        <label className="text-xs text-slate-600 sm:col-span-1">
          緯度
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
            value={latText}
            onChange={(e) => setLatText(e.target.value)}
            onBlur={() => {
              const v = parseFloat(latText);
              if (Number.isFinite(v)) onLocation(v, lng);
            }}
          />
        </label>
        <label className="text-xs text-slate-600 sm:col-span-1">
          経度
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
            value={lngText}
            onChange={(e) => setLngText(e.target.value)}
            onBlur={() => {
              const v = parseFloat(lngText);
              if (Number.isFinite(v)) onLocation(lat, v);
            }}
          />
        </label>
        <label className="text-xs text-slate-600">
          半径
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
          >
            {[0.5, 1, 2, 3].map((r) => (
              <option key={r} value={r}>
                {r}km
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          平日（宿泊日）
          <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={weekday} onChange={(e) => setWeekday(e.target.value)} />
        </label>
        <label className="text-xs text-slate-600">
          休前日（宿泊日）
          <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={weekend} onChange={(e) => setWeekend(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button
            onClick={fetchAll}
            disabled={loading || !weekday || !weekend}
            className="w-full rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "取得中…" : "競合価格を取得"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">緯度・経度はGoogleマップで物件を右クリックすると確認できます。エリアを選ぶと代表地点が入ります。</p>

      <div className="mt-3">
        <button onClick={() => setManualOpen((v) => !v)} className="text-xs text-accent hover:underline">
          {manualOpen ? "▾ 手入力を閉じる" : "▸ 競合の料金を手入力する（OTAで調べた価格など）"}
        </button>
        {manualOpen && (
          <div className="mt-2 rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-600">1行に1軒、「ホテル名, 平日料金, 休前日料金」（税込・1名1室）を入力してください。料金は片方だけでも構いません。</p>
            <textarea
              id="manual-competitors"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={"ホテルA, 9800, 13500\nホテルB, 8600, 11000\nホテルC, 12000"}
              className="mt-2 h-32 w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
            />
            <button onClick={applyManual} className="mt-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
              手入力の価格で比較
            </button>
            {manualError && <p className="mt-2 text-xs text-amber-800">{manualError}</p>}
          </div>
        )}
      </div>

      {error && <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700">取得エラー：{error}</p>}
      {data?.weekday.message && <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">{data.weekday.message}</p>}

      {data && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title={`平日 ${data.weekday.checkinDate}`} res={data.weekday} />
            <StatCard title={`休前日 ${data.weekend.checkinDate}`} res={data.weekend} />
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">相場ADR（税抜換算）</div>
              <div className="mt-1 text-lg font-bold tabular-nums">{marketAdr ? yen(marketAdr) : "—"}</div>
              <div className="text-[11px] text-slate-400">平日5：休前日2で加重した中央値÷1.1</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">自社ADR vs 相場</div>
              <div className={`mt-1 text-lg font-bold tabular-nums ${gap === null ? "" : gap > 0.1 ? "text-fall" : gap < -0.1 ? "text-amber-700" : "text-rise"}`}>
                {gap === null ? "—" : `${gap >= 0 ? "+" : ""}${(gap * 100).toFixed(1)}%`}
              </div>
              <div className="text-[11px] text-slate-400">
                {gap === null ? "" : gap > 0.1 ? "▲ 相場より高め：稼働率の想定が強気かも" : gap < -0.1 ? "▼ 相場より安め：単価アップ余地あり" : "● 相場並み"}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <PriceStrip label="平日" res={data.weekday} own={ownTaxIncl} />
            <PriceStrip label="休前日" res={data.weekend} own={ownTaxIncl} />
            <p className="text-[11px] text-slate-500">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400 align-middle" />競合（税込）
              <span className="mr-1 inline-block h-3 w-0.5 bg-accent align-middle" />自社ADR（税込換算 {yen(ownTaxIncl)}）
              <span className="mr-1 inline-block h-2 w-4 rounded bg-slate-200 align-middle" />中央50%の価格帯
            </p>
          </div>

          {marketAdr && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm">
              <span>相場ADRの</span>
              <input
                type="number"
                className="w-20 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                value={applyPct}
                onChange={(e) => setApplyPct(parseFloat(e.target.value) || 0)}
              />
              <span>% = {yen(Math.round((marketAdr * applyPct) / 100 / 100) * 100)}</span>
              <button
                onClick={() => onApplyAdr(Math.round((marketAdr * applyPct) / 100 / 100) * 100)}
                className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-white"
              >
                自社ADRに反映
              </button>
              <span className="text-xs text-slate-500">新規開業は相場の90〜100%からの設定が一般的です。</span>
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">ホテル名</th>
                  <th className="px-2 py-1.5 text-right font-medium">距離</th>
                  <th className="px-2 py-1.5 text-right font-medium">評価</th>
                  <th className="px-2 py-1.5 text-right font-medium">平日（税込）</th>
                  <th className="px-2 py-1.5 text-right font-medium">休前日（税込）</th>
                  <th className="px-2 py-1.5 text-right font-medium">自社比（平日）</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(showAll ? rows : rows.slice(0, 15)).map(({ c, wd, we }) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="max-w-[16rem] truncate px-2 py-1.5">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          {c.name}
                        </a>
                      ) : (
                        c.name
                      )}
                      {c.station && <span className="ml-1 text-slate-400">{c.station}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">{c.distanceKm != null ? `${c.distanceKm.toFixed(2)}km` : "—"}</td>
                    <td className="px-2 py-1.5 text-right">{c.rating?.toFixed(2) ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right">{wd ? yen(wd) : "満室/販売なし"}</td>
                    <td className="px-2 py-1.5 text-right">{we ? yen(we) : "満室/販売なし"}</td>
                    <td className="px-2 py-1.5 text-right text-slate-500">{wd ? `${((ownTaxIncl / wd - 1) * 100).toFixed(0)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 15 && (
              <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-accent hover:underline">
                {showAll ? "上位15件のみ表示" : `すべて表示（${rows.length}件）`}
              </button>
            )}
            {rows.length === 0 && <p className="py-3 text-center text-xs text-slate-500">該当する販売中のホテルがありませんでした。半径や日付を変えてください。</p>}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            取得日時 {new Date(data.weekday.fetchedAt).toLocaleString("ja-JP")}。満室のホテルは表示されないため、高需要日は相場が低めに出ることがあります。
          </p>
        </>
      )}
    </div>
  );
}

export function estimateMarketAdr(wd: CompetitorResponse, we: CompetitorResponse): number | null {
  const a = wd.stats?.median;
  const b = we.stats?.median;
  if (!a && !b) return null;
  const mix = a && b ? (a * 5 + b * 2) / 7 : (a ?? b)!;
  return Math.round(mix / TAX / 10) * 10;
}

function StatCard({ title, res }: { title: string; res: CompetitorResponse }) {
  const s = res.stats;
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{s ? yen(s.median) : "—"}</div>
      <div className="text-[11px] text-slate-400">{s ? `中央値・${s.count}軒（${yen(s.min)}〜${yen(s.max)}）` : "販売中のホテルなし"}</div>
    </div>
  );
}

function PriceStrip({ label, res, own }: { label: string; res: CompetitorResponse; own: number }) {
  const s = res.stats;
  if (!s) return null;
  const lo = Math.min(s.min, own) * 0.95;
  const hi = Math.max(s.max, own) * 1.05;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 text-xs">
      <span className="text-slate-600">{label}</span>
      <div>
        <div className="relative h-7">
          <div className="absolute top-1/2 h-px w-full bg-slate-200" />
          <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded bg-slate-200" style={{ left: x(s.p25), width: `calc(${x(s.p75)} - ${x(s.p25)})` }} />
          {res.hotels.map((h) => (
            <span
              key={h.id}
              title={`${h.name}：${yen(h.price)}`}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 ring-2 ring-white hover:bg-slate-700"
              style={{ left: x(h.price) }}
            />
          ))}
          <span className="absolute top-0 h-7 w-0.5 -translate-x-1/2 bg-accent" style={{ left: x(own) }} title={`自社ADR（税込換算）：${yen(own)}`} />
        </div>
        <div className="flex justify-between text-[10px] tabular-nums text-slate-400">
          <span>{yen(s.min)}</span>
          <span>中央値 {yen(s.median)}</span>
          <span>{yen(s.max)}</span>
        </div>
      </div>
    </div>
  );
}
