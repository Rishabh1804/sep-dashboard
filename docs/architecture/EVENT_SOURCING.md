# Event Sourcing (Aggressive Split)

**Phase:** 5
**Status:** LOCKED — 7 May 2026 (Phase 5 Round 1 ratification)

---

## Problem

Mutable state that's directly written by clients creates conflict surface. State that's *derivable* from an underlying event stream has zero conflict surface — events are append-only with unique IDs; the parent doc has at most one writer (the aggregator CF). Question: how aggressively to split mutable fields into event-sourced derivation?

## Options Considered

**Option A — Conservative.** Move only `Job.current_priority_bump` to event-sourcing. Keep all health/mood scores in OCC.

**Option B — Moderate.** Move priority_bump + machine state. Keep customer/worker/machine health scores in OCC.

**Option C — Aggressive.** Move all derivable state: priority_bump, all health/mood scores, machine current_status, current_capacity, worker current_location, etc.

**Option D — Reverse.** Pull more into OCC for simpler mental model.

## Adversarial Findings

Phase 5 adversary specifically called the original split wrong:

- `Job.current_priority_bump` is "literally a stack of bump events with timestamps and reasons. Putting it in OCC discards the audit trail."
- `Customer.health_score` and `Worker.mood_score` and `Machine.health_score` are "derived metrics... admin manually edits them and the system has no way to refute or recompute."

Recommended: aggressive split. User ratified Option C.

## Locked Decision

### What's event-sourced (derived state)

Each derived field has an associated event subcollection; CF aggregator computes parent from events.

| Parent doc field | Event subcollection | Derivation |
|---|---|---|
| `Machine.current_status` | `machines/{mid}/state_transitions` | Latest event's `to_state` |
| `Machine.current_capacity_kg` | `machines/{mid}/state_transitions` (capacity-state machines) | Latest known capacity from events |
| `Machine.health_score` | Derived from `state_transitions` (downtime ratio) + `production_entries` (rate) | Rolling 30-day window |
| `Worker.current_status` | `workers/{wid}/shifts` | Latest shift event's status |
| `Worker.current_location_room_id` | `workers/{wid}/shifts` + `production_entries` | Latest production_entry's machine.room_id |
| `Worker.mood_score` | `workers/{wid}/shifts` + `mood_events` (manual override events) | Rolling weighted average |
| `Job.current_status` | `jobs/{jid}/route_history` | Latest route event's `to_state` |
| `Job.current_location` | `jobs/{jid}/route_history` | Latest route event's machine_id |
| `Job.current_priority_bump` | `jobs/{jid}/priority_bump_events` | Sum of all bump deltas |
| `Stock.current_level` | `stock_items/{sid}/receipts` + `stock_items/{sid}/depletions` | Sum(receipts.qty) - Sum(depletions.qty) |
| `Customer.health_score` | Derived from `dft_measurements` (rework rate) + `dispatch_events` (timeliness) + `notes` (dispute frequency) | Rolling 90-day window |

### What stays OCC (genuinely user-edited, no natural event stream)

| Field | Why OCC |
|---|---|
| `Customer.contact_info`, `client_tier`, `default_quality_tier` | Admin / steward edits; infrequent; no event semantics |
| `Item.wpp_grams` (and `wpp_calibrated_at`) | Calibration update event would be one-shot, no stream |
| `Room.current_status` (manual maintenance flag) | When admin marks room down for cleaning |
| `PerimeterLoopSegment.maintenance_state` | Maintenance schedule edits |
| `Job.quality_tier_override` | Rare per-job override (customer call) |

### CF aggregator pattern

```typescript
// One aggregator CF per (event subcollection → parent field) mapping
exports.routeHistoryAggregator = functions.firestore
  .document('jobs/{jid}/route_history/{eid}')
  .onCreate(async (snap, ctx) => {
    const eventId = ctx.params.eid;
    const eventData = snap.data();
    const parentRef = admin.firestore().doc(`jobs/${ctx.params.jid}`);

    await admin.firestore().runTransaction(async tx => {
      const parent = await tx.get(parentRef);
      const data = parent.data();

      // Idempotency check (Phase 5 must-add)
      if (data.last_applied_event_id_routeHistory >= eventId) return;

      // Derive new state from this event
      const newCurrentStatus = eventData.to_state;
      const newCurrentLocation = eventData.machine_id;

      // Update parent atomically
      tx.update(parentRef, {
        current_status: newCurrentStatus,
        current_location: { type: 'machine', ref: newCurrentLocation },
        last_applied_event_id_routeHistory: eventId,
        last_updated_at: FieldValue.serverTimestamp(),
      });
    });
  });
```

Note `last_applied_event_id_routeHistory` (per-subcollection) — a parent doc may have multiple aggregator CFs each tracking their own event stream's progress.

### Replay/rebuild admin tool (Phase 5 must-add)

Callable CF that rebuilds parent state from scratch by replaying the entire event subcollection. Use cases:

1. Aggregator CF had a bug; ran for hours producing wrong state; need to recompute
2. Schema migration changed event shape; parent state needs refresh based on migrated events
3. Manual data correction added an old event that should retroactively change current state

```typescript
exports.replayRebuild = functions.https.onCall(async (data, ctx) => {
  if (!ctx.auth?.token.is_admin) throw new HttpsError('permission-denied', 'Admin only');
  const { parent_path, subcollection_name } = data;

  const parentRef = admin.firestore().doc(parent_path);
  const events = await admin.firestore()
    .collection(`${parent_path}/${subcollection_name}`)
    .orderBy('server_committed_at')
    .get();

  // Rebuild state from scratch
  let derivedState = {};
  for (const event of events.docs) {
    derivedState = applyEvent(derivedState, event.data());
  }

  // Atomic write to parent
  await parentRef.update({
    ...derivedState,
    [`last_applied_event_id_${subcollection_name}`]: events.docs.at(-1)?.id || null,
    rebuilt_at: FieldValue.serverTimestamp(),
    rebuilt_by: ctx.auth.uid,
  });

  return { events_replayed: events.size, parent: parent_path };
});
```

## Rationale

- **Aggressive split eliminates conflict on derived fields entirely.** Event subcollection is append-only; parent has one writer (CF). No transactions needed.
- **Audit trail preserved by design.** Every priority_bump is an event; question "why is Job J-1042 priority 3?" answered by querying the bump_events.
- **Health/mood scores become defensible.** "Customer ABC has health_score 67" is now explainable from rework rate + payment timeliness over the rolling window. Admin can override via a manual override event (which is itself part of the stream).
- **Replay/rebuild gives a recovery path.** Bugs in CF logic don't permanently corrupt parent state; one admin call rebuilds from event log.
- **Idempotency via per-subcollection `last_applied_event_id` field** allows multiple aggregators per parent without race conditions.

## Acceptance Criteria (the bar)

- [ ] Every event subcollection has an associated aggregator CF deployed
- [ ] Every aggregator implements idempotency check (`last_applied_event_id_*`)
- [ ] Every aggregator wraps its read+write in a Firestore transaction
- [ ] Replay/rebuild admin function callable; tested on every event-sourced field
- [ ] Migration-aware replay (Phase 6 must-add): replay tool runs schema migrations on historical events before applying
- [ ] Per-aggregator unit tests for each derivation function (e.g., `applyRouteEvent(state, event)` is pure + tested)
- [ ] CF observability: aggregator latency P50 < 500ms; P95 < 2s with min-instances=1

## Implementation Notes

- Aggregator CFs use Firebase Functions v2 with min-instances=1 (always-warm); cold start otherwise dominates first-event latency
- Each derivation function (e.g., `applyRouteEvent`) is a pure function: `(prior_state, event) => new_state`. Live in `functions/src/aggregators/derivations/`. Unit-tested with Jest
- Event subcollection writes are direct Firestore (no CF mediation needed for the event itself); aggregator triggers post-write
- For complex derivations (e.g., `Customer.health_score` over a rolling 90-day window), consider scheduled re-aggregation (daily cron) rather than per-event re-computation if compute cost is high
- Stale parent docs (e.g., parent has `last_applied_event_id_X` older than latest event in subcollection X) are surfaced in admin "out-of-sync" view; replay/rebuild fixes them
- Manual override pattern: when admin needs to set `Customer.health_score` directly, they don't write to the parent doc — they create an event in `customers/{cid}/manual_score_overrides/{eid}` that the aggregator factors into derivation

## Future Considerations

- **Snapshot caching for expensive derivations** — `Customer.health_score` over 90-day rolling window is expensive to recompute on every new event; cache snapshots periodically and incrementally update
- **Event compaction** — once a parent's state is fully captured, old events past N years can be archived (move to GCS); aggregator's understanding of "current state" stays correct
- **Real-time mood_score / health_score updates** — currently aggregated on-write; could move to scheduled re-aggregation if real-time is unnecessary
- **Cross-entity event-sourcing** — `Customer.health_score` already reaches into multiple subcollections (jobs' DFT measurements + dispatch_events). Future may formalize as multi-source aggregator pattern.

## Related

- [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md) — broader strategy this fits within
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — aggregator + replay/rebuild CF implementation
- [DATA_HIERARCHY.md](DATA_HIERARCHY.md) — event subcollection placements
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — migration-aware replay
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — admin replay/rebuild UI

---

*Authored 7 May 2026 by Aurelius.*
