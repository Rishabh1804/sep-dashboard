// Build a single self-contained, openable artifact of the handler PWA.
//
// `handler-demo.html` inlines the REAL handler code — the same Layer 1-7
// modules bundled as one IIFE — plus tokens/base/handler CSS. No server,
// no module loader, no build step needed to view it: double-click, or
// share the file. It runs entirely in-browser; with no Firebase wired,
// writes stay local (the honest "Not sent" path), and IndexedDB-less
// contexts (e.g. file:// in some browsers) degrade to in-session memory.
//
// Regenerate with: node scripts/build-handler-demo.mjs

import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (p) => root + p;

// 1. Bundle the real handler entry as a single IIFE (no imports/exports).
const result = await build({
  entryPoints: [R('src/handler/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  minify: true,
  logLevel: 'error',
});
const js = result.outputFiles[0].text;

// 2. Inline the CSS the handler shell needs (tokens + reset + shell).
const css = (await Promise.all([
  'src/css/tokens.css',
  'src/css/base.css',
  'src/css/handler.css',
].map((p) => readFile(R(p), 'utf8')))).join('\n');

// 3. Assemble the standalone document.
const html = `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>SEP Handler — Interactive Prototype</title>
<meta name="theme-color" content="#177a36">
<!--
  Standalone interactive prototype of the SEP notebook-handler PWA
  (Phase 2.0, Stage C). Generated from src/ by scripts/build-handler-demo.mjs
  — do not hand-edit. Data stays in this browser; nothing is synced.
-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
${css}
/* Center the phone-width app on larger screens so the artifact reads as a device. */
@media (min-width: 600px) {
  body { background: #2a2825; display: flex; align-items: flex-start; justify-content: center; padding: 24px 0; }
  .h-app { background: var(--bg); box-shadow: 0 12px 48px rgba(0,0,0,.5); border-radius: 18px; overflow: hidden; min-height: 760px; }
}
</style>
</head>
<body>
<div id="handler-root" class="h-app"></div>
<script>${js}</script>
</body>
</html>
`;

await writeFile(R('handler-demo.html'), html, 'utf8');
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
// eslint-disable-next-line no-console
console.log(`handler-demo.html written (${kb} kB, self-contained)`);
