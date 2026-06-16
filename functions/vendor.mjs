#!/usr/bin/env node
// Vendor the pure shared logic into functions/ so `firebase deploy` (which
// bundles ONLY functions/) ships it. The Firestore-trigger logic stays pure +
// unit-tested in src/shared/validation/cross-doc.js (root Jest); this copies it
// verbatim behind a GENERATED banner. Wired to firebase.json's predeploy so the
// deployed artifact is always fresh; vendor/ is gitignored (never committed) so
// there is no second copy to drift from the source. Run by `functions lint` too.
//
// Usage: node functions/vendor.mjs   (run from repo root or functions/)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// [source relative to functions/, destination relative to functions/]. cross-doc
// imports nothing, so a single-file copy is the whole vendor surface; add rows
// here if a vendored module ever grows a dependency.
const SOURCES = [
  ['../src/shared/validation/cross-doc.js', 'vendor/cross-doc.js'],
];

const BANNER =
  '// GENERATED — do not edit. Vendored from src/shared/validation/cross-doc.js\n'
  + '// by functions/vendor.mjs (firebase.json predeploy). Edit the source, not this.\n\n';

for (const [src, dst] of SOURCES) {
  const body = readFileSync(join(here, src), 'utf8');
  const out = join(here, dst);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, BANNER + body);
  console.log(`vendored ${src} → functions/${dst}`);
}
