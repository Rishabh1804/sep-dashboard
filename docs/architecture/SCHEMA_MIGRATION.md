# Schema Migration

**Phase:** 6
**Status:** LOCKED — 7 May 2026 (8 strengthened locks via 2 MCQ rounds + adversary probe)
**Note:** User chose "full 5-layer machinery as routine" instead of adversary's "always-add as default" recommendation. Schema cleanliness over migration-rarity. Safety nets are load-bearing.

---

## Problem

Schema evolves: new fields added, old fields renamed, types changed, semantics shifted. Multiple PWAs (handler, dashboard, future role-apps) consume the schema; some clients run stale builds for weeks. Cloud Functions also assume specific shapes. Get migration wrong and data corrupts silently.

## Adversarial Findings

3 BLOCKER + 7 HIGH + 1 LOW. Most critical:

- **BLOCKER** — Layer 2 read-adapter has no quarantine path for buggy migrations
- **BLOCKER** — No rollback for in-place data corruption
- **BLOCKER** — Forward-compat is mathematically asymmetric (handler PWA on stale build writing old field shape silently overwrites new shape)
- **HIGH** — 2-week dual-write window unrealistic for PWA-on-phone (iOS Safari + offline workers run stale code for weeks; Android-only mitigates but doesn't eliminate)
- **HIGH** — Runtime validation gap (TypeScript types don't run at runtime)
- **HIGH** — Predicted Month-1 failure: handler PWA writes old field name to freshly-migrated doc; doc has both old + new field; UI from different builds reads different fields → silent SLA breach

All addressed in safety-net layers.

## Locked Decision

### The 5 layers + safety nets

```
LAYER 1 — Schema version stamp on every doc
   __schema_version: number  (bumped only on breaking changes)
   ↓
LAYER 2 — Read-side adapter (storage Layer 2 with Zod)
   Every read passes through migrate(doc) → canonical shape
   Zod runtime validation per collection
   Per-migration try/catch + circuit breaker on error rate > 5%
   ↓
LAYER 3 — CF post-write normalization
   Every write triggers normalizer CF
   Skip if doc.__schema_version === CURRENT (kills 95% of invocations)
   Update normalizes in place + bumps version
   Self-fire prevention via before/after schema_version check
   Content-hash logging + per-write build metadata
   ↓
LAYER 4 — Eager bulk migration via admin tool (3-stage discipline)
   Stage 1: dry-run (read + diff report, no writes)
   Stage 2: sample-N (migrate 100 docs, surface for human review)
   Stage 3: full-run (after explicit approval; with migration_batch_id for revert)
   ↓
LAYER 5 — Forward-compatible writes (handler-side)
   Use Firestore update() with explicit field paths, never set() of whole doc
   Never write fields outside known schema
   Stale-build rejection at rules layer (config doc min_supported_build)
   Zod validation at write boundary catches shape violations
```

### Safety nets (must-adds + Round 1+2 ratifications)

| Safety net | What it does | When it saves you |
|---|---|---|
| **TTL'd `_migrations_backup/` collection** | Every Layer 3/4 normalization writes prior shape to backup with 30-day TTL | Bad migration normalized 10K docs incorrectly; restore via admin tool |
| **Daily Firestore export to GCS** | Catastrophic recovery snapshot | TTL backup expired; need to restore from N days ago |
| **Stale-build rejection at rules layer** | Config doc `min_supported_build`; rules reject writes from older clients | Handler PWA on 10-day-old build forced to reload before next write |
| **Zod runtime validation at storage Layer 2** | Every write validated against schema before commit | Type errors surface immediately; handler shows "cannot save: invalid data" |
| **Content-hash versioning of migrations** | Each migration tagged with sha; CF logs which migration ran on each doc | Detect docs touched by buggy migration version |
| **Three-stage bulk discipline** | Dry-run → sample-N → full-run with explicit approval gates | Sample-N catches edge cases before full-run blast radius |
| **Migration dependency DAG** | Inter-collection refs declared in changelog; orchestration computes order | Customer schema change before dependent Job schema change; multi-deploy coordinated |
| **Per-field `deprecated_at` + 90-day TTL strip + ESLint rule** | Bounded data sediment + bounded code sediment | Old fields cleaned up automatically; code references caught at build |
| **Migration-aware event replay** | Replay/rebuild CF runs migrations on historical events before applying | Schema migration on event shape; replay produces consistent parent state |
| **Rules-vs-data skew tracker** | Changelog entry records which compatibility branches drop at which schema version | Don't accidentally drop dual-name rule check before all docs migrated |
| **`migration_batch_id` + `revert(batch_id)` admin function** | Companion to bulk migration; full-run tagged; revertible | Bad full-run discovered hour 2; revert restores prior shapes |

### Migration function structure

```typescript
// In functions/src/migrations/index.ts
export const MIGRATIONS: Record<number, MigrationFn> = {
  4: {
    fn: (doc) => ({ ...doc, qty_pcs: doc.qty }),     // v3 → v4
    sha: 'abc123def456',                              // content hash
    description: 'Rename qty to qty_pcs',
    affected_collection: 'production_entries',
    inter_collection_deps: [],
  },
  5: {
    fn: (doc) => ({
      ...doc,
      status: doc.state === 'done' ? 'resolved' : doc.state
    }),                                                // v4 → v5
    sha: '789ghi012jkl',
    description: 'Migrate state enum to status',
    affected_collection: 'notes',
    inter_collection_deps: ['users'],                 // requires users migrated first
  },
};
```

`MigrationFn` is a pure function: `(doc: any) => any`. Unit-tested with Jest.

### Schema deploy lifecycle

1. **Author migration** in `functions/src/migrations/`; Jest unit tests
2. **Update `SCHEMA_CHANGELOG.md`** with: change type, affected collection, dependencies, rules-skew window, deprecation plan
3. **Deploy to staging** Firebase project; emulator suite runs against fixture data
4. **CI check:** rule changes deploy alongside; staging emulator tests pass
5. **Deploy to production** (atomic; both rules + CF + Zod schemas)
6. **Run Layer 4 bulk migration** via admin UI if needed; 3-stage discipline (dry-run / sample-N / full-run)
7. **Monitor** for 24h: CF normalizer error rate, Zod validation failures, audit log anomalies
8. **Drop dual-write** (e.g., old field name still being written) at scheduled threshold per changelog
9. **Field deprecation cleanup** runs on 90-day TTL automatically

### Verification per change

```typescript
// functions/src/migrations/__tests__/v4_to_v5.test.ts
test('migrates state to status with done → resolved', () => {
  const v4 = { __schema_version: 4, state: 'done', body: '...' };
  const v5 = MIGRATIONS[5].fn(v4);
  expect(v5.status).toBe('resolved');
  expect(v5.state).toBe('done');  // Don't strip; deprecation handles
});

test('preserves unrelated fields', () => {
  const v4 = { __schema_version: 4, state: 'open', custom_field: 'preserved' };
  const v5 = MIGRATIONS[5].fn(v4);
  expect(v5.custom_field).toBe('preserved');
});

test('handles missing source field gracefully', () => {
  const v4 = { __schema_version: 4 };
  const v5 = MIGRATIONS[5].fn(v4);
  expect(v5.status).toBeUndefined();  // Don't fabricate
});
```

## Rationale

**Why full 5-layer machinery (user choice over adversary's always-add):**
- Schema cleanliness preserved over time; no `current_status_v3` field name sediment
- Safety nets compensate for migration-rarity loss
- Routine migrations require MORE discipline (3-stage bulk, content-hash, DAG ordering) which the safety nets enforce

**Why every layer matters:**
- **Layer 1** — version stamp is the routing key for all migration logic
- **Layer 2** — read-adapter ensures clients always operate on canonical shape regardless of disk shape
- **Layer 3** — disk converges to canonical over time as docs are touched (~30 days for active docs)
- **Layer 4** — admin tool for breaking changes that can't wait for natural touch
- **Layer 5** — handler-side discipline minimizes the asymmetric-forward-compat hole

**Why these safety nets specifically:**
- TTL backup — recovers from bad migrations within 30 days; cheap (Firestore TTL is free)
- Daily export — catastrophic recovery beyond 30 days
- Stale-build rejection — closes the predicted Month-1 failure mode
- Zod — catches shape violations at write time, not after they land
- 3-stage bulk — sample-N is human-in-the-loop checkpoint
- Migration DAG — prevents cross-collection ref breakages
- Deprecation lifecycle — bounds technical sediment

## Acceptance Criteria (the bar)

- [ ] Every Firestore doc carries `__schema_version: number`; written on create; updated on Layer 3 normalization
- [ ] Layer 2 storage wrapper applies `migrate(doc)` for every read; circuit breaker on error rate
- [ ] Zod schemas defined per collection; validation runs at write boundary in storage Layer 2
- [ ] Layer 3 normalizer CF deployed; trigger filter prevents self-fires; content-hash + per-write build metadata logged
- [ ] Layer 4 bulk migration UI: 3-stage flow (dry-run / sample-N / full-run) with explicit approval gates
- [ ] `migration_batch_id` tagged on every Layer 4 write; `revert(batch_id)` admin function tested
- [ ] `_migrations_backup/` collection with 30-day TTL; restore tested
- [ ] Daily Firestore export to GCS configured; first export verified retrievable
- [ ] Rules check `app_version >= min_supported_build`; config doc edit gated by confirm-twice modal
- [ ] Migration dependency DAG documented in `SCHEMA_CHANGELOG.md` for inter-collection refs
- [ ] Custom ESLint rule errors on references to deprecated field names
- [ ] Replay/rebuild CF applies migrations to historical events before computing derived state

## Implementation Notes

- Migration functions: pure JS / TS in `functions/src/migrations/`; runnable both server-side (CF) and client-side (storage Layer 2)
- Use shared module: `import { MIGRATIONS } from '@shared/migrations'` accessible to both apps + CFs
- Zod schemas in `src/shared/types/schemas.ts`; export per-collection schemas + per-version `safeParse` helpers
- TTL backup collection: `_migrations_backup/{batch_id}/{doc_path}/{timestamp}` with TTL field on each doc
- Daily export: `gcloud firestore export gs://sep-dashboard-exports/{date}` via scheduled CF + service account
- Stale-build rejection rule: helper `function buildSupported() { return request.resource.data.app_version >= get(/databases/$(database)/documents/config/min_supported_build).data.value; }`. Apply to all client writes
- Admin UI for bulk migration: dashboard surface in `STEWARD_AFFORDANCES.md`

## Future Considerations

- **GraphQL/Data Connect layer** — Firestore Data Connect is in preview; revisit 2027
- **Auto-migration suggestion** — ML/heuristic that proposes migration code from before/after schema diffs
- **Cross-environment schema diff** — staging vs prod schema drift detection
- **Live migration progress UI** — dashboard surface for ongoing Layer 4 full-runs (per-doc progress, ETA, current rate)
- **Migration test harness** — fuzzing migrations against generated doc shapes; catches edge cases pre-deploy

## Related

- [SCHEMA_CHANGELOG.md](SCHEMA_CHANGELOG.md) — append-only log of every change
- [FIRESTORE_RULES.md](FIRESTORE_RULES.md) — `buildSupported()` helper + min_supported_build check
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — schemaNormalizer + bulkMigration + replayRebuild + revertMigrationBatch
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — bulk migration approval UI
- [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md) — migration-aware event replay
- [../reference/SCHEMA.md](../reference/SCHEMA.md) — canonical schema reference

---

*Authored 7 May 2026 by Aurelius.*
