# Notebook Handler Architecture — Phase 2 Synthesis

**Date:** 7 May 2026
**Author:** Aurelius (Cowork Session 12+)
**Status:** LOCKED — ready for Session 13 (Claude Code) implementation
**Audience:** Claude Code agent (Session 13 implementation), future contractors, future-Aurelius across sessions
**Authority:** This document integrates the 8 phases of architecture work. Per-decision detail lives in `architecture/*.md`; this is the narrative that ties them together.

---

## 0. Read This First

This document is the executable bridge between Cowork architecture work and Claude Code implementation. Read in this order:

1. **`CLAUDE.md`** (repo root) — project meta-history; persona; commit cadence; tooling boundaries; Session 12+ closeout
2. **This document** — the synthesis: what we're building, why, and in what order
3. **`architecture/INDEX.md`** — routing surface for per-decision detail
4. **`architecture/{specific file}.md`** as needed during implementation
5. **`reference/SCHEMA.md`** — canonical entity reference

If any code conflicts with an architecture file, the architecture file is authoritative — fix the code or open a new ratification in `architecture/DECISION_LOG.md`.

---

## 1. Vision Statement (the load-bearing reframe)

> *"This whole thing relies on excellent data capture, that's the unit on which everything will work."*

Phase 2.0 alpha ships the **comprehensive data capture handler app** + a **minimal data viewer dashboard**. The Konva floor view, HUD, overlays, and full interaction model — locked in Session 12 — are reframed to **Phase 2.1+**. Without real, trustworthy data flowing in, the floor view is theater. Data capture is the unit; visualization layers consume it.

This supersedes the Session 12 MVP cut (§9 of `SESSION_12_DESIGN_LOCK.md`). The visual design lock from Session 12 is preserved verbatim for 2.1 implementation; what changes is *order* and *scope*.

The "excellent" in "excellent data capture" is a measurable bar — see **`architecture/EXCELLENT_DATA_CAPTURE.md`** for the seven dimensions (speed, accuracy, completeness, reliability, forensics, recoverability, adoption-friendly).

---

## 2. Architecture Overview — The 8 Phases as One Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOY TOPOLOGY (Phase 1)                    │
│   Subpath dual-PWA monorepo → N-PWA as roles emerge             │
│   /sep-dashboard/        ← dashboard (owner)                    │
│   /sep-dashboard/entry/handler/  ← handler PWA (data capture)   │
│   /sep-dashboard/entry/inspector/  ← future role-app            │
│   ... shared Layer 1-3, role-specific Layer 5+                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AUTH MODEL (Phase 3 + Phase 8 fix)            │
│   Firebase custom tokens + custom claims                        │
│   Provisioning: QR code, owner scans worker phone in person     │
│   Two-tier revocation: writes immediately + reads ≤15min tail   │
│   active_token_id rotation kills stolen-phone offline queues    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DATA HIERARCHY (Phase 2)                       │
│   Hybrid Firestore: top-level entities + queryable events       │
│   Subcollections for natural children                           │
│   Compartments: user-identity (always) + role-app + 24h edit    │
└─────────────────────────────────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
┌──────────────────────────┐         ┌──────────────────────────────┐
│  WRITE PATH              │         │  READ PATH                   │
│  Handler PWA + Dashboard │         │  Live: Firestore listeners   │
│   ↓                      │         │   ↓                          │
│  Zod validation (Phase 6)│         │  Storage Layer 2 adapter     │
│   ↓                      │         │   ↓                          │
│  Firestore rules (Phase 4)│         │  UI panels (handler + dash) │
│   ↓                      │         │                              │
│  CF pre-write hooks      │         │  Compiled: topics/*.md       │
│   ↓                      │         │  (hourly cron, Phase 2)      │
│  Firestore commit        │         │   ↓                          │
│   ↓                      │         │  Aurelius / Claude Code /    │
│  CF post-write triggers: │         │  contractors / human reviewers│
│  - audit_event creation  │         │                              │
│  - event-sourced state   │         │                              │
│    derivation (Phase 5)  │         │                              │
│  - schema normalization  │         │                              │
│    (Phase 6)             │         │                              │
│  - topic digest refresh  │         │                              │
│    (every hour)          │         │                              │
└──────────────────────────┘         └──────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              CONFLICT RESOLUTION (Phase 5)                      │
│   Online edits: Firestore transactions                          │
│   Offline edits: LWW + audit-log conflict surface               │
│   Pending-conflicts inbox in dashboard (steward-exclusive)      │
│   Aggressive event-sourcing for derivable state                 │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              SCHEMA MIGRATION (Phase 6)                         │
│   Full 5-layer machinery as routine practice                    │
│   Safety nets: TTL backup + daily export + Zod + stale-build    │
│   rejection + content-hash versioning + 3-stage bulk + DAG      │
└─────────────────────────────────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
┌──────────────────────────┐         ┌──────────────────────────────┐
│  HANDLER UI (Phase 7)    │         │  STEWARD AFFORDANCES (Phase 8)│
│  Three-layer screens     │         │  Anomaly inbox (~11 cats)     │
│  Universal form template │         │  Edit-with-reason             │
│  Devanagari + icons +    │         │  Bulk disposition + quick-fix │
│  audio TTS               │         │  Audit log search             │
│  64px touch targets      │         │  Worker provisioning UI       │
│  Pre-fill defenses       │         │  Build version monitoring     │
│  Big-button picker grids │         │  Bulk migration approval      │
│  Android-only            │         │  KPI weekly card (4 metrics)  │
│  9 forms                 │         │  Steward-exclusive surfaces   │
└──────────────────────────┘         └──────────────────────────────┘
```

Each box has a dedicated architecture file with the locked detail. This synthesis explains how they fit; the files explain how each works.

---

## 3. The 9 Handler Forms (Alpha Scope)

The handler PWA is the central data ingestion surface in alpha. Until specialized role-apps ship (Inspector → Dispatch → others), the handler absorbs all role-data:

| # | Form | Volume estimate | Notes |
|---|---|---|---|
| 1 | **Job Receipt** | ~30/day | Customer + item typeahead; received_kg → auto-derived pcs from WPP (or dotted ring badge if uncalibrated) |
| 2 | **Production Entry** | ~300/day | **Most-frequent.** Job + machine + worker + qty + station. Pre-fill defenses load-bearing (full bundle per Phase 7) |
| 3 | **DFT Measurement** | ~30/day | Job + micron + inspector + pass/fail-rework. Sanity hard-block: >50 µm rejected |
| 4 | **Dispatch Event** | ~20/day | Job + mode (3-wheeler/bike/cycle/hand) + vehicle details. Triggers DispatchEvent + invoicing-integration check (best-effort, Design Lock §6.1) |
| 5 | **Stock Refill** | ~5/day | Stock item + qty + unit cost (per receipt) + supplier (first-class entity, must-add). Per-kg vs per-bag toggle explicit |
| 6 | **Stock Depletion** | Variable | Stock item + qty + reason. Manual entry; later auto-derived for graduated items |
| 7 | **Machine State Change** | ~10/day | Machine + new state + reason (mandatory for `down`). Becomes event-sourced per Phase 5 aggressive split |
| 8 | **Worker Check-In/Out** | ~40/day | Worker + action (in/out/break) + location. Form-with-smart-defaults primitive (≤2 effective taps) |
| 9 | **Note (any entity)** | ~5/day | Topic_refs + kind + summary + body + severity + tags (structured-mem schema from Phase 2) |

**Form-by-form field-level spec:** see `architecture/HANDLER_FORMS.md`.

**UI shell + universal template:** see `architecture/HANDLER_UI_SHELL.md`.

---

## 4. The Minimal Data Viewer Dashboard (Alpha Scope)

What Rishabh sees in alpha. NOT the floor view (deferred to 2.1). Critical operational surfaces brought forward from v2.1:

- **Today's activity stream** — chronological list of all writes, filterable
- **Recent entries by category** — tabbed (Jobs / Production / DFT / Dispatch / Stock / Machine States / Notes)
- **Job-in-flight board** — list/table view of jobs with status, location, progress, SLA clock (Phase 7 ratification: brought forward from v2.1)
- **Ready-to-dispatch alarms** — 12h Ready loiter alarms (locked in Session 11 domain model)
- **Stock reorder alerts** — low-stock by criticality
- **Pending-conflicts inbox** — Phase 5 surface (steward-exclusive disposition)
- **Anomaly inbox** — Phase 8 surface (~11 categories, steward-exclusive)
- **Audit log search** — entity-first default, free-text behind "advanced"
- **Handler version distribution** — which builds are on which phones
- **Worker provisioning UI** — add/re-issue/revoke (QR-in-person flow)
- **Bulk migration approval** — three-stage discipline (dry-run → sample-N → full-run)

**NOT in alpha (deferred to 2.1):**
- Konva floor view + animations + HUD overlays
- Per-worker productivity rollup (needs ≥2 weeks data per Design Lock)
- DFT-fail rework queue
- Hotkey set + Standard overlay rendering
- Job slip print (deferred from Session 12 since it depends on data-capture being live first)

**Detail:** `architecture/DASHBOARD_VIEWER.md`.

---

## 5. Implementation Order (Refreshed Stage F + Beyond)

The Session 13 kickoff has been rewritten (`SESSION_13_KICKOFF.md`) to reflect this reordering. High-level summary of stages:

### Stage A — Repo modularization (~6h, unchanged from original kickoff)

Per Session 8 charter + Phase 4-7 audit resolutions. Convert v2.1 single-file `index.html` to 7-layer modular structure. Token-compliance enforcement. Construction overlay deletion. Storage layer with `getState/setState` accessors (option C from Session 11 audit).

### Stage B′ — Schema + Firestore + auth foundation (~8h, NEW)

This stage is the meat of the data-capture-first reframe. Floor view foundation (original Stage B) deferred to 2.1.

1. Firebase project setup (production + staging per Phase 4 lock)
2. Firestore schema implementation per `architecture/DATA_HIERARCHY.md` and `reference/SCHEMA.md`
3. Security rules per `architecture/FIRESTORE_RULES.md` (deployable file at `reference/FIRESTORE_RULES.ref.txt`)
4. Storage layer (Layer 2) with Zod schemas at write boundary; `getState/setState` accessors; idempotency-key generation; offline persistence configuration
5. Auth: Cloud Function for token issuance; custom claims; QR code generation in dashboard
6. Audit log Cloud Function (server-only writes via admin SDK)
7. App Check configuration (Play Integrity for handler PWA, reCAPTCHA Enterprise for dashboard)
8. Emulator suite + Jest unit tests for migrations + Zod validators

### Stage C′ — Handler PWA shell (~6h, NEW — replaces original Stage C interaction work)

1. Esbuild entry point at `src/handler/main.js`
2. PWA manifest + service worker for `/entry/handler/` scope
3. Three-layer screen hierarchy (top bar + home + per-form screens) per `architecture/HANDLER_UI_SHELL.md`
4. Universal form template (component-library-grade)
5. Big-button picker grid component (high-frequency fields)
6. Sync chip + queued-writes counter + pre-flush confirmation
7. i18n scaffolding (Devanagari primary + English secondary; icons per primary action; long-press TTS)
8. 64px touch target enforcement (CSS tokens)
9. Multi-modal submit confirmation (toast + haptic + audio cue)
10. Form draft auto-save to IndexedDB on every keystroke

### Stage D′ — The 9 forms (~8h, NEW)

Per `architecture/HANDLER_FORMS.md`. Order:
1. Production Entry (highest volume; pre-fill defense bundle critical)
2. Job Receipt
3. Worker Check-In/Out
4. Machine State Change
5. DFT Measurement
6. Dispatch Event
7. Stock Refill (with supplier entity)
8. Stock Depletion
9. Note (structured-mem schema)

Each form: Zod schema + UI + smart defaults + validation + idempotency key + sanity hard-blocks + offline-queue support.

### Stage E′ — Minimal data viewer dashboard (~6h, NEW)

Per `architecture/DASHBOARD_VIEWER.md`. Order:
1. Today's activity stream
2. Recent entries by category (tabbed)
3. Pending-conflicts inbox
4. Anomaly inbox (with 11 categories from `architecture/ANOMALY_INBOX.md`)
5. Audit log search (entity-first default)
6. Worker provisioning UI (QR generation)
7. Bulk migration approval UI (3-stage)
8. Handler version distribution panel
9. Stock reorder alerts
10. Job-in-flight board
11. Ready-to-dispatch alarms

### Stage F′ — Cloud Functions ecosystem (~4h, NEW)

Per `architecture/CLOUD_FUNCTION_HOOKS.md`:
1. Token issuance + custom claims (provisioning)
2. Audit event generation (post-write trigger on every collection)
3. Event-sourcing aggregator (post-write triggers on event subcollections; CF idempotency via `last_applied_event_id`)
4. Topic digest hourly cron (compiles `topics/*.md`)
5. Schema migration normalization (Layer 3 with comprehensive safety)
6. Bulk migration admin function (3-stage: dry-run / sample-N / full-run)
7. Replay/rebuild admin function (rebuilds parent state from event log)
8. Anomaly detection (~11 categories)
9. Daily Firestore export to GCS (rollback safety)

Min-instances=1 set on event-sourcing aggregator + topic digest cron.

### Stage G′ — Adoption rollout prep (~2h, NEW)

Per `architecture/ADOPTION_PLAN.md`:
1. Laminated paper backup forms designed + printed (matching field layout)
2. Procurement: cheap Android phones for handlers (~Rs 5000/phone)
3. Daily huddle template + handler-as-trainer KPI definition
4. First handler provisioned via QR-in-person flow (validates the runbook)

### Stage H′ — Deploy alpha (~1h)

1. Construction overlay removed (Stage A)
2. PWA manifests confirmed for both `/sep-dashboard/` and `/sep-dashboard/entry/handler/`
3. GitHub Pages deploy
4. Smoke test: full path receive job → production entry → DFT → dispatch via handler PWA; dashboard sees all writes within 5s
5. Rollback plan: git revert to v2.1 commit `524769c`

**Total estimated active work: ~41h** (vs. ~22h in the original Session 13 kickoff — the increase reflects Phase 4-8 hardening + comprehensive form scope + dashboard breadth).

May 10 deadline is 3 days from this synthesis date. Realistic interpretation: **the architecture lock is the May 10 deliverable**, alpha implementation begins immediately after, alpha ships when ready (~late May).

---

## 6. Must-Adds Inventory (23 items)

Pulled from all 8 phases. Each is a "no MCQ — clear gap to plug" decision that ships in alpha.

### Auth (Phase 3 + 8)
1. **QR code in dashboard + owner scans worker phone in person** (supersedes URL-via-WhatsApp)
2. **`Worker.active_token_id` rotation + rejected-write inbox** for stolen-phone scenarios
3. **`HANDLER_PROVISIONING.md`** as runbook-grade documentation (per user instruction)

### Firestore rules (Phase 4)
4. **Min-bar validation in rules** (type, range, required, enum) — prevents malformed writes from landing
5. **`min_supported_build` config doc** + rules check stale-build rejection (with confirm-twice editor in admin UI)

### Conflict resolution (Phase 5)
6. **CF idempotency via `last_applied_event_id`** on every parent doc
7. **Admin replay/rebuild Cloud Function** — required before launch for buggy-CF recovery
8. **Per-entity "last updated Xs ago"** indicator on dashboard cards
9. **Pending-conflicts inbox surface** in dashboard (steward-exclusive disposition)

### Schema migration (Phase 6)
10. **TTL'd `_migrations_backup/`** parallel collection (30-day TTL)
11. **Daily Firestore export to GCS** (catastrophic rollback path)
12. **Migration-aware event replay** in CF replay tool
13. **Rules-vs-data skew tracker** in `SCHEMA_CHANGELOG.md`

### Handler UI (Phase 7)
14. **64px minimum touch target** (CSS token)
15. **Multi-modal submit confirmation** (toast + haptic + distinct audio cue)
16. **Form draft auto-save** to IndexedDB on every keystroke
17. **Idempotency key per form-open** (UUID generated at form open; ±5min server dedup window)
18. **Sanity range hard-blocks** on numeric fields (DFT >50 µm rejected; quantity outside 2σ prompts confirm)
19. **Supplier as first-class entity** (replaces freetext in Stock Refill); per-kg vs per-bag toggle
20. **Explicit offline-state copy** ("Saved on phone, not yet sent (4)") instead of color-only chip
21. **Paper backup forms** (laminated, same field layout, in every area)

### Steward affordances (Phase 8)
22. **`migration_batch_id` + `revert(batch_id)`** admin function
23. **Audit log entity-first default** ("show everything that touched Job J-4521"); free-text reason search hidden behind "advanced" tab

---

## 7. Acceptance Criteria for Phase 2.0-Alpha (Refreshed)

Hard requirements before alpha ships:

### Foundation
- [ ] Modular bundle (esbuild + 7-layer + 4-file CSS) per Stage A, all v2.1 functionality preserved
- [ ] Firestore schema deployed per `reference/SCHEMA.md`; security rules per `reference/FIRESTORE_RULES.ref.txt` deployable
- [ ] App Check enabled (Play Integrity + reCAPTCHA Enterprise)
- [ ] Staging Firebase project + emulator suite in CI
- [ ] Zod runtime validation at storage Layer 2 write boundary
- [ ] Audit log writes via CF admin SDK; client writes denied at rules

### Handler PWA
- [ ] PWA installable on Android via subpath `/entry/handler/`
- [ ] Provisioning end-to-end: Rishabh creates worker → QR displayed → worker scans → PWA installs → first form submission lands in dashboard within 5s
- [ ] All 9 forms ship with Zod validation, sanity hard-blocks, idempotency keys, draft auto-save
- [ ] Production Entry pre-fill defense bundle (visual diff + 15-min decay + job-change clear + first-of-session confirm-step) functional
- [ ] Big-button picker grid for high-frequency fields (job, machine, worker)
- [ ] 64px minimum touch targets enforced (component library)
- [ ] Devanagari labels primary; English toggle; iconography on primary actions; long-press TTS
- [ ] Multi-modal submit confirmation (toast + haptic + audio cue outside machine-noise band)
- [ ] Offline queue: pre-flush confirmation + queued-writes counter + persistent sync chip with explicit copy
- [ ] Stale-build rejection (config doc → rules) functional; handler shows "please reload" prompt
- [ ] iOS Safari handler officially unsupported; Android-only documented

### Dashboard
- [ ] All 11 minimal-viewer surfaces operational (§4)
- [ ] Pending-conflicts inbox + anomaly inbox steward-exclusive disposition
- [ ] Worker provisioning UI generates QR codes; re-issue + revoke flows tested
- [ ] Bulk migration approval UI: dry-run → sample-N → full-run with explicit approval gates
- [ ] Audit log search default to entity-first; advanced tab unlocks free-text
- [ ] Steward KPI weekly card (4 metrics: aging, edit rate, dispute reopens, anomaly precision)
- [ ] Build version distribution panel + min_supported_build editor with confirm-twice modal

### Cloud Functions
- [ ] Audit event generation post-write triggers on every collection
- [ ] Event-sourcing aggregators with `last_applied_event_id` idempotency on every parent doc
- [ ] Topic digest hourly cron compiles `topics/*.md`; first run successful
- [ ] Schema normalization Layer 3 CF with content-hash + per-write build metadata + circuit breaker
- [ ] Replay/rebuild admin function callable; tested on a sample parent doc
- [ ] Daily Firestore export to GCS; first export verified
- [ ] Min-instances=1 set on aggregator + topic digest CFs

### Operations
- [ ] First handler provisioned end-to-end via QR-in-person flow (validates `HANDLER_PROVISIONING.md`)
- [ ] Adoption plan in motion: parallel paper run started; Production Entry first; daily huddle scheduled
- [ ] Construction overlay removed
- [ ] v2.1 sunset + alpha live at `rishabh1804.github.io/sep-dashboard/`
- [ ] Architecture corpus committed to `docs/architecture/` and `docs/reference/`

---

## 8. The Adversarial Pattern (Workflow Convention)

Inherited from this Cowork session as a recurring practice:

**For every load-bearing decision phase:** spin up an adversarial reviewer agent after the initial proposal. Same prompt template each time:

- Stress-test the design
- Find what's wrong, what's underspecified, what scales poorly
- Severity-tag findings (BLOCKER / HIGH / MEDIUM / LOW / DEFENDABLE)
- Predict the most likely first-month failure mode

Findings then folded into multi-choice ratification questions (typically 2 rounds of 4 each). User answers; locks captured in `architecture/DECISION_LOG.md`.

This pattern caught:
- Token-in-URL leakage via WhatsApp crawler (Phase 4 BLOCKER)
- CF at-least-once delivery without idempotency guard (Phase 5 BLOCKER)
- Production Entry mis-attribution via stale pre-fill (Phase 7 BLOCKER prediction)
- Worker provisioning crawler exchange (Phase 8 BLOCKER)

…all of which would have shipped without the probe.

Recommended for Stage F implementation review: spin up an adversary agent before any major commit ("does this implementation match the architecture file? what does it miss?").

---

## 9. Status & Handoff

- **Phase 2 architecture:** LOCKED across 8 phases (this session, 7 May 2026)
- **Phase 2.0 alpha implementation:** Ready to begin (Session 13, Claude Code)
- **Phase 2.0 floor view:** Reframed to Phase 2.1 (the Session 12 design lock for the floor view is preserved unchanged)
- **Architecture corpus:** Committed in `docs/architecture/` (this synthesis points to per-decision detail)
- **Tooling:** design conversations stay in Cowork; coding moves to Claude Code per `CLAUDE.md` workflow rule
- **Next session:** Session 13 (Claude Code) reads this synthesis + `SESSION_13_KICKOFF.md`, executes Stages A-H′, deploys alpha, updates CLAUDE.md at close

---

## 10. References

- **`CLAUDE.md`** (root) — project meta-history including this session's closeout
- **`SESSION_13_KICKOFF.md`** (root) — refreshed implementation plan
- **`docs/SESSION_12_DESIGN_LOCK.md`** — Session 12 visual design lock (preserved verbatim for 2.1 implementation)
- **`docs/architecture/INDEX.md`** — architecture decision routing surface
- **`docs/architecture/DECISION_LOG.md`** — chronological journal of every ratified decision
- **`docs/reference/SCHEMA.md`** — canonical entity reference
- **`docs/reference/FIRESTORE_RULES.ref.txt`** — deployable rules file

---

*Synthesis authored 7 May 2026 by Aurelius (Cowork Session 12+ closeout). Implementation handoff to Session 13.*
