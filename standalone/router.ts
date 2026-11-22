// 公開版のページ内ルーター。#simulator / #portfolio の素のハッシュだけを使う。
import { useSyncExternalStore } from "react";

export type Route = "simulator" | "portfolio";
const listeners = new Set<() => void>();
let version = 0;

const fromHash = (): Route => (window.location.hash === "#portfolio" ? "portfolio" : "simulator");
let route: Route = fromHash();

window.addEventListener("hashchange", () => {
  const next = fromHash();
  if (next !== route) {
    route = next;
    (window as unknown as { __HOTEL_QUERY__?: string }).__HOTEL_QUERY__ = "";
    version++;
    listeners.forEach((l) => l());
  }
});

export function navigate(href: string) {
  const [path, query = ""] = href.split("?");
  const next: Route = path.startsWith("/portfolio") ? "portfolio" : "simulator";
  (window as unknown as { __HOTEL_QUERY__?: string }).__HOTEL_QUERY__ = query;
  route = next;
  version++;
  if (window.location.hash !== `#${next}`) {
    try {
      history.replaceState(null, "", `#${next}`);
    } catch {
      /* ignore */
    }
  }
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useRoute = () => useSyncExternalStore(subscribe, () => `${route}:${version}`);
export const currentRoute = () => route;
