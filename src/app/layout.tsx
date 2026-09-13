import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ホテル レベニューマネジメント AI",
  description: "AIが競合・イベント・天候・景気・地域動向を分析し、部屋・プラン別の最適日別価格を提案します。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-paper text-ink min-h-screen">{children}</body>
    </html>
  );
}
