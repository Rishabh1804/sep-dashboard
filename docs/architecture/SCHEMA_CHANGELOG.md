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

*Initialized 7 May 2026 by Aurelius. Append-only — every schema change adds an entry below.*
