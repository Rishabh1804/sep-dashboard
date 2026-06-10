# Schema Changelog

**Phase:** 6 (Layer 1 — version stamp tracking)
**Status:** LIVE (initialized empty; populated as schema evolves)
**Authority:** Append-only. Every schema change documented here before deploy.

---

## How to Use

Each schema change adds an entry to this file BEFORE the change ships. Entry format:

```markdown
## v{N} — {change title}

**Date:** YYYY-MM-DD
**Author:** {who proposed}
**Type:** add-field | rename-field | change-field-type | delete-field | change-semantics | restructure
**Affected collection(s):** {collection names}
**Inter-collection deps:** {collections that must migrate first, or "none"}
**Migration function:** `MIGRATIONS[{N}]` in `functions/src/migrations/`
**Migration sha:** `{content hash}`
**Reason:** {1-2 sentences explaining why}

### Detail

{What changed, where, why; before/after schema sketches if useful}

### Rules-vs-data skew window

{Which compatibility branches in security rules can be dropped at which threshold; e.g., "Drop dual-name check `request.resource.data.actor_id != null || request.resource.data.author_user_id != null` after all docs reach __schema_version >= 8."}

### Dual-write window (if rename)

{When dual-write started; when it can stop; bounded by min_supported_build progression}

### Deprecation plan

{For deleted fields: `deprecated_at` set; ESLint rule added; 90-day TTL strip schedule}

### Backup snapshot

{`_migrations_backup/` retention; daily export anchor commit hash}

### Verification

- [ ] Migration function unit-tested in `functions/src/migrations/__tests__/`
- [ ] Zod schema updated in `src/shared/types/schemas.ts`
- [ ] TypeScript types regenerated
- [ ] Reference doc updated in `docs/reference/SCHEMA.md`
- [ ] Staging emulator suite passes with fixture data
- [ ] Production deploy + Layer 4 bulk migration (if needed) verified
```

---

## Initial Schema (v1)

**Date:** 2026-05-07 (Cowork Session 12+)

Initial Phase 2.0 schema — see [`../reference/SCHEMA.md`](../reference/SCHEMA.md) for current canonical reference.

All entities at `__schema_version: 1`. No migrations yet.

Foundational entities + collections:
- Top-level: `customers`, `items`, `jobs`, `workers`, `rooms`, `machines`, `stock_items`, `perimeter_segments`, `production_entries`, `dft_measurements`, `dispatch_events`, `audit_events`, `notes`, `topics` (CF-managed only), `config` (admin-managed)
- Subcollections per entity per [DATA_HIERARCHY.md](DATA_HIERARCHY.md)

---

## v2 — Reconcile model to sep-internal ground truth

**Date:** 2026-06-10
**Author:** Aurelius (Claude Code Session 14 — Stage B reconciliation, ratified by Rishabh)
**Type:** add-field | change-semantics | restructure
**Affected collection(s):** `jobs` (+ new `jobs/{jid}/job_lines`), `production_entries`, `customers`, `items`, `machines`
**Inter-collection deps:** `customers` + `items` import before `jobs`; `jobs` before `job_lines`; `job_lines` before `production_entries.item_id`
**Migration function:** none (greenfield — pre-deploy; no live docs to migrate)
**Migration sha:** n/a
**Reason:** The locked v1 model assumed Job = one customer + one item. The real system of record (sep-invoicing) issues challans with **many** part-lines, and the floor register keys on customer+SKU, not a job id. Reconciling before any data lands avoids a migration on live data.

### Detail

Three ratified decisions (AskUserQuestion, 2026-06-10):

1. **Firestore is SoR for the floor; sep-invoicing feeds it.** Jobs/customers/items carry sep-invoicing FKs (`sep_invoicing_challan_no`, `sep_invoicing_customer_id`, invoice ids). Billing stays authoritative in sep-invoicing; a one-time + ongoing importer (`src/shared/import/invoicing-import.js`) maps its JSON export into these collections.
2. **Challan = 1 Job + `job_lines[]` subcollection.** New `jobs/{jid}/job_lines/{lid}` (one per challan part-line). `Job.item_id` becomes OPTIONAL (single-item convenience only). `Job.received_kg` = sum over lines.
3. **Line/area capture grain.** `production_entries.machine_id` may reference an **area** id (`vat_a1`/`vat_a2`/`barrel`/`pickle_*`) in alpha; per-tank machines deferred to floor-view. Added `item_id`/`part_number`/`rounds`/`round_size` to `production_entries` (register records SKU + rounds).

Field-level: `customers` gained `is_informal`; `client_tier`/`default_quality_tier` documented as import-defaults (not in source); `default_billing_unit` mapped from `billingMode`. `items` gained `part_number`/`hsn`/`default_unit`, `customer_id` made optional, `wpp_grams` = `stdWeightKg × 1000` (source is kg/pc).

### Rules-vs-data skew window

Greenfield — no skew. Security rules validate v2 shape directly.

### Backup snapshot

n/a (no live data).

### Verification

- [x] Reference doc updated in `docs/reference/SCHEMA.md`
- [x] Importer + Jest tests (`tests/unit/invoicing-import.test.js`) against synthetic fixture
- [x] Zod schema added in `src/shared/types/schemas.js` (`validateImportOutput` / `validateDoc`)
- [ ] Staging emulator suite (Track 2 — needs live Firebase project)

### Track-2 preconditions (before the real 508-challan import)

- **Challan-number collisions.** `jobId = sep-{challanNo}` assumes challan numbers are unique across the whole export. If sep-invoicing resets numbering per financial year, two challans collapse into one Job on upsert. The importer now surfaces this in `stats.jobIdCollisions` / `collidingJobIds`; the Track-2 import runner MUST abort (or namespace ids by FY) when that count is non-zero — never merge silently.
- **Unit variants.** `normalizeUnit` folds KG/NOS variants and passes anything else through verbatim, which then fails the Zod `KG|NOS` enum and lands in the `validateImportOutput` failure report. Scan the real export's `unit` values before the seed so nothing surprising fails closed mid-run.

---

## v2 rules alignment + hardening (no document-shape change)

**Date:** 2026-06-10
**Author:** Aurelius (Claude Code — PR #17 + code-review findings)
**Type:** rules-change | validation-tightening
**Affected collection(s):** rules for `jobs`, `production_entries`, `dft_measurements`; Zod `JobSchema`; importer output hygiene
**Migration function:** none (validation only; no stored-shape change)

### Rules changes (docs/reference/FIRESTORE_RULES.ref.txt)

1. **`isValidJob` → v2** — `item_id` optional (challan = many `job_lines`); `client_tier_at_receipt` now an OPTIONAL snapshot (SCHEMA.md amended in lockstep — absent on imports/informal jobs; priority overlay treats absence as 'default'); NOS-only jobs valid (`received_kg == 0` with `received_pcs > 0`). Optional fields validated WHEN PRESENT: `received_pcs` typed + capped (< 1,000,000), `item_id` string, tier enum.
2. **jobs `create` requires `authoredBySelf()`** — author was spoofable on jobs (alone among client-writable event collections).
3. **`dft_measurements` update re-runs `isValidDftMeasurement`** — the 0–50µm hard block was bypassable via in-window edit.
4. **`buildSupported()` numeric** — `config/min_supported_build.value` is now a NUMBER and `app_version` is parsed with `int()`. The old string `>=` was lexicographic ('99' >= '100'), silently defeating stale-build rejection at multi-digit boundaries. Clients MUST stamp `app_version` as a numeric build counter (string form OK); non-numeric → denied (fail closed).
5. **`isValidProductionEntry` hardened** — `job_id`/`machine_id`/`worker_id` strings + station enum required (worker attribution per the domain model, matching the CF validator in `cross-doc.js`); each quantity validated when present; at least one of pcs/kg > 0.

### Rules-vs-data skew window

No stored docs yet (pre-deploy), so no skew on data. Cross-encoding skew CLOSED this change: Zod `JobSchema` now mirrors the rules (caps + at-least-one-positive refine + optional tier enum), and an importer-parity emulator test writes the synthetic-fixture import output through the jobs create rule. The importer also now strips explicit `undefined` values (Firestore setDoc rejects them).

### Track-2 preconditions (additive to the v2 entry's list)

- **Import path MUST use the Admin SDK** (bypasses rules): importer docs carry ISO-string `created_at` (fails `timestampIsServerSet`) and author `system:import` (no `workers/{uid}` doc → `notRevoked()` denies). The client-SDK path is for handler/dashboard live writes only.
- **`app_version` stamping** must move to numeric build counters before any client write path goes live (see rules change 4).

---

*Initialized 7 May 2026 by Aurelius. Append-only — every schema change adds an entry below.*
