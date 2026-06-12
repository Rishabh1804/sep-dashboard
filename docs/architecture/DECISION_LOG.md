# Decision Log

Chronological log of every ratified architecture decision since Phase 2 architecture work began. Each entry: date, phase, decision summary, adversary severity counts, divergence from recommendation (if any), pointer to lock file.

This file is **append-only**. Edits to past entries are forbidden; corrections go in new entries with explicit "supersedes" notation.

---

## 2026-05-07 — Cowork Session post-12 (Phase 1-8 architecture lock)

Conducted in single session: 8 phases ratified, 5 adversarial probes run (Phases 4, 5, 6, 7, 8), 50+ decisions locked, 23 must-adds documented, 3 deliberate divergences from adversary recommendations.

### Phase 1 — Deploy topology

**Decision:** Subpath dual-PWA monorepo (Option A); will generalize to N-PWA as role-apps added.

**Adversary:** N/A (foundational decision; no probe)

**Divergence:** None

**Lock file:** [DEPLOY_TOPOLOGY.md](DEPLOY_TOPOLOGY.md)

**Mid-phase reframes:**
- *1.5 — Multi-handler + role-app pattern:* each role gets its own role-app (handler, future Inspector, Dispatch, etc.); shared Layer-4 component library + role-specific Layer-5+ screens (middle path).
- *1.6 — Data capture first:* Phase 2.0 alpha ships data capture handler app + minimal data viewer dashboard. Floor view (Konva) deferred to 2.1. Revises Session 12 §9 MVP cut. "Excellent data capture" becomes the north star.

### Phase 2 — Data hierarchy & compartments

**Decision:** Hybrid Firestore shape (top-level entities + queryable events; subcollections for natural children). Compartments: user-identity (always on) + role-app (server-side claims) + 24h handler edit window. Bifurcated read/write surfaces (Firestore live + hourly-cron compiled `topics/*.md`). Topic-as-aggregator pattern generalizes beyond notes.

**Adversary:** N/A (decision pre-dated MCQ pattern; informed by external research on pocock-agents repo + Karpathy on agentic engineering)

**Divergence:** None

**Lock files:** [DATA_HIERARCHY.md](DATA_HIERARCHY.md), [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md), [TOPIC_DIGESTS.md](TOPIC_DIGESTS.md)

**Influenced by:** Pocock skills convention (markdown + frontmatter; agent-readable summary; progressive disclosure); Karpathy "context is the program" (compiled markdown wiki as agent-consumable layer; bifurcated write/read surfaces).

### Phase 3 — Auth model

**Decision:** Firebase custom tokens; provisioning via URL with embedded token (later superseded by Phase 8 QR-in-person flow); custom claims (`roles[]`, `is_steward`, `is_admin`); two-tier revocation (`notRevoked()` on writes + Admin SDK refresh-token revocation; later refined by Phase 4 hybrid model).

**Adversary:** N/A in Phase 3 (Phase 4 adversary surfaced WhatsApp transport BLOCKER; fixed in Phase 8)

**Divergence:** None

**Lock files:** [AUTH_MODEL.md](AUTH_MODEL.md), [HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md)

**Companion deliverable:** Runbook-grade `HANDLER_PROVISIONING.md` per user instruction "Let's make sure that the provisioning flow is well documented."

### Phase 4 — Firestore security rules

**Decision:** 8 strengthened locks via two MCQ rounds:
1. Rule structure with five helpers + default-deny pattern
2. Phase 2 hierarchy refinement: drop `{entity}/{id}/notes` subcollections; consolidate to top-level `/notes/`
3. Hybrid revocation: `notRevoked()` on writes only + 15min force-refresh ID token + Admin SDK refresh-token revocation at fire-time
4. Soft-delete by default (`deleted_at` field) + admin hard-delete escalation
5. Bootstrap token: strip-on-load + service-worker handoff (later superseded by Phase 8 QR flow)
6. Update pinning: `author_user_id` AND `created_at` immutable on update
7. Validation: minimum-bar in rules (type + range + required + enum) + Cloud Function pre-write hooks for cross-doc invariants
8. Operational: App Check day-one + CF rate limiter + staging Firebase project + emulator suite in CI

**Adversary findings:** 3 BLOCKER + 7 HIGH + 4 MEDIUM. All BLOCKERs and key HIGHs ratified per recommendation; MEDIUMs documented as constraints (G4 custom claims size cap, G6 recursive wildcard footgun, Attack 4 steward exfil acceptable for single-org, Attack 5 edit window churn mitigated by timestamp pinning).

**Divergence:** None (all 8 ratified per adversary recommendation)

**Lock files:** [FIRESTORE_RULES.md](FIRESTORE_RULES.md), [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md)

### Phase 5 — Conflict resolution

**Decision:** 8 strengthened locks via two MCQ rounds:
1. Online edits: Firestore transactions (`runTransaction()`), not custom version-field OCC
2. Offline edits: LWW on replay + audit log conflict surface
3. Conflict UI: pending-conflicts inbox in dashboard (never modal on handler PWA)
4. Event-sourcing/OCC split: aggressive (`priority_bump` events + all `health_score` / `mood_score` derived; OCC reserved for genuinely user-edited content)
5. Timestamp ordering: server-primary + client tiebreaker (both `clientCreatedAt` and `serverTimestamp` stored)
6. Burst handling: event coalescing within 5-second debounce window
7. Reinstall mitigation: pre-flush confirmation + queue summary on app open if queued writes detected
8. Cold starts: min-instances=1 always-warm CF + per-entity "last updated Xs ago" indicator

**Must-adds (4):**
- CF idempotency via `last_applied_event_id` on parent doc
- CF replay/rebuild admin tool (callable function; required before launch)
- Per-entity "last updated Xs ago" indicator on dashboard cards
- Pending-conflicts inbox surface (the dashboard side of the offline LWW model)

**Adversary findings:** 2 BLOCKER + 11 HIGH. Predicted Month-1 failure: handler offline-queue race silently drops owner edit, owner notices 2 days late, trust collapses by week 3.

**Divergence:** None

**Lock files:** [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md), [EVENT_SOURCING.md](EVENT_SOURCING.md)

### Phase 6 — Schema migration

**Decision:** 8 strengthened locks via two MCQ rounds:
1. Schema discipline: **Full 5-layer machinery as routine** (DIVERGENCE — adversary recommended "always-add as default")
2. Rollback safety: TTL'd `_migrations_backup/` parallel collection (30-day TTL) + daily Firestore export to GCS (belt + suspenders)
3. Stale-build rejection: security rules check `min_supported_build` from config doc; reject writes from clients below floor
4. Runtime validation: Zod at storage-wrapper write boundary
5. Layer 3 CF safety: comprehensive (trigger filter + content-hash logging + per-write build metadata + circuit breaker on error rate)
6. Layer 4 bulk discipline: three-stage (dry-run → sample-N → full-run) with explicit approval at each stage
7. Cross-collection refs: migration dependency DAG + multi-deploy orchestration tools
8. Deprecated fields: per-field `deprecated_at` + 90-day TTL strip + custom ESLint rule blocking references

**Must-adds (2):**
- Migration-aware event replay (CF replay tool runs migrations on historical events before applying)
- Rules-vs-data skew tracker in rules-changelog (records which compatibility branches can be dropped at which schema version)

**Adversary findings:** 3 BLOCKER + 7 HIGH + 1 LOW.

**Divergences:**
- **Q1: User chose "Full 5-layer machinery as routine" instead of adversary's "always-add as default."** Schema cleanliness prioritized over migration-rarity. Safety nets in Q2-4 + Round 2 do compensating work; routine migrations require MORE discipline, not less.

**Lock files:** [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md), [SCHEMA_CHANGELOG.md](SCHEMA_CHANGELOG.md)

### Phase 7 — Handler UI shell + forms

**Decision:** 8 strengthened locks via two MCQ rounds:
1. i18n: Devanagari primary + iconography + audio TTS + Indian numbering + dd/mm/yyyy
2. Production Entry pre-fill defenses: full bundle (visual diff highlight + 15-min time-decay + job-change auto-clear + confirm-job step at session start)
3. Check-in/out primitive: form with smart defaults (DIVERGENCE — adversary recommended top-bar one-tap chip; user kept form for audit clarity, mitigated by ≤2 effective taps via aggressive smart defaults)
4. iOS Safari support: Android-only handler PWA + procurement policy (~Rs 5000/phone)
5. Picker primitive: big-button picker grid + typeahead fallback for high-frequency fields
6. Note primitive: structured form only (DIVERGENCE — adversary recommended voice-primary FAB; user kept form because notebook handler is the literate steward who structures observations on workers' behalf)
7. Dashboard scope: bring forward critical operational surfaces from v2.1 (job-in-flight board, ready alarms, stock alerts; defer productivity rollup + DFT-fail queue to 2.1)
8. Adoption: phased rollout with 4-week parallel paper run, Production Entry first, daily huddles, laminated paper backups

**Must-adds (8):**
- 64px minimum touch target floor (component library token)
- Multi-modal submit confirmation (toast + haptic + distinct audio cue outside machine noise band)
- Form draft auto-save to IndexedDB on every keystroke
- Idempotency key per form-open (UUID generated at form open, sent with submit; server dedupes ±5min window)
- Sanity range hard-block on numeric fields (DFT >50 µm rejected; quantity outside 2σ of rolling mean prompts confirm)
- Supplier as first-class entity in Stock Refill (replaces freetext); per-kg vs per-bag toggle explicit
- Explicit offline-state copy ("Saved on phone, not yet sent (4)") instead of color-only chip
- Paper backup forms — laminated, same field layout, in every area; handler batch-enters when 4G + wifi both down

**Adversary findings:** 6 BLOCKER + 11 HIGH + 4 MEDIUM. Predicted Month-1 failure: Production Entry mis-attribution via stale pre-fill + silent toast confirmation = 8-12% wrong-job rate within 2 weeks.

**Divergences:**
- **Round 1 Q3: Check-in/out kept as form** (vs adversary's top-bar chip). Reading: form-level audit trail prioritized over speed. Mitigated by smart-default optimization to ≤2 effective taps.
- **Round 2 Q2: Note structured form kept** (vs adversary's voice-primary FAB). Reading: notebook handler IS the literate steward; structured form is their tool, not floor worker's. Workers verbally report; handler structures.

**Lock files:** [HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md), [HANDLER_FORMS.md](HANDLER_FORMS.md), [ADOPTION_PLAN.md](ADOPTION_PLAN.md), [DASHBOARD_VIEWER.md](DASHBOARD_VIEWER.md), [EXCELLENT_DATA_CAPTURE.md](EXCELLENT_DATA_CAPTURE.md)

### Phase 8 — Steward affordances

**Decision:** 7 strengthened locks via two MCQ rounds:
1. Worker provisioning: QR code displayed in dashboard + owner scans worker phone in person (supersedes Phase 3 URL-via-WhatsApp transport)
2. Anomaly inbox: cut to 6 high-signal + 5 critical adds (~11 total). Cut: 2σ outliers (→ 3σ + min-30-sample gate + per-field tuning), stock<0 (→ rules rejection), stale build (→ rules rejection). Add: same-job-two-machines, customer name fuzzy collision, DFT-on-non-plated-job route violation, dispatched > received, worker production while off-shift.
3. Edit-with-reason: structured enum reason (typo / operator-misread / equipment-misread / customer-disputed / late-correction / other) + optional evidence ref + per-steward distribution tracking
4. Steward KPI: four-metric weekly card (anomaly inbox aging, edit-with-reason rate per 1000 entries, dispute reopens, anomaly precision)
5. Re-issue token: `Worker.active_token_id` rotation + rejected-write inbox (rules check `request.auth.token.token_id == worker.active_token_id`; old token instantly invalidated even on offline replay)
6. Bulk tools: bulk disposition (multi-select + single reason) + quick-correct inline edit (for typo-fixes without full modal)
7. Steward/admin role boundary: anomaly inbox disposition + KPI weekly card are steward-exclusive (admin can view, only steward closes); admin retains override authority on disputed steward decisions

**Must-adds (3):**
- `migration_batch_id` + `revert(batch_id)` admin function (companion to Phase 6 bulk migration approval; makes sample-N actually safe)
- Audit log search defaults to entity-first context ("show everything that touched Job J-4521"); free-text reason search hidden behind "advanced" tab
- `min_supported_build` editor with confirm-twice modal (bumping it can lock out handlers; needs friction)

**Adversary findings:** 2 BLOCKER + 5 HIGH + 1 MEDIUM. Re-confirmed Phase 3 BLOCKER 1 (token transport via WhatsApp) wasn't fully solved by SW handoff because crawler can exchange the token before worker opens; QR-in-person supersedes.

**Divergence:** None (all ratified per adversary recommendation)

**Lock files:** [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md), [ANOMALY_INBOX.md](ANOMALY_INBOX.md)

---

## Tally

- **Phases ratified:** 8 (1-8)
- **Decisions locked:** 50+ across all phases
- **Must-adds:** 23 (8 Phase 7 + 4 Phase 5 + 3 Phase 8 + 6 Phase 6 + 2 Phase 4)
- **Adversary findings absorbed:** 16 BLOCKER + ~50 HIGH/MEDIUM across 5 probes
- **Deliberate divergences from adversary:** 3 (Phase 6 Q1 schema discipline; Phase 7 R1 Q3 check-in primitive; Phase 7 R2 Q2 note primitive)

---

*Decision log maintained by Aurelius. Append-only. Initialized 7 May 2026.*

---

## 10-12 June 2026 — Stage B execution + Track 2 ignition (Claude Code, Session 14)

**Context:** First sessions with live resources. Stage B split into **Track 1** (code-only) and **Track 2** (live Firebase), executed across PRs #16-#20.

**Decisions ratified (Rishabh, AskUserQuestion 2026-06-10, PR #16):**
1. **Firestore is SoR for the floor; sep-invoicing feeds it** — the importer (`src/shared/import/invoicing-import.js`) is the deterministic bridge from the sep-invoicing JSON export.
2. **Schema v2: challan = 1 Job + `jobs/{jid}/job_lines` subcollection** — the v1 one-job-one-item model didn't survive contact with multi-line challans. `Job.item_id` optional; production entries carry `part_number`/`rounds`/`round_size`; `machine_id` may be an area id in alpha.
3. **Capture grain = line/area** (register reality: customer+SKU per round, per area).
4. **Track 2 gated on live resources** — staging project `sep-dashboard-staging` (asia-south1, production-mode rules) created 2026-06-11 by Rishabh.

**Decisions made in implementation (PR #18 + review pass, 2026-06-11/12):**
1. **Server `permission-denied` is TRANSIENT, not permanent** — the rules read mutable state (`active_token_id`, `revoked_at`, `min_supported_build`), so a denial can be environmental; only content-deterministic mapper pre-rejections park in the rejected store (with retry + discard affordances). Prevents a token rotation from sweeping a day's queue into discard-land.
2. **Idempotency = doc id = idempotency key; existence check on the failure path only** — happy path costs 1 write 0 reads; crash/concurrent replay detected via the rules' own pinning denial → getDoc → treat-as-synced.
3. **Numeric `BUILD` counter in Layer 3** stamped as `app_version` per the hardened `buildSupported()`; `min_supported_build` is **create-only on seed** (raising the gate is a deliberate admin action, never a side effect of reseeding).
4. **DFT outcome is an explicit form field** (inspector judgment is a field, not a formula); 8-12 µm derivation survives only as a flagged fallback for pre-field queued records. `passivation` removed from station options (rules don't model it — silent reject trap).
5. **Both SWs runtime-cache hashed `dist/chunks/*` only** — never non-hashed entry bundles (would freeze builds past their CACHE_NAME version).
6. **Admin plane = GitHub Actions** (`firebase-admin.yml` workflow_dispatch: deploy-rules / mint-token / seed-dry-run / seed-fixture / verify-e2e) consuming the `FIREBASE_SERVICE_ACCOUNT_STAGING` repo secret; inputs pass via env (never `${{ }}` splicing — script injection). Cloud-session env vars are plain-text and must never hold the key.

**Verification (2026-06-12):** `verify-e2e` run green against live staging — self-mint → `signInWithCustomToken` → real `createTransport()` write accepted by the deployed rules → read-back → idempotent replay (rules denied the duplicate, transport recognized existing doc). Auth → transport → rules → Firestore proven end-to-end.

**Known blocked:** workflow `deploy-rules` needs IAM roles on the service account (Firebase Rules Admin + Service Usage Consumer); rules were published via console this round. Real 508-challan seed awaits the fresh sep-invoicing export. Prod project not yet created.

**Lock files:** `docs/reference/SCHEMA.md` (v2), `SCHEMA_CHANGELOG.md`, `docs/reference/FIRESTORE_RULES.ref.txt` (deployed), `tests/rules/` (27 emulator tests incl. importer- and transport-parity)

## 12 June 2026 (late) — Stage D field completion + Stage F minimal viewer (Claude Code, Session 15)

**Context:** Track 2 live + seeded. The session's build target (T-CN ③ in
soma-internal): complete the handler forms to Stage D field level in the
codex evidence order, then stand up the minimal dashboard viewer.

**Stage D — forms completed in evidence order:**
1. **Check-in (T-CH first):** + `slot` (morning_ot / regular / evening_ot),
   clock-inferred default, one-tap override. Each in/out now lands directly
   on the payroll OT decomposition (morning 6–8:30 = 3 hr; evening post-5).
2. **Production:** + `rounds` / `round_size` (register grain: "108-round",
   "25×6"); total derivable (rounds × size) when not entered; explicit total
   wins; rounds persist as the productivity denominator.
3. **Job receipt (IM):** + `challan_no` (customer label, not key) +
   `received_pcs` (NOS-only challans); kg required unless pcs present.
4. **Stock depletion (chemistry):** + `reason` selector (rules enum) +
   `level_after` (0 = NIL stock-take → Live reorder alert).
5. **Note (power-cut):** + `power_cut` / `incident` kinds + `priority`
   (normal/urgent).

**Skew rulings (both sides documented in SCHEMA_CHANGELOG v2.2):**
- **stock_refill cost/supplier → rules relax** (optional, validated when
  present; `cost_unit` must accompany `unit_cost`). Evidence: zinc PO #70
  arrived unpriced 9 Jun, priced copy due 13 Jun — receipt-time cost is
  routinely unknown; a forced fake cost would corrupt the weighted-average
  rollup. The mapper's pre-rejection is removed; until the relaxed rules
  deploy (IAM-gated), costless refills queue as TRANSIENT denials and drain
  on deploy — eventual consistency, not the rejected-store.
- **passivation station** — confirmed resolved form-side (folded into
  plating per the locked v2 schema); the transport guard stays.

**Form-engine extensions:** `required` may be a function of form state
(quantity-unless-rounds, kg-unless-pcs); fields may declare a `default`
(value or function — the clock-inferred slot).

**Stage F — Live tab (dashboard):** minimal viewer per the 12 Jun targets,
not the full DASHBOARD_VIEWER.md surface: activity stream (merged
production / jobs / DFT / dispatch / notes + CG shifts / depletions),
today's KPI strip (entries · NOS · kg · jobs in · dispatches · DFT pass ·
check-ins), NIL-stock + overdue-job warnings (12 h Ready loiter / 24 h SLA).
Firebase loads via the shared dynamic-import session boot
(`src/shared/firebase-session.js`, extracted from the handler's verified
firebase-boot path); sign-in = mint-token `#token` fragment on the
dashboard URL. Honest empty states: not-signed-in instructions; a hint
when CG reads are denied pre-rules-deploy.

**Rules additions:** collection-group READ matches for `shifts` +
`depletions` (Live's check-in stream + NIL alerts; writes stay
path-scoped). CG queries are issued without orderBy so no composite index
is required; client sorts.

**Versioning:** BUILD 1 → 2 (`min_supported_build` stays 1 — no fleet
break); APP_VERSION 2.1.0-alpha.3; both SW caches bumped.

**Verification:** unit 124 · e2e 38 (Live-tab smoke added; tab tour now
covers 8 tabs) · rules-emulator 30 (receipt relax + level_after + CG-read
coverage; transport-parity extended to the six new record shapes) — all
green locally.

**Known blocked (unchanged):** workflow `deploy-rules` re-run this session
still 403s on serviceusage — the IAM grant (Firebase Rules Admin + Service
Usage Consumer on the staging SA) remains with the Architect. The relaxed
rules + CG reads are code-complete and deploy with one click once granted.
