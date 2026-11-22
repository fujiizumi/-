"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isStandalone } from "@/lib/env";

const LINKS = [
  { href: "/portfolio", label: "多店舗展開" },
  { href: "/simulator", label: "収支シミュレーター" },
  { href: "/", label: "価格ダッシュボード" },
];

export function SiteNav() {
  const path = usePathname();
  const [standalone, setStandalone] = useState(false);
  useEffect(() => setStandalone(isStandalone()), []);
  const links = standalone ? LINKS.filter((l) => l.href !== "/") : LINKS;
  return (
    <nav className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
        <span className="mr-3 shrink-0 font-bold text-ink">Hotel Expansion</span>
        {links.map((l) => {
          const active = l.href === "/" ? path === "/" : path?.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-md px-3 py-1.5 ${active ? "bg-accent/10 font-semibold text-accent" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
