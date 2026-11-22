import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "ホテル多店舗展開・収支シミュレーター",
  description: "新規ホテルの収支シミュレーション（賃貸・MC方式）、周辺競合価格の自動取得、多店舗展開計画、レベニューマネジメント。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-paper text-ink min-h-screen">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
