#!/usr/bin/env node
// Build the printable paper backup forms (ADOPTION_PLAN.md Week 0).
//
//   pnpm paper:forms            → dist/paper-forms.html
//   pnpm paper:forms -- --out X → write elsewhere
//
// The sheet is DERIVED from src/handler/forms-registry.js + i18n.js, so a
// field added to the PWA appears on paper on the next run and the parallel-
// paper reconciliation keeps measuring adoption rather than drift. Committed
// to dist/ so the forms can be opened and printed straight from the repo (or
// from GitHub Pages) without a Node install on the printing machine.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv } from 'node:process';

import { renderPaperFormsHtml, PAPER_FORMS } from '../src/handler/paper-forms.js';
import { APP_VERSION, BUILD } from '../src/shared/config/app.js';

const outArg = argv.indexOf('--out');
const out = resolve(outArg > -1 && argv[outArg + 1] ? argv[outArg + 1] : 'dist/paper-forms.html');

// Date only — a rebuild that changes nothing else should not churn the diff
// with a new timestamp on every run.
const generatedOn = new Date().toISOString().slice(0, 10);
const html = renderPaperFormsHtml({ stamp: `${APP_VERSION} build ${BUILD}`, generatedOn });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html, 'utf-8');

const sheets = PAPER_FORMS.map((f) => `${f.id} (${f.layout} ×${f.repeat})`).join(', ');
console.log(`paper-forms → ${out}`);
console.log(`  ${PAPER_FORMS.length} sheets: ${sheets}`);
console.log(`  ${(html.length / 1024).toFixed(1)} kB · ${APP_VERSION} build ${BUILD}`);
