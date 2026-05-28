// ESLint flat config — enforces the 7-layer import rule from the
// Phase 2 charter (Charter Decision 5 / PHASE_2_AUDIT.md):
//
//   Layer 1: src/shared/utils/        — pure helpers, no src/ imports.
//   Layer 3: src/shared/config/       — static defaults, no src/ imports.
//   Layer 2: src/shared/storage/      — may import utils + config.
//   Layer 4: src/components/          — may import shared/* (1–3).
//   Layer 5: src/dashboard/tabs/      — may import 1–4 + same-layer.
//   Layer 7: src/dashboard/main.js,   — may import anything below.
//            src/handler/main.js
//
// utils + config are both leaves: each imports nothing, and any higher
// layer may import from them. The audit's "Layer 3" label for config
// is a documentation grouping, not strict topological ordering — the
// dependency graph treats utils and config as siblings.
//
// Same-layer imports are allowed (production.js → home.js, etc. — the
// existing pattern noted in CLAUDE.md). The valuable invariant is "no
// upward imports": shared/* must never reach into components/ or
// dashboard/ or handler/, since those depend on shared/. Violations
// fail `pnpm lint` and CI.

import importX from 'eslint-plugin-import-x';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'tests/e2e/.playwright/**',
      'coverage/**',
    ],
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: { 'import-x': importX },
    rules: {
      'import-x/no-restricted-paths': ['error', {
        zones: [
          // Layer 1 (utils) — pure, no other src/ imports allowed.
          {
            target: './src/shared/utils',
            from: [
              './src/shared/storage',
              './src/shared/config',
              './src/components',
              './src/dashboard',
              './src/handler',
            ],
            message: 'Layer 1 (utils) must not import from any other layer.',
          },
          // Layer 2 (storage) — may import utils + config (both leaves);
          // never UI layers above.
          {
            target: './src/shared/storage',
            from: [
              './src/components',
              './src/dashboard',
              './src/handler',
            ],
            message: 'Layer 2 (storage) must not import from UI layers (components, dashboard, handler).',
          },
          // Layer 3 (config) — static data, no src/ imports.
          {
            target: './src/shared/config',
            from: [
              './src/shared/utils',
              './src/shared/storage',
              './src/components',
              './src/dashboard',
              './src/handler',
            ],
            message: 'Layer 3 (config) is static data and must not import from any other layer.',
          },
          // Layer 4 (components) — may import shared/* (1–3); never UI layers above.
          {
            target: './src/components',
            from: ['./src/dashboard', './src/handler'],
            message: 'Layer 4 (components) must not import from Layer 5 (tabs) or Layer 7 (entries).',
          },
          // Layer 5 (tabs) — may import shared/* + components/* + same-layer.
          // Forbid the cross-app boundary into handler/.
          {
            target: './src/dashboard/tabs',
            from: ['./src/handler'],
            message: 'Layer 5 (dashboard tabs) must not import from the handler app.',
          },
          // Cross-app boundary in the other direction — handler must not
          // reach into the dashboard tabs/components.
          {
            target: './src/handler',
            from: ['./src/dashboard', './src/components'],
            message: 'Handler app must not import from dashboard or dashboard-only components.',
          },
        ],
      }],
    },
  },
];
