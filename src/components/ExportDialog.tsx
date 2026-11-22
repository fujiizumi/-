"use client";

import { useRef, useState } from "react";

/** ダウンロードできない環境で、出力内容をコピーしてもらうためのダイアログ */
export function ExportDialog({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = () => {
    navigator.clipboard
      .writeText(content)
      .then(() => setCopied("コピーしました。メモ帳や表計算ソフトに貼り付けてください。"))
      .catch(() => {
        ref.current?.select();
        setCopied("文字を選択しました。長押し（右クリック）でコピーしてください。");
      });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            閉じる
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">このページではファイルを直接保存できないため、内容をコピーしてお使いください。</p>
        <textarea ref={ref} readOnly value={content} className="mt-3 h-64 w-full rounded-md border border-slate-300 p-2 font-mono text-xs" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button onClick={copy} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
            すべてコピー
          </button>
          {copied && <span className="text-xs text-rise">{copied}</span>}
        </div>
      </div>
    </div>
  );
}
