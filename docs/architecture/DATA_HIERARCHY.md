# Data Hierarchy & Compartments

**Phase:** 2
**Status:** LOCKED — 7 May 2026 (with Phase 4 refinement folded in: notes top-level only)
**Companion files:** [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md), [TOPIC_DIGESTS.md](TOPIC_DIGESTS.md)

---

## Problem

Firestore is a document database with collections + subcollections. The shape of the data — what's nested under what, what's a top-level entity, what's a subcollection event — determines query patterns, security rule structure, cost, and operational mental model. *Compartments* (who can read/write what) layer on top of whatever shape we choose.

## Options Considered

**Option A — Fully flat.** All entities at top-level. Filter via foreign-key fields. Cheapest cross-cutting queries; weakest relational structure.

**Option B — Fully nested.** Subcollections all the way down (`customers/{cid}/jobs/{jid}/production_entries/{pid}`). Path-based scoping; cross-cutting queries require collection group queries (special indexes, more complexity); entities with multiple natural parents only get one path.

**Option C — Hybrid.** Top-level for queryable entities + subcollections for naturally-nested events. Stable global IDs; explicit foreign-key relations; per-entity events live where they belong.

## Adversarial Findings

Not probed directly in Phase 2 (decision pre-dated MCQ + adversary pattern). Phase 4 surfaced one refinement: notes proposed as both top-level AND per-entity subcollection mirrors → adversary flagged the duplication; consolidated to top-level only with `topic_refs` array.

## Locked Decision

**Hybrid hierarchy (Option C).**

### Top-level collections

```
/customers/{cid}                          [queryable: name, tier, health_score]
/items/{iid}                              [queryable: customer_id, type]
/jobs/{jid}                               [queryable: status, customer_id, SLA, location]
/workers/{wid}                            [queryable: role, status, area]
/rooms/{rid}                              [queryable: type, area, status]
/machines/{mid}                           [queryable: type, room_id, status]
/stock_items/{sid}                        [queryable: category, current_level]
/perimeter_segments/{psid}                [queryable: maintenance_state]

/production_entries/{pid}                 [queryable: job_id, worker_id, machine_id, date]
/dft_measurements/{mid}                   [queryable: job_id, inspector_id, outcome]
/dispatch_events/{eid}                    [queryable: job_id, customer_id, date]
/audit_events/{aid}                       [queryable: entity_type+id, actor, action, time]
/notes/{nid}                              [queryable: topic_refs (array-contains), kind, status]
```

### Subcollections (naturally child-of-parent, no cross-cutting reads)

```
/jobs/{jid}/route_history/{rid}              station-by-station log
/machines/{mid}/state_transitions/{tid}      status changes for this machine
/machines/{mid}/maintenance_log/{mid}        maintenance events
/workers/{wid}/shifts/{sid}                  clock-in / clock-out
/stock_items/{sid}/receipts/{rid}            per-receipt inventory IN
/stock_items/{sid}/depletions/{did}          per-event inventory OUT
```

**Notes refinement (Phase 4):** notes are top-level only with `topic_refs[]` array; per-entity aggregation served by either:
- Compiled topic digest (`topics/machines/t-1-1.md` — see [TOPIC_DIGESTS.md](TOPIC_DIGESTS.md))
- Live Firestore query: `where('topic_refs', 'array-contains', { entity_type: 'machine', entity_id: 't-1-1' })`

### Compartments (security boundaries)

Per Phase 4 ratification:

| Axis | Mechanism | Always on? |
|---|---|---|
| **User identity** | `request.auth.uid` matches `author_user_id` on writes | YES |
| **Role-app** | Custom claims `roles[]` checked in security rules | YES |
| **24h handler edit window** | Update rule checks `request.time < created_at + 24h` | YES |
| **Per-area read scope** | Soft (UI only), not rule-enforced | NO (deferred) |
| **Per-customer read scope** | Not implemented (single-org) | NO |

## Rationale

**Why hybrid over fully flat or fully nested:**

- **Top-level for queryables** — anything we filter by multiple dimensions (production_entries by job/worker/machine/date) lives at top-level. Single composite indexes per query pattern; no expensive collection group queries.
- **Subcollections for natural children** — events that exist only in a parent's context (route_history per job, shifts per worker, receipts per stock item). The parent ↔ child relationship is explicit; security rules inherit cleanly; cleanup on parent delete is natural.
- **Stable global IDs** — `jobs/J-2026-1042`, not `customers/abc/jobs/J-2026-1042`. URLs, references, and cross-app links work without parent context.
- **Notes as cross-cutting first-class** — notes attach to multiple entity types; can't have a single parent; `topic_refs` array enables array-contains queries; topic digest layer compiles per-entity views.
- **`audit_events` top-level only** — the steward needs both "all events for entity X" and "all events today" efficiently; one indexed collection serves both.

**Why these compartments and not others:**

- **User identity always on** — foundation of audit attribution; non-negotiable.
- **Role-app always on** — a Pickler app installation cannot write DFT measurements; rules enforce at write time, app UI mirrors for fast feedback.
- **24h handler edit window** — bounds blast radius of mistakes without slowing legitimate same-shift corrections; older edits flow through dashboard exception path with revisions[] entries.
- **Per-customer scoping skipped** — single-org context; cost (every read does a customer-membership check) doesn't pay back.

## Acceptance Criteria (the bar)

- [ ] All top-level collections deployed with documented composite indexes
- [ ] All subcollection paths follow declared structure; no orphans
- [ ] `topic_refs` field on `/notes/{nid}` is indexed for array-contains queries
- [ ] Security rules enforce user-identity + role-app + 24h edit window per [FIRESTORE_RULES.md](FIRESTORE_RULES.md)
- [ ] No subcollection has a top-level mirror (notes-as-subcollection refactor complete)
- [ ] Schema documented in [../reference/SCHEMA.md](../reference/SCHEMA.md) with field-level types

## Implementation Notes

- Firestore composite indexes go in `firestore.indexes.json` and deploy via `firebase deploy --only firestore:indexes`
- Use `Timestamp` (not `Date`) for all temporal fields; serverTimestamp() on create per Phase 4 timestamp pinning
- `topic_refs` array maximum recommended ~100 entries (Firestore array-contains performance falls off beyond); document the cap
- Subcollection cascade-delete is NOT automatic in Firestore — Cloud Function on parent delete walks children explicitly
- Per Phase 4 lock, every doc carries `__schema_version` (Phase 6 migration discipline)

## Future Considerations

- **Per-customer scoping** — if multi-org becomes a thing, layer rules + UI accordingly
- **Per-area read scoping** — if specific role-apps should only see their area's data, add custom claim `home_area` and rule check
- **Time-window edit gates** — currently 24h for handlers; could add per-role variations (steward 7d, admin unlimited)
- **Collection group queries** — if cross-cutting queries on subcollection events become needed (e.g., "all state_transitions across all machines today"), add collection group index; not currently warranted

## Related

- [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md) — note schema detail
- [TOPIC_DIGESTS.md](TOPIC_DIGESTS.md) — bifurcated read/write surface
- [FIRESTORE_RULES.md](FIRESTORE_RULES.md) — rules implementation of compartments
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — how this hierarchy evolves over time
- [../reference/SCHEMA.md](../reference/SCHEMA.md) — canonical entity reference

---

*Authored 7 May 2026 by Aurelius.*
