"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DEPARTMENTS,
  LEVEL_LABEL,
  USE_CASES,
  priorityScore,
  type Level,
  type UseCase,
} from "@/data/aiUseCases";

type SortKey = "priority" | "impact" | "easy";

const deptName = (id: string) => DEPARTMENTS.find((d) => d.id === id)?.name ?? id;

export default function UseCaseExplorer() {
  const [dept, setDept] = useState<string>("all");
  const [maxDifficulty, setMaxDifficulty] = useState<Level>(3);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("priority");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = USE_CASES.filter(
      (u) =>
        (dept === "all" || u.departmentId === dept) &&
        u.difficulty <= maxDifficulty &&
        (!q || [u.title, u.pain, u.solution, u.tools].join(" ").toLowerCase().includes(q)),
    );
    const sorters: Record<SortKey, (a: UseCase, b: UseCase) => number> = {
      priority: (a, b) => priorityScore(b) - priorityScore(a),
      impact: (a, b) => b.impact - a.impact || a.difficulty - b.difficulty,
      easy: (a, b) => a.difficulty - b.difficulty || b.impact - a.impact,
    };
    return [...list].sort(sorters[sort]);
  }, [dept, maxDifficulty, query, sort]);

  const countByDept = (id: string) => USE_CASES.filter((u) => u.departmentId === id).length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="部門">
        <DeptChip active={dept === "all"} onClick={() => setDept("all")}>
          すべて（{USE_CASES.length}）
        </DeptChip>
        {DEPARTMENTS.map((d) => (
          <DeptChip key={d.id} active={dept === d.id} onClick={() => setDept(d.id)} title={d.summary}>
            {d.name}（{countByDept(d.id)}）
          </DeptChip>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col text-sm">
          キーワード検索
          <input
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="例：予測、口コミ、シフト"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-sm">
          導入難易度
          <select
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={maxDifficulty}
            onChange={(e) => setMaxDifficulty(Number(e.target.value) as Level)}
          >
            <option value={3}>すべて</option>
            <option value={2}>中以下</option>
            <option value={1}>低のみ（すぐ始められる）</option>
          </select>
        </label>
        <label className="flex flex-col text-sm">
          並び順
          <select
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="priority">おすすめ順（効果÷難易度）</option>
            <option value="impact">効果が大きい順</option>
            <option value="easy">始めやすい順</option>
          </select>
        </label>
      </div>

      <p className="mb-3 text-sm text-slate-500">{filtered.length}件の業務が該当</p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          条件に合う業務がありません。絞り込みを緩めてください。
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((u) => (
            <UseCaseCard key={u.id} u={u} />
          ))}
        </div>
      )}
    </section>
  );
}

function DeptChip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-accent bg-accent text-white"
          : "border-slate-300 bg-white text-slate-700 hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function UseCaseCard({ u }: { u: UseCase }) {
  return (
    <article id={u.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-accent">{deptName(u.departmentId)}</p>
      <h3 className="mt-1 text-base font-bold leading-snug">{u.title}</h3>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <Meter label="効果" level={u.impact} tone="rise" />
        <Meter label="難易度" level={u.difficulty} tone="slate" />
        {u.demoHref && (
          <Link href={u.demoHref} className="rounded bg-accent/10 px-2 py-0.5 font-medium text-accent hover:underline">
            ▶ デモあり
          </Link>
        )}
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-semibold text-slate-500">現状の課題</dt>
          <dd className="text-slate-700">{u.pain}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">AIでの効率化</dt>
          <dd className="text-slate-800">{u.solution}</dd>
        </div>
        <div className="rounded-md bg-rise/5 px-3 py-2">
          <dt className="text-xs font-semibold text-rise">期待効果（目安）</dt>
          <dd className="font-medium text-ink">{u.effect}</dd>
        </div>
      </dl>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-accent">
          必要なデータ・導入手段{u.caution ? "・注意点" : ""}
        </summary>
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {u.dataNeeded.map((d) => (
              <span key={d} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {d}
              </span>
            ))}
          </div>
          <p className="text-slate-700">
            <span className="text-xs font-semibold text-slate-500">導入手段：</span>
            {u.tools}
          </p>
          {u.caution && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              <span className="text-xs font-semibold">注意：</span>
              {u.caution}
            </p>
          )}
        </div>
      </details>
    </article>
  );
}

function Meter({ label, level, tone }: { label: string; level: Level; tone: "rise" | "slate" }) {
  const on = tone === "rise" ? "bg-rise" : "bg-slate-600";
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-slate-600">
      {label}
      <span className="inline-flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i <= level ? on : "bg-slate-200"}`} />
        ))}
      </span>
      <span className="font-medium text-ink">{LEVEL_LABEL[level]}</span>
    </span>
  );
}
