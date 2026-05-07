// esbuild build config for the SEP Dashboard monorepo.
//
// Produces two PWA bundles per the N-PWA topology in
// docs/architecture/DEPLOY_TOPOLOGY.md:
//   - dist/dashboard.js  — main dashboard (Layers 1-7, all tabs)
//   - dist/handler.js    — handler PWA stub (Phase 2.0; full forms in Stage C-D)
//
// Adding a new role-app is a one-line entry-point change here.

import { build, context } from 'esbuild';
import { argv } from 'node:process';

const watch = argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  format: 'esm',
  target: ['es2020'],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  outdir: 'dist',
  splitting: true,
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
};

const opts = {
  ...common,
  entryPoints: {
    dashboard: 'src/dashboard/main.js',
    handler: 'src/handler/main.js',
  },
};

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
  // eslint-disable-next-line no-console
  console.log('[esbuild] watching…');
} else {
  await build(opts);
}
