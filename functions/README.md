# Cloud Functions — Phase 2 Stage E

**Status:** logic complete + unit-tested; **deploy is IAM-gated** (not yet run against staging — see below).

This package is intentionally **outside** the root web app:

- Not installed by the root `pnpm install` (separate `package.json`).
- Not built or tested by the root CI gate (`.github/workflows/ci.yml` runs the web app's build + Jest + Playwright only).
- The load-bearing **logic is pure** and lives in the web app at
  [`../src/shared/validation/cross-doc.js`](../src/shared/validation/cross-doc.js),
  unit-tested under root Jest ([`../tests/unit/derive.test.js`](../tests/unit/derive.test.js)
  + [`../tests/unit/cross-doc.test.js`](../tests/unit/cross-doc.test.js)). These
  functions are thin Firestore-trigger / callable wrappers around it.

## Vendoring (how deploy ships the shared logic)

`firebase deploy` bundles **only** this `functions/` dir. So the pure module is
**vendored** in by [`vendor.mjs`](vendor.mjs) → `functions/vendor/cross-doc.js`,
wired to `firebase.json`'s `predeploy` hook so the deployed artifact is always
fresh. `vendor/` is **gitignored and generated** — never committed — so there's
no second copy to drift from the source: edit the source, run `vendor.mjs` (or
`pnpm --prefix functions lint`, which re-vendors then `node --check`s the entry).

## Inventory (per [`../docs/architecture/CLOUD_FUNCTION_HOOKS.md`](../docs/architecture/CLOUD_FUNCTION_HOOKS.md))

| Function | Trigger | Status |
|---|---|---|
| `dispatchStatusAggregator` | Firestore onCreate `dispatch_events/{id}` → flip `jobs/{job_id}.current_status` to `dispatched` | **Stage E — built** |
| `workerShiftAggregator` | onCreate `workers/{wid}/shifts/{id}` → `Worker.current_status` | **Stage E — built** |
| `machineStateAggregator` | onCreate `machines/{mid}/state_transitions/{id}` → `Machine.current_status` | **Stage E — built** |
| `routeHistoryAggregator` | onCreate `jobs/{jid}/route_history/{id}` → status (route-based lifecycle) | **Stage E — built** |
| `auditEventGenerator` (per audited collection) | Firestore onWrite | skeleton |
| `createProductionEntry` / `createDftMeasurement` / `createDispatchEvent` | HTTPS callable (cross-doc validate → write) | skeleton |

All four aggregators are **idempotent** (`shouldApplyEvent` guards duplicate
triggers + out-of-order replay) and **transactional** (single writer per parent
doc). Job parents require an existing doc (never fabricated from a stray event);
worker/machine derived parents merge-create on first event.

Still to scaffold: `provisionWorker`, `revokeWorker`, `reIssueToken`,
`schemaNormalizer`, `bulkMigration`, `replayRebuild`, `dailyExport`,
`topicDigestCron`, `anomalyDetector`, `expireNotes`.

## Deploy — the gated path

1. `deploy-functions` action in [`.github/workflows/firebase-admin.yml`](../.github/workflows/firebase-admin.yml)
   (or `pnpm deploy:functions:staging` locally with a service-account key).
2. **IAM (the gate):** deploy-rules' grant (Firebase Rules Admin + Service Usage
   Consumer) is **not enough**. The staging SA additionally needs Cloud Functions
   Admin, Service Account User, Cloud Build Editor, Artifact Registry Writer,
   Eventarc Admin, and Cloud Run Admin, with the matching APIs enabled. The exact
   role list is in [`../scripts/deploy-functions.mjs`](../scripts/deploy-functions.mjs).
   Until granted, the deploy 403s the same way deploy-rules did.
3. **Follow-up (post-deploy):** an emulator duplicate-trigger / out-of-order test
   in a dedicated CI job (the pure guard is already exhaustively unit-tested);
   `min-instances=1` via `AGG_MIN_INSTANCES=1` on prod per CONFLICT_RESOLUTION.md.
