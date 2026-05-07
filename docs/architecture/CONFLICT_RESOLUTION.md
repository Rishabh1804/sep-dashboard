# Conflict Resolution

**Phase:** 5
**Status:** LOCKED — 7 May 2026 (8 strengthened locks via 2 MCQ rounds + adversary probe)

---

## Problem

Multi-actor concurrent edits + offline-first PWAs + Cloud Function reconciliation = many ways to get this wrong silently. Adversary's specific prediction: handler offline-queue race silently drops owner's edit, owner notices 2 days late, trust collapses week 3.

## Adversarial Findings

2 BLOCKER + 11 HIGH:

- **BLOCKER** — CF at-least-once delivery without idempotency guard (resolved by `last_applied_event_id`)
- **BLOCKER omission** — Firestore `runTransaction()` is the idiomatic answer, not custom version-field OCC
- **HIGH** — Conflict modals on factory phones don't work; conflicts must surface in dashboard inbox
- **HIGH** — Server timestamps applied at replay time corrupt route_history chronology
- **HIGH** — Burst handling (200 queued events × CF subcoll re-query) blows free tier
- **HIGH** — Wrong split: `priority_bump`, all `health_score`/`mood_score` belong in event-sourcing
- **HIGH** — No CF replay/rebuild admin tool; buggy CF logic unrecoverable

All addressed in the locked decision below.

## Locked Decision

### Three-rule strategy

**Rule 1 — Event-sourcing for derivable state** (most writes; ~80% of operational data)

State that can be derived from an event stream is *never* directly mutated by clients. Writes go to event subcollections (append-only, no conflict). Cloud Function aggregates → writes parent doc as sole writer. See [EVENT_SOURCING.md](EVENT_SOURCING.md).

**Rule 2 — Firestore transactions for genuinely mutable online edits**

Online edits to OCC-tier docs (Customer.contact_info, Item.wpp_grams, Room.current_status, PerimeterLoopSegment.maintenance_state) use `runTransaction()`:

```typescript
async function updateCustomerContact(customerId, newContact) {
  await firestore.runTransaction(async tx => {
    const ref = firestore.doc(`customers/${customerId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Customer not found');
    tx.update(ref, {
      contact_info: newContact,
      last_updated_at: FieldValue.serverTimestamp(),
      last_updated_by: currentUser.uid,
    });
  });
}
```

Atomic read-modify-write server-side; Firestore handles retry on contention; no version field needed.

**Rule 3 — LWW for offline writes; conflicts surface in audit log + dashboard inbox**

Offline-queued writes to OCC-tier docs replay as LWW (later-arriving wins, no client-side conflict detection). Audit log captures both the lost edit and the winner. **Pending-conflicts inbox** (in dashboard, steward-exclusive) surfaces every LWW-overwritten edit for review.

### Append-only events (~80% of writes; zero conflict surface)

The schema split:

| Append-only events | Mutable state (OCC via transactions) |
|---|---|
| production_entries | customers.contact_info / client_tier / default_quality_tier |
| dft_measurements | items.wpp_grams |
| dispatch_events | rooms.current_status (manual override) |
| audit_events | perimeter_segments.maintenance_state |
| notes (revisions append-only) | jobs.quality_tier_override (rare manual override) |
| jobs/{jid}/route_history | |
| machines/{mid}/state_transitions | |
| workers/{wid}/shifts | |
| stock_items/{sid}/receipts, depletions | |

**Aggressive event-sourcing split (Phase 5 ratification):** moved to event-sourced (away from OCC):

- `Job.current_priority_bump` → `priority_bump_events` subcollection (each bump records delta + reason + actor)
- `Customer.health_score` → derived from rework rate + payment timeliness over rolling window
- `Worker.mood_score` → derived from shift outcomes (with manual override events)
- `Machine.health_score` → derived from downtime + production rate

### Timestamp ordering (Phase 5 lock)

**Server-primary + client tiebreaker.** Every event stores BOTH:

- `client_created_at: Timestamp` — set at offline write time (client clock)
- `server_committed_at: Timestamp` — set at Firestore commit (`serverTimestamp()`)

Queries order by `server_committed_at` primary; for ties (events from same handler in same commit batch), tiebreak by `client_created_at`. Closes the "Tuesday 3pm becomes Wednesday 9am" replay-corruption hole.

### Burst handling (Phase 5 lock)

Event coalescing within 5-second debounce window. Aggregator CF doesn't fire per-event; instead:

- Pub/Sub trigger collects events for a parent doc over 5s
- Single CF invocation processes all collected events together
- 200 queued events for one job collapse to one CF run that processes the batch
- Drops cost dramatically on bursts; adds 5s latency on calm-state writes (acceptable)

Implementation: each event write triggers a Pub/Sub message keyed to the parent doc ID. Pub/Sub debounces; CF is the subscriber.

### Pre-flush confirmation (Phase 5 lock)

When handler PWA opens with queued offline writes detected:

- Show summary screen: "X writes pending sync since [timestamp]"
- Options: **Review** (shows individual entries) | **Sync now** (flush all) | **Hold** (keep queued)
- Worker confirms before flush; catches reinstall scenarios where queue is unexpected
- Per-entity preview shows: timestamp, type, summary, expected sync time

### Cold-start mitigation (Phase 5 lock)

`min-instances=1` on:
- `eventSourcingAggregator` (always-warm; no shift-open delay)
- `topicDigestCron` (always-warm; no first-tick lag)

Cost: ~$5-10/mo flat (outside free tier). Worth the cost given "data backbone" positioning.

Companion: per-entity "last updated Xs ago" indicator on dashboard cards (must-add per Phase 5). Sets user expectation for staleness; eliminates the false-trust failure mode.

## Rationale

**Why event-sourcing for ~80% of writes:**
- No conflict surface (each event is a unique document)
- Audit-log-first ethos preserved (every state change is an event)
- Replay-able (CF replay/rebuild tool reconstructs parent state from log)
- Cheaper than OCC at scale (no version-field overhead, no retry storms)

**Why Firestore transactions over custom version-field OCC for online edits:**
- Idiomatic Firestore answer; well-documented + battle-tested
- Atomic read-modify-write server-side; no client retry logic
- No `__version` field bloat
- Adversary's recommendation; "the only reason to prefer manual OCC is offline conflict detection — but offline OCC is broken anyway."

**Why LWW for offline writes (instead of reject-on-replay):**
- Realistic factory floor UX: workers don't have time / context to resolve conflicts on phones
- Conflict modal on handler PWA is an anti-pattern (worker dismisses it; data integrity worse than LWW)
- Pending-conflicts inbox in dashboard makes LWW *visible* to steward, who has time + context
- Audit log makes "what did the worker actually intend" recoverable

**Why min-instances=1 for aggregator + cron:**
- Cold start = 1-10s, not 300ms — adversary's correction to original assumption
- Shift-open + first-event delay is the worst-case UX
- ~$5-10/mo flat is acceptable for "data backbone" critical path

## Acceptance Criteria (the bar)

- [ ] All append-only event collections deployed; never mutated post-create
- [ ] OCC-tier mutable state edits routed through `runTransaction()` consistently in dashboard code
- [ ] Offline-queued writes replay as LWW; audit_events recorded for both lost + winning edits
- [ ] Pending-conflicts inbox in dashboard, steward-exclusive disposition
- [ ] All events carry `client_created_at` + `server_committed_at` (both fields, both indexed)
- [ ] Event coalescing via Pub/Sub debounce verified: 200 queued events for one parent → single CF invocation
- [ ] Pre-flush confirmation tested: app opens with queued writes → summary screen, worker can review/sync/hold
- [ ] `min-instances=1` set on aggregator + topicDigestCron via Firebase Functions config
- [ ] Per-entity "last updated Xs ago" indicator visible on every dashboard card
- [ ] CF replay/rebuild admin tool tested: rebuild of a sample parent doc from event log produces same state as live aggregation

## Implementation Notes

- Firestore transactions: use `firestore.runTransaction()`, NOT `firestore.batch()`. Batches don't read; transactions do.
- Pub/Sub debounce: use Firebase Functions v2's `eventarc` integration, or write a custom dispatcher that buffers + flushes on timer
- For event coalescing keying: use `${parent_doc_path}` as the message key; Pub/Sub debounces per-key
- Server timestamp `FieldValue.serverTimestamp()` works inside transactions; the value resolves at commit time
- Pending-conflicts inbox UI: surface as a numbered badge on dashboard top bar; click → list view; per-conflict: details + actions (accept winner / re-apply lost / annotate / dismiss)
- Audit event for LWW conflict: include `conflict_with_event_id` field linking the lost event

## Future Considerations

- **Real-time conflict detection** (Phase 2.1+) — surface conflicts as they occur via dashboard listener; surfaces faster than waiting for steward inbox review
- **CRDTs** for genuinely concurrent collaborative editing (note bodies, room layout planning) — overkill for our domain currently
- **Conflict resolution suggestions** — ML model that learns from steward dispositions and suggests winner / merger for new conflicts
- **Event coalescing tuning** — 5s debounce is initial; profile actual burst patterns post-launch and adjust

## Related

- [EVENT_SOURCING.md](EVENT_SOURCING.md) — aggressive split detail
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — aggregator + replay/rebuild + audit generator implementation
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — pending-conflicts inbox surface
- [DASHBOARD_VIEWER.md](DASHBOARD_VIEWER.md) — per-entity staleness indicator placement
- [HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md) — pre-flush confirmation flow

---

*Authored 7 May 2026 by Aurelius.*
