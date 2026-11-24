import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ホテル レベニューマネジメント AI",
  description: "AIが競合・イベント・天候・景気・地域動向を分析し、部屋・プラン別の最適日別価格を提案します。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-paper text-ink min-h-screen">
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm">
            <span className="font-bold">Hotel × AI</span>
            <Link href="/ai-use-cases" className="text-slate-600 hover:text-accent">
              業務AI活用マップ
            </Link>
            <Link href="/" className="text-slate-600 hover:text-accent">
              価格最適化デモ
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
