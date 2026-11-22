/**
 * サーバー版（Next.js）と公開版（単一HTMLの静的ページ）で挙動を切り替えるためのヘルパー。
 * 公開版では window.__HOTEL_STANDALONE__ = true が設定されます。
 */
import { build, demoCompetitors, type CompetitorQuery, type CompetitorResponse } from "./competitorsCore";

type StandaloneWindow = Window & { __HOTEL_STANDALONE__?: boolean; __HOTEL_QUERY__?: string };

export const isStandalone = () => typeof window !== "undefined" && !!(window as StandaloneWindow).__HOTEL_STANDALONE__;

/** 現在のページのクエリ（公開版ではページ内ルーターが保持） */
export function getQuery(): URLSearchParams {
  if (isStandalone()) return new URLSearchParams((window as StandaloneWindow).__HOTEL_QUERY__ ?? "");
  return new URLSearchParams(window.location.search);
}

/** 編集中の店舗IDをURLに反映（公開版ではURLを変えない） */
export function setStoreInUrl(id: string) {
  if (isStandalone()) {
    (window as StandaloneWindow).__HOTEL_QUERY__ = `store=${id}`;
    return;
  }
  window.history.replaceState(null, "", `/simulator?store=${id}`);
}

/** 競合価格の取得。サーバー版はAPI、公開版はデモデータ */
export async function loadCompetitors(q: CompetitorQuery & { radius: number }): Promise<CompetitorResponse> {
  if (isStandalone()) {
    return build(
      "demo",
      q,
      demoCompetitors(q),
      "公開版のページからは外部サイトに接続できないため、デモデータを表示しています。実際の価格は「手入力」で登録するか、サーバー版（楽天トラベルAPI連携）で取得してください。",
    );
  }
  const params = new URLSearchParams({
    lat: String(q.lat),
    lng: String(q.lng),
    radius: String(q.radius),
    checkin: q.checkinDate,
    refAdr: String(q.refAdr),
  });
  const r = await fetch(`/api/competitors?${params}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j as CompetitorResponse;
}

/**
 * ファイル出力。サーバー版はダウンロード、公開版（ダウンロード不可）は false を返すので、
 * 呼び出し側で内容をコピーできる画面を出す。
 */
export function tryDownload(content: string, filename: string, type: string): boolean {
  if (isStandalone()) return false;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
