# Architecture Decisions — Index

**Project:** SEP Dashboard Phase 2
**Status:** Phase 1-8 LOCKED · 7 May 2026 (Cowork Session post-12)
**Authority:** Each linked file is the single source of truth for its decision area. CLAUDE.md is the project meta-history; this folder is the decision repository.

---

## Read order for new contributors (Claude Code, contractors, future-Aurelius)

1. **`CLAUDE.md`** (repo root) — project meta-history; persona; commit cadence; tooling boundaries
2. **`docs/SESSION_HANDLER_ARCH.md`** — synthesis of Phase 1-8 + executable Stage F handoff
3. This file — routing surface for per-decision detail
4. Per-file detail as needed (linked below)
5. **`docs/reference/SCHEMA.md`** — canonical entity reference
6. **`docs/architecture/DECISION_LOG.md`** — chronological journal of every ratification + divergence

---

## Decisions by Phase

### Phase 1 — Deployment topology
- **[DEPLOY_TOPOLOGY.md](DEPLOY_TOPOLOGY.md)** — Subpath dual-PWA monorepo (will generalize to N-PWA); same repo, two esbuild entries, two manifests, scoped service workers; middle path (shared Layer-4 component library + role-specific Layer-5+ screens)

### Phase 2 — Data hierarchy & compartments
- **[DATA_HIERARCHY.md](DATA_HIERARCHY.md)** — Hybrid Firestore shape: top-level entities + queryable events; subcollections for natural children
- **[STRUCTURED_NOTES.md](STRUCTURED_NOTES.md)** — Notes-as-mem schema (open `kind` discriminator, summary, revisions[], typed links, status/priority collapsed)
- **[TOPIC_DIGESTS.md](TOPIC_DIGESTS.md)** — Bifurcated read/write: Firestore for live, hourly-cron-compiled `topics/*.md` for agent-consumable / forensic / portable layer

### Phase 3 — Auth model
- **[AUTH_MODEL.md](AUTH_MODEL.md)** — Firebase custom tokens; custom claims (`roles[]`, `is_steward`, `is_admin`); two-tier revocation
- **[HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md)** — Runbook-grade flow: QR-in-person provisioning (Phase 8 superseded URL-via-WhatsApp transport)

### Phase 4 — Firestore security rules
- **[FIRESTORE_RULES.md](FIRESTORE_RULES.md)** — Five helpers + default-deny; min-bar validation; pinned `author_user_id` + `created_at` on update; hybrid revocation; App Check; staging project + emulator CI
- **[CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md)** — CF responsibilities (cross-doc invariants, idempotency via `last_applied_event_id`, replay tool, post-write normalization, audit log generation)

### Phase 5 — Conflict resolution
- **[CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md)** — Online: Firestore transactions; Offline: LWW + audit-log surface; pending-conflicts inbox; server-primary timestamps + client tiebreaker; event coalescing 5s; min-instances=1; staleness indicators
- **[EVENT_SOURCING.md](EVENT_SOURCING.md)** — Aggressive split (priority_bump, all health/mood scores → event-sourced); idempotency contract; replay/rebuild admin tool

### Phase 6 — Schema migration
- **[SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md)** — Full 5-layer machinery as routine practice + safety nets (TTL backup + daily export, stale-build rejection, Zod, content-hash versioning, three-stage bulk discipline, dependency DAG, deprecation lifecycle)
- **[SCHEMA_CHANGELOG.md](SCHEMA_CHANGELOG.md)** — Append-only change log (starts empty; populated as schema evolves)

### Phase 7 — Handler UI shell + forms
- **[HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md)** — Three-layer screen hierarchy; universal form template; offline UX; smart defaults; Devanagari + icons + audio TTS; 64px touch targets; multi-modal submit confirmation
- **[HANDLER_FORMS.md](HANDLER_FORMS.md)** — Form-by-form spec (field-level) for the 9 alpha forms
- **[ADOPTION_PLAN.md](ADOPTION_PLAN.md)** — 4-week phased rollout: parallel paper + app, Production Entry first, daily huddles, handler-as-trainer
- **[DASHBOARD_VIEWER.md](DASHBOARD_VIEWER.md)** — Minimal data viewer scope: critical operational surfaces brought forward from v2.1
- **[EXCELLENT_DATA_CAPTURE.md](EXCELLENT_DATA_CAPTURE.md)** — North star + measurable bar (speed, accuracy, completeness, reliability, forensics, recoverability, adoption-friendly)

### Phase 8 — Steward affordances
- **[STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md)** — Anomaly inbox + edit-with-reason + audit log search + bulk disposition + quick-correct + KPI weekly card + active_token_id rotation
- **[ANOMALY_INBOX.md](ANOMALY_INBOX.md)** — The 11 categories (6 cuts from original 9 + 5 critical adds) with thresholds + dispositions

---

## Reference (canonical artifacts)

- **[../reference/SCHEMA.md](../reference/SCHEMA.md)** — Canonical schema; all entities, all fields, with `__schema_version`
- **[../reference/FIRESTORE_RULES.ref.txt](../reference/FIRESTORE_RULES.ref.txt)** — Deployable rules file (source of truth for `firebase deploy --only firestore:rules`)

---

## Operational artifacts

- **[DECISION_LOG.md](DECISION_LOG.md)** — Chronological log of every ratified decision + adversary findings + divergences. Append-only. The journal Aurelius keeps.
- **[../topics/INDEX.md](../topics/INDEX.md)** — Per-entity wiki digests routing surface (populated post-launch by hourly cron from Firestore data)

---

## Conventions

**Status tags:** Each architecture file carries `Status: LOCKED ({date})` near the top. A change requires (1) a new dated entry in `DECISION_LOG.md`, (2) the file's status updated, (3) cross-references audited.

**File template:** Every architecture file follows this structure:

1. Problem
2. Options Considered
3. Adversarial Findings (severity-tagged)
4. Locked Decision
5. Rationale
6. Acceptance Criteria
7. Implementation Notes
8. Future Considerations
9. Related

**Cross-references:** Link to other architecture files relatively (`[FILENAME.md](FILENAME.md)`); to reference files via `../reference/`; to root files via `../../`.

**Update cadence:** Architecture files updated when their *decision* changes (not when implementation evolves). Implementation evolution lives in code + commit history. Architecture files are the *what* and *why*; code is the *how*.

**Authority:** When code conflicts with an architecture file, the architecture file is authoritative — fix the code or open a new ratification. When two architecture files conflict, raise a decision in DECISION_LOG.md and update both with the resolution.

---

*Index maintained by Aurelius. Last refreshed: 7 May 2026 (post-Cowork Session 12+).*
