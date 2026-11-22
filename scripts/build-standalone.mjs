// 収支シミュレーターと多店舗展開プランナーを、サーバー不要の単一HTMLにまとめる。
// 使い方: npm run build:standalone  →  dist/hotel-expansion.html
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shim = (p) => path.join(root, "standalone/shims", p);
mkdirSync(path.join(root, "dist"), { recursive: true });

const result = await build({
  entryPoints: [path.join(root, "standalone/main.tsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  target: "es2019",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    "@": path.join(root, "src"),
    react: shim("react.ts"),
    "react/jsx-runtime": shim("jsx-runtime.ts"),
    "react-dom/client": shim("react-dom-client.ts"),
    "next/link": shim("next-link.tsx"),
    "next/navigation": shim("next-navigation.ts"),
  },
  tsconfig: path.join(root, "tsconfig.json"),
});
const js = result.outputFiles[0].text;

const cssOut = path.join(root, "dist/standalone.css");
execFileSync(
  path.join(root, "node_modules/.bin/tailwindcss"),
  ["-c", path.join(root, "tailwind.config.ts"), "-i", path.join(root, "src/app/globals.css"), "-o", cssOut, "--minify", "--content", "./src/**/*.{ts,tsx},./standalone/**/*.{ts,tsx}"],
  { cwd: root, stdio: "inherit" },
);
const css = readFileSync(cssOut, "utf8");

const html = `<title>ホテル出店シミュレーター</title>
<style>${css}
body{background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
</style>
<div id="app"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>window.__HOTEL_STANDALONE__=true;</script>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
`;
writeFileSync(path.join(root, "dist/hotel-expansion.html"), html);
console.log(`dist/hotel-expansion.html  ${(html.length / 1024).toFixed(0)} KB`);
