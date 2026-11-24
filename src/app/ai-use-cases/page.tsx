import type { Metadata } from "next";
import { DEPARTMENTS, ROADMAP, USE_CASES } from "@/data/aiUseCases";
import UseCaseExplorer from "./UseCaseExplorer";

export const metadata: Metadata = {
  title: "ホテル業務 AI活用マップ",
  description: "ホテル経営の各業務のうち、AIで効率化できるものを部門別に整理し、効果・難易度・導入ステップとともに紹介します。",
};

const titleOf = (id: string) => USE_CASES.find((u) => u.id === id)?.title ?? id;

export default function AiUseCasesPage() {
  const quickWins = USE_CASES.filter((u) => u.impact >= 2 && u.difficulty === 1).length;
  const highImpact = USE_CASES.filter((u) => u.impact === 3).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm text-slate-500">ホテル経営 × AI</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">ホテル業務 AI活用マップ</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          フロント、レベニュー、マーケティング、清掃、料飲、設備、バックオフィス、経営管理まで、
          ホテル運営の業務ごとに「どこで時間がかかっているか」「AIで何ができるか」「どれくらい効果があるか」を整理しました。
          効果と導入難易度で絞り込み、自館で取り組む順番を検討できます。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="掲載業務" value={`${USE_CASES.length}件`} />
          <Stat label="対象部門" value={`${DEPARTMENTS.length}部門`} />
          <Stat label="効果が大きい業務" value={`${highImpact}件`} />
          <Stat label="すぐ始められる業務" value={`${quickWins}件`} />
        </div>
      </header>

      <UseCaseExplorer />

      <section className="mt-12">
        <h2 className="text-xl font-bold">導入ロードマップ（おすすめの進め方）</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          一度にすべてを導入する必要はありません。システム連携が不要な生成AI活用から始め、
          データが整ってきたら予測・最適化系へ広げるのが失敗しにくい順番です。
        </p>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {ROADMAP.map((step) => (
            <li key={step.phase} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-accent">{step.phase}</p>
              <h3 className="mt-1 font-bold">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{step.description}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {step.ids.map((id) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-slate-800 hover:text-accent hover:underline">
                      ・{titleOf(id)}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">導入時に共通して気をつけること</h2>
        <ul className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <li>
            <strong className="text-ink">個人情報の取り扱い：</strong>
            宿泊者情報を外部AIサービスに入力する場合は、利用規約（学習に使われないか）と個人情報保護法上の委託・第三者提供の整理を確認する。
          </li>
          <li>
            <strong className="text-ink">人による最終確認：</strong>
            料金・規約・アレルギーなど誤りが許されない情報は、AIの出力をそのまま顧客に出さず、確認フローを設ける。
          </li>
          <li>
            <strong className="text-ink">データの整備が先：</strong>
            予測・最適化系の効果はPMSや予約データの品質で決まる。部屋タイプやプランのコード統一から始める。
          </li>
          <li>
            <strong className="text-ink">効果測定：</strong>
            導入前に「作業時間」「RevPAR」「口コミスコア」など指標を決めて計測し、効果が出たものから横展開する。
          </li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          ※ 期待効果の数値は一般的な導入事例から見た目安であり、ホテルの規模・業態・既存システムによって異なります。
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
