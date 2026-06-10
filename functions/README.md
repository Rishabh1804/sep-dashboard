# Cloud Functions — Phase 2 Stage B (SKELETON)

**Status:** scaffolding, **not deployed**. Track 2 work (needs a live Firebase project).

This package is intentionally **outside** the root web app:

- Not installed by the root `pnpm install` (separate `package.json`).
- Not built or tested by the root CI gate (`.github/workflows/ci.yml` runs the web app's build + Jest + Playwright only).
- The load-bearing **logic is pure** and lives in the web app at
  [`../src/shared/validation/cross-doc.js`](../src/shared/validation/cross-doc.js),
  where it is unit-tested under the root Jest suite. These functions are thin
  Firestore-trigger / callable wrappers around it.

## Inventory (per [`../docs/architecture/CLOUD_FUNCTION_HOOKS.md`](../docs/architecture/CLOUD_FUNCTION_HOOKS.md))

| Function | Trigger | Status |
|---|---|---|
| `auditEventGenerator` (per audited collection) | Firestore onWrite | skeleton |
| `createProductionEntry` / `createDftMeasurement` / `createDispatchEvent` | HTTPS callable (cross-doc validate → write) | skeleton |
| `aggregateRouteHistory` | Firestore onCreate, idempotent | skeleton |

Still to scaffold in later Track-1/Track-2 passes: `provisionWorker`, `revokeWorker`,
`reIssueToken`, `schemaNormalizer`, `bulkMigration`, `replayRebuild`, `dailyExport`,
`topicDigestCron`, `anomalyDetector`, `expireNotes`.

## Track 2 to make this deployable

1. Live Firebase project (prod + staging) + Functions enabled.
2. Vendor the shared pure logic into this package at deploy time (prebuild copy
   step, or convert the repo to an npm workspace) — the `../../src/shared` import
   is reference-only; Firebase deploy bundles only `functions/`.
3. Emulator suite + `@firebase/rules-unit-testing` in a dedicated CI job.
4. App Check enforcement on callables.
