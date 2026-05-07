# Session 13 — Kickoff: Phase 2.0 Implementation (Data Capture First)

**Phase:** Phase 2.0 alpha — comprehensive data capture handler app + minimal data viewer dashboard
**Target deploy:** May 2026 (architecture lock complete; alpha ships when ready, ~late May)
**Tool:** Claude Code (per Tools & Workflow boundary in `CLAUDE.md`)
**Source synthesis:** [`docs/SESSION_HANDLER_ARCH.md`](docs/SESSION_HANDLER_ARCH.md) — read first
**Per-decision detail:** [`docs/architecture/INDEX.md`](docs/architecture/INDEX.md)

---

## Major Reframe (vs. original Session 13 kickoff)

This kickoff is a **rewrite** of the original Session 13 plan, reflecting Cowork Session 12+ decisions:

- **Data capture app first.** Phase 2.0 alpha ships the comprehensive handler PWA + minimal data viewer dashboard. Konva floor view, HUD, hotkeys, and full interaction model **deferred to Phase 2.1**.
- **N-PWA monorepo** (generalizing two-PWA lock from Session 12).
- **Phase 4-8 architecture lock** absorbs ~16 BLOCKERs and ~50 HIGH/MEDIUM adversary findings into hardened decisions.
- **23 must-adds** integrated into stage acceptance criteria.

**Why the reframe:** *"This whole thing relies on excellent data capture, that's the unit on which everything will work."* Without real data flowing in, the floor view is theater. Build data capture first; floor view consumes it later.

---

## Objective

Build the Phase 2.0-alpha skeleton: working modular bundle, comprehensive handler PWA with 9 forms, minimal data viewer dashboard, Firebase Firestore + Cloud Functions ecosystem, audit log, schema migration discipline, and steward affordances. Ship a functional data capture system the operator can use day-one; floor view ships in 2.1+.

This is the **data-capture-first MVP slice** defined in `docs/architecture/EXCELLENT_DATA_CAPTURE.md`.

---

## Prerequisites

Before starting:

1. **Read** in this order:
   - [`CLAUDE.md`](CLAUDE.md) (project meta-history; Sessions 8-12 + Cowork Session 12+ closeout)
   - [`docs/SESSION_HANDLER_ARCH.md`](docs/SESSION_HANDLER_ARCH.md) (synthesis: Phase 1-8 as one picture)
   - [`docs/architecture/INDEX.md`](docs/architecture/INDEX.md) (per-decision routing)
   - [`docs/reference/SCHEMA.md`](docs/reference/SCHEMA.md) (canonical entity reference)
   - [`docs/reference/FIRESTORE_RULES.ref.txt`](docs/reference/FIRESTORE_RULES.ref.txt) (deployable rules)
   - Per-decision detail in `docs/architecture/*.md` as needed during implementation

2. **Verify auth:** Claude Code must be on Claude account / subscription, NOT API key. See `CLAUDE.md` auth notes if conflict.

3. **Confirm prerequisites:**
   - `docs/floor-plan.png` present (deferred to 2.1, but useful reference)
   - Firebase project created (sep-dashboard production + sep-dashboard-staging)
   - GitHub PAT with `repo` scope available (for topic digest commits and deploy)
   - Android device available for handler PWA testing

4. **Set model:** `/model` to Sonnet 4.6 (Opus is overkill; Sonnet excels at refactor + implementation).

---

## Implementation Order

Each stage estimates active time only. Total: ~41h (vs. ~22h in original kickoff — increase reflects Phase 4-8 hardening + comprehensive form scope + dashboard breadth + safety net infrastructure).

### Stage A — Repo modularization (~6h, unchanged from original)

Per Session 8 charter + Phase 4-7 audit resolutions. Convert v2.1 single-file `index.html` (4,972 lines) to 7-layer modular structure.

1. **Extract CSS** into `src/css/` (tokens / base / components / responsive)
2. **Split JS** into 7-layer `src/` structure with shared/dashboard/handler entry points (per [DEPLOY_TOPOLOGY.md](docs/architecture/DEPLOY_TOPOLOGY.md))
3. **Replace ~80 inline onclick** handlers with `addEventListener` / delegated `data-action`
4. **Delete construction overlay** (~370 lines)
5. **esbuild config** with multi-entry support
6. **npm scripts:** `build`, `dev`, `test`
7. **Jest setup** for `utils/` + `migrations/` + `derivations/`
8. **TypeScript** + Zod added to dependency tree

**Acceptance:** v2.1 functionality preserved end-to-end (smoke-test every tab); layer rule enforced via lint or build check; CSS uses tokens; multi-entry esbuild builds dashboard + handler bundles.

### Stage B — Schema + Firestore + Auth foundation (~8h, expanded)

This stage is the meat of the data-capture-first reframe.

1. **Firebase project setup** — production (`sep-dashboard`) + staging (`sep-dashboard-staging`)
2. **Firestore schema** per [DATA_HIERARCHY.md](docs/architecture/DATA_HIERARCHY.md) + [SCHEMA.md](docs/reference/SCHEMA.md): all top-level collections + subcollections + composite indexes
3. **Security rules** deployed from [FIRESTORE_RULES.ref.txt](docs/reference/FIRESTORE_RULES.ref.txt); emulator suite configured
4. **Storage layer (Layer 2)** with Zod schemas at write boundary; `getState/setState` accessors; idempotency-key generation; offline persistence configuration; `migrate(doc)` adapter for Layer 2 reads (per [SCHEMA_MIGRATION.md](docs/architecture/SCHEMA_MIGRATION.md))
5. **Cloud Functions setup** — Firebase Functions v2 (Node 18+); `functions/src/` structure
6. **Auth: provisioning CF** — `provisionWorker` callable; mints custom token + QR (per [HANDLER_PROVISIONING.md](docs/architecture/HANDLER_PROVISIONING.md))
7. **Audit log CF** — `auditEventGenerator` post-write trigger on every collection (per [CLOUD_FUNCTION_HOOKS.md](docs/architecture/CLOUD_FUNCTION_HOOKS.md))
8. **App Check** — Play Integrity for handler PWA, reCAPTCHA Enterprise for dashboard
9. **Emulator suite** with fixture data + Jest unit tests for migrations + Zod validators
10. **CI** runs emulator-based rule tests on every PR

**Acceptance:** Firestore + rules deployed to staging; emulator suite passes; provisioning end-to-end works (admin generates QR → emulated client exchanges → custom claims set); audit events generated on every write.

### Stage C — Handler PWA shell (~6h, new)

Per [HANDLER_UI_SHELL.md](docs/architecture/HANDLER_UI_SHELL.md).

1. **Esbuild entry** at `src/handler/main.js` → bundles to `/sep-dashboard/entry/handler/`
2. **PWA manifest** (`public/manifest-handler.json`) + service worker scoped to `/entry/handler/`
3. **Three-layer screen hierarchy** (top bar + home + per-form screens)
4. **Universal form template** — component-library-grade, in shared Layer 4
5. **Big-button picker grid** for high-frequency fields; recent-first IndexedDB cache
6. **Sync chip** with explicit copy ("Saved on phone, not yet sent (4)") + queued-writes counter
7. **Pre-flush confirmation** modal on app open if queued writes detected (per [CONFLICT_RESOLUTION.md](docs/architecture/CONFLICT_RESOLUTION.md))
8. **i18n scaffolding** — Devanagari primary + English secondary toggle; iconography on primary actions; long-press TTS via Web Speech API (with MP3 fallback)
9. **64px touch target** enforcement via CSS tokens
10. **Multi-modal submit confirmation** — toast + haptic (Vibration API) + audio cue (Web Audio API frequency outside machine noise band)
11. **Form draft auto-save** to IndexedDB on every keystroke (200ms debounce)

**Acceptance:** PWA installable on Android (Chrome + Firefox tested); home screen shows form tile grid; touch targets ≥64px verified via automated UI test; Devanagari labels visible; long-press on field label triggers TTS.

### Stage D — The 9 forms (~8h, new)

Per [HANDLER_FORMS.md](docs/architecture/HANDLER_FORMS.md). Order:

1. **Production Entry** (most volume; pre-fill defense bundle critical)
2. **Job Receipt**
3. **Worker Check-In/Out** (form-with-smart-defaults; ≤2 effective taps)
4. **Machine State Change**
5. **DFT Measurement** (sanity hard-block >50 µm)
6. **Dispatch Event**
7. **Stock Refill** (with new Supplier entity)
8. **Stock Depletion**
9. **Note** (structured-mem schema)

Each form:
- Zod schema in `src/shared/types/schemas.ts`
- UI component in `src/handler/forms/`
- Smart defaults + sanity hard-blocks + idempotency key + offline-queue support
- CF-mediated forms (Production / DFT / Dispatch) call `createX` Cloud Function for cross-doc validation
- Multi-modal submit confirmation
- Form draft auto-save tested

**Acceptance:** All 9 forms ship; each tested with Jest + manual end-to-end on Android; offline queue + sync verified; CF-mediated forms gracefully handle CF unreachable (queue with backoff).

### Stage E — Cloud Functions ecosystem (~4h, expanded)

Per [CLOUD_FUNCTION_HOOKS.md](docs/architecture/CLOUD_FUNCTION_HOOKS.md).

1. **`provisionWorker`** + **`revokeWorker`** + **`reIssueToken`** (Stage B partial)
2. **`auditEventGenerator`** (Stage B partial)
3. **`eventSourcingAggregator`** for each subcollection (route_history, state_transitions, shifts, receipts, depletions, priority_bump_events) — with `last_applied_event_id` idempotency
4. **`crossDocValidator` callables** — `createProductionEntry`, `createDftMeasurement`, `createDispatchEvent`
5. **`schemaNormalizer`** Layer 3 CF (per [SCHEMA_MIGRATION.md](docs/architecture/SCHEMA_MIGRATION.md))
6. **`bulkMigration`** admin callable (3-stage: dry-run / sample-N / full-run with `migration_batch_id`)
7. **`replayRebuild`** admin callable (rebuild parent state from event log; migration-aware)
8. **`revertMigrationBatch`** admin callable (companion to bulk migration)
9. **`topicDigestCron`** hourly Pub/Sub schedule (per [TOPIC_DIGESTS.md](docs/architecture/TOPIC_DIGESTS.md)) — commits markdown to GitHub via PAT
10. **`dailyExport`** Cloud Scheduler daily — Firestore → GCS bucket (rollback safety)
11. **`anomalyDetector`** for the 11 categories (per [ANOMALY_INBOX.md](docs/architecture/ANOMALY_INBOX.md))
12. **`expireNotes`** daily — auto-archive notes past `expires_at`

**Min-instances=1** on `eventSourcingAggregator` + `topicDigestCron` (always-warm; per Phase 5 cold-start lock).

**Acceptance:** All CFs deploy successfully; idempotency tested (duplicate triggers = no-ops); topic digest cron runs hourly + commits to GitHub; daily export verified retrievable; anomaly detectors generate kind:'anomaly' notes correctly.

### Stage F — Minimal data viewer dashboard (~6h, new)

Per [DASHBOARD_VIEWER.md](docs/architecture/DASHBOARD_VIEWER.md).

1. **Esbuild entry** at `src/dashboard/main.js` → bundles to `/sep-dashboard/`
2. **Top bar** with conflict + anomaly + stock badges
3. **Tab 1: Today's activity stream** with filters
4. **Tab 2: Recent entries by category** (sub-tabs per entity type)
5. **Tab 3: Job-in-flight board** (list view, NOT floor view)
6. **Tab 4: Ready-to-dispatch alarms** (12-hour Ready loiter from Session 11)
7. **Tab 5: Stock reorder alerts**
8. **Side panel: Pending-conflicts inbox** (per [CONFLICT_RESOLUTION.md](docs/architecture/CONFLICT_RESOLUTION.md), steward-exclusive)
9. **Side panel: Anomaly inbox** (steward-exclusive; bulk disposition + quick-correct inline per [STEWARD_AFFORDANCES.md](docs/architecture/STEWARD_AFFORDANCES.md))
10. **Side panel: Audit log search** (entity-first default; advanced free-text behind tab)
11. **Admin tab: Worker provisioning UI** (QR generation; revoke flows)
12. **Admin tab: Bulk migration approval UI** (3-stage with revert button)
13. **Admin tab: Build version monitoring** + min_supported_build editor (confirm-twice modal)
14. **Steward KPI weekly card** (4 metrics: aging / edit rate / dispute reopens / anomaly precision)
15. **Search bar** (job ID + customer name only per Phase 7)
16. **Per-entity "last updated Xs ago"** indicator on every card (per Phase 5 must-add)

**Acceptance:** Dashboard deploys at `/sep-dashboard/`; v2.1 sunset; all 5 main canvas tabs functional; pending-conflicts + anomaly inboxes steward-exclusive; provisioning UI + bulk migration UI tested end-to-end; staleness indicators visible.

### Stage G — Adoption rollout prep (~2h, new)

Per [ADOPTION_PLAN.md](docs/architecture/ADOPTION_PLAN.md).

1. **Laminated paper backup forms** designed in matching field layout; printed; distributed
2. **Procurement** of Android phones for handlers without (~Rs 5000/each)
3. **Daily huddle** template + handler-as-trainer KPI definition (adoption rate, NOT entries)
4. **First handler provisioned** via QR-in-person flow; runbook validated end-to-end
5. **Worker rewards plan** (optional) — small recognition for high-adoption workers

**Acceptance:** Paper forms in every area; first handler provisioned successfully; daily huddle scheduled; KPI computation verified.

### Stage H — Deploy alpha (~1h)

1. **Construction overlay removed** (Stage A confirmed clean)
2. **PWA manifests** confirmed for both `/sep-dashboard/` and `/sep-dashboard/entry/handler/`
3. **GitHub Pages deploy** — push to main; verify live
4. **Firestore rules + indexes** deployed to production
5. **Cloud Functions** deployed
6. **App Check enforcement** turned on
7. **Manual smoke test** end-to-end:
   - Provision new handler via QR-in-person
   - Submit Production Entry on phone
   - Dashboard sees write within 5s
   - DFT measurement creates rework segment if fail
   - Dispatch event triggers invoicing-integration check
8. **Rollback plan documented** — git revert to v2.1 commit `524769c` is one command

**Acceptance:** Phase 2.0 alpha live; handler PWA installable; data capture end-to-end tested; rollback plan rehearsed.

---

## Acceptance Criteria for Phase 2.0-Alpha

Hard requirements before alpha ships. Maps to acceptance criteria in [`docs/SESSION_HANDLER_ARCH.md`](docs/SESSION_HANDLER_ARCH.md) §7.

### Foundation

- [ ] Modular bundle (Stage A); v2.1 functionality preserved
- [ ] Firestore schema deployed; security rules per `FIRESTORE_RULES.ref.txt`
- [ ] App Check enabled (Play Integrity + reCAPTCHA Enterprise)
- [ ] Staging Firebase project + emulator suite in CI
- [ ] Zod runtime validation at storage Layer 2
- [ ] Audit log via CF admin SDK; client writes denied

### Handler PWA (Stage C-D)

- [ ] PWA installable on Android via subpath; first-handler provisioning works end-to-end via QR-in-person
- [ ] All 9 forms ship with Zod + sanity hard-blocks + idempotency keys + draft auto-save
- [ ] Production Entry pre-fill defense bundle (visual diff + 15min decay + job-completion clear + first-of-session confirm-step) functional
- [ ] Big-button picker grid for high-frequency fields
- [ ] 64px minimum touch targets enforced via CSS tokens; verified via UI test
- [ ] Devanagari labels primary; English toggle; iconography; long-press TTS
- [ ] Multi-modal submit confirmation (toast + haptic + audio cue)
- [ ] Offline queue: pre-flush confirmation + queued-writes counter + persistent sync chip with explicit copy
- [ ] Stale-build rejection (config doc → rules) functional
- [ ] iOS Safari handler officially unsupported (Phase 7)

### Dashboard (Stage F)

- [ ] All 11+ minimal-viewer surfaces operational
- [ ] Pending-conflicts inbox + anomaly inbox steward-exclusive disposition
- [ ] Worker provisioning UI: QR codes; re-issue + revoke flows tested
- [ ] Bulk migration approval UI: 3-stage with revert
- [ ] Audit log search default to entity-first; advanced tab unlocks free-text
- [ ] Steward KPI weekly card (4 metrics)
- [ ] Build version distribution panel + min_supported_build editor with confirm-twice modal

### Cloud Functions (Stage E)

- [ ] Audit event generation on every collection
- [ ] Event-sourcing aggregators with `last_applied_event_id` on every parent doc
- [ ] Topic digest hourly cron compiles `topics/*.md`; first run successful
- [ ] Schema normalization Layer 3 CF with content-hash + per-write build metadata + circuit breaker
- [ ] Replay/rebuild admin function tested
- [ ] Daily Firestore export to GCS verified
- [ ] Min-instances=1 set on aggregator + topicDigestCron
- [ ] All 11 anomaly detectors deployed + tested

### Operations (Stage G-H)

- [ ] First handler provisioned via QR-in-person flow (validates `HANDLER_PROVISIONING.md`)
- [ ] Adoption plan in motion: parallel paper run started; Production Entry first; daily huddle scheduled
- [ ] Construction overlay removed
- [ ] v2.1 sunset + alpha live at `rishabh1804.github.io/sep-dashboard/`
- [ ] Architecture corpus committed to `docs/architecture/` and `docs/reference/`

---

## Deferred (Phase 2.1+)

Per [DASHBOARD_VIEWER.md](docs/architecture/DASHBOARD_VIEWER.md) and [EXCELLENT_DATA_CAPTURE.md](docs/architecture/EXCELLENT_DATA_CAPTURE.md):

**Phase 2.1:**
- Konva floor view + animations + HUD overlays + hotkey set + Standard overlay (full Session 12 visual design)
- Per-worker productivity rollup (needs ≥2 weeks data baseline)
- DFT-fail rework queue (specialized surface)
- Job slip print
- Inspector role-app (second role-app)
- Voice notes (optional voice attachment to structured note form)
- Push notifications for urgent anomalies
- Field-level audit (every field's value-history)
- Note expiry recommendations
- Mood/health rendering as subtle color gradients

**Phase 2.2+:**
- Productivity overlay
- Stock-criticality overlay
- Multi-zoom map
- Time-travel / replay UI
- Customer portal (3rd PWA in monorepo)
- Worker activity overlay (post-cameras)
- Anomaly flagging analytics
- Print artifacts polish (letterhead branding)
- Planning overlay (redevelopment what-if)
- ML-based anomaly detection
- Audio alerts
- Daily / weekly summary print artifacts
- Data correction workflow (dedicated UI)
- Multi-language localization beyond Devanagari

---

## Banked Side Sessions

| Session | Why blocking-or-not | When |
|---|---|---|
| **Inspector role-app design** | Second role-app per priority; can ship soon after alpha | Cowork, post-alpha (~Week 5-6) |
| **Camera placement & type** | Unlocks worker location tracking; gate-vehicle ID; theft/safety/quality dispute resolution | Cowork, post-2.0 |
| **Quality cert sample review** | Match customer-accepted format | Cowork, when 2.1 cert work begins |
| **Letterhead/branding artwork** | Plain-functional design at first | Cowork, when supplied |
| **Per-room interior layouts (Barrel + Pickling Area 4)** | Floor view (2.1) renders these as labeled boxes initially | Cowork, before 2.1 floor view starts |
| **Workforce complement totals** | 9 of 20 workers unallocated | Cowork, when needed for floor rendering |

---

## Workflow Conventions (Inherited from Cowork Session 12+)

### Adversarial probe pattern

For every load-bearing implementation milestone, spin up an adversarial reviewer agent to stress-test the implementation against the architecture file. Same prompt template:

- Find what's wrong, what's underspecified, what scales poorly
- Severity-tag findings (BLOCKER / HIGH / MEDIUM / LOW / DEFENDABLE)
- Predict the most likely first-month failure mode

This pattern caught ~16 BLOCKERs across 5 architecture phases. Recommended before any major commit.

### Documentation cadence

When implementation diverges from architecture file:

1. Stop, decide: is the divergence right (file is wrong) or wrong (impl is wrong)?
2. If file wrong: update file in `docs/architecture/`; add entry to `DECISION_LOG.md`
3. If impl wrong: fix impl
4. Never silently diverge

### Commit cadence

- Architecture file changes: commit + push immediately (visible to next session)
- Implementation: commit per stage; tag at `phase-2.0-alpha` when alpha ships
- Topic digest hourly cron commits should NOT be conflated with regular work — auto-commits use prefix `chore(topics): `

### Tooling boundary

- Design conversations stay in Cowork (per `CLAUDE.md` workflow rule)
- Coding stays in Claude Code (this session)
- If design needs revision mid-implementation: commit progress, return to Cowork, then resume

---

## Handoff at Session Close

When Stage H deploys successfully:

1. **Update `CLAUDE.md`** with Session 13 closeout — what shipped, blockers encountered, deferred items, any architectural deviations from `docs/architecture/*.md` and their justification
2. **Update `docs/architecture/DECISION_LOG.md`** with implementation-discovered refinements (if any)
3. **Commit + push** all changes; tag the commit `phase-2.0-alpha`
4. **Smoke test handoff:** verify next Cowork session can read CLAUDE.md + see alpha live

If any stage runs over or hits blockers, prefer **shipping a smaller MVP that works** over a complete MVP that's flaky. Phase 2.1 ships incremental polish; alpha quality matters more than alpha completeness.

---

*Refreshed 7 May 2026 by Aurelius (Cowork Session 12+ closeout). Implementation kickoff for Claude Code Session 13. Original kickoff archived implicitly via git history.*
