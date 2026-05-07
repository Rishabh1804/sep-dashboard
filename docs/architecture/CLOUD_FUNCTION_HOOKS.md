# Cloud Function Hooks

**Phase:** 4 + 5 + 6 (cross-cutting)
**Status:** LOCKED — 7 May 2026

---

## Problem

Firestore rules enforce identity, attribution, and high-stakes invariants. They cannot enforce:

- Cross-document consistency ("worker is on shift on this machine right now")
- State derivation from event streams (`Job.current_status` from route_history)
- Audit log generation (server-side trusted writes)
- Schema migration / normalization
- Topic digest compilation
- Anomaly detection
- Backup / export

These all live in Cloud Functions. This document is the inventory of CF hooks, what triggers them, and how they coordinate.

## Locked Decision

### CF inventory (alpha + structural for 2.1+)

| CF | Trigger | Purpose | Min-instances |
|---|---|---|---|
| `provisionWorker` | HTTPS callable | Mint custom token + QR for new handler (Phase 3+8) | 0 |
| `revokeWorker` | HTTPS callable | Soft + immediate revocation paths (Phase 3) | 0 |
| `reIssueToken` | HTTPS callable | Rotate active_token_id (Phase 8) | 0 |
| `auditEventGenerator` | Firestore onWrite (every collection) | Append audit_events on every state change | 0 |
| `eventSourcingAggregator` | Firestore onCreate (event subcollections) | Derive parent doc state (Phase 5 aggressive split) | 1 (always-warm per Phase 5) |
| `topicDigestCron` | Cloud Scheduler hourly | Compile topics/*.md and commit to GitHub | 1 (always-warm) |
| `schemaNormalizer` | Firestore onWrite | Normalize stale-version docs in place (Phase 6 Layer 3) | 0 |
| `bulkMigration` | HTTPS callable | Three-stage admin tool (dry-run/sample-N/full-run, Phase 6) | 0 |
| `replayRebuild` | HTTPS callable | Rebuild parent doc from event log (Phase 5 must-add) | 0 |
| `dailyExport` | Cloud Scheduler daily | Export Firestore to GCS bucket (Phase 6 must-add) | 0 |
| `anomalyDetector` | Firestore onWrite | Generate kind:'anomaly' notes on detected patterns (Phase 8) | 0 |
| `crossDocValidator` | Pre-write hook (callable wrapper around Firestore writes) | Cross-doc invariants (Phase 4) | 0 |
| `revertMigrationBatch` | HTTPS callable | Revert by `migration_batch_id` (Phase 8 must-add) | 0 |
| `expireNotes` | Cloud Scheduler daily | Auto-archive notes past `expires_at` (Phase 2) | 0 |

### Idempotency contract (Phase 5 lock)

**Every Firestore-triggered CF must be idempotent.** Concretely:

- Every parent doc carries `last_applied_event_id: string` (the most-recently-applied event ID)
- Aggregator CF reads `last_applied_event_id` on entry; skips events with ID ≤ that value
- Successful application updates `last_applied_event_id` atomically with the parent doc write (one transaction)
- Replay-after-failure produces same result as original; duplicate triggers are no-ops

```typescript
// Pseudo-code for eventSourcingAggregator
exports.aggregator = functions.firestore
  .document('jobs/{jid}/route_history/{eid}')
  .onCreate(async (snap, ctx) => {
    const eventId = ctx.params.eid;
    const eventData = snap.data();

    await admin.firestore().runTransaction(async tx => {
      const parentRef = admin.firestore().doc(`jobs/${ctx.params.jid}`);
      const parent = await tx.get(parentRef);

      // Idempotency check
      if (parent.data().last_applied_event_id >= eventId) {
        return;  // Skip; already applied
      }

      // Compute new state from this event + prior state
      const newState = applyRouteEvent(parent.data(), eventData);

      tx.update(parentRef, {
        ...newState,
        last_applied_event_id: eventId,
        last_updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  });
```

### Audit event generation

Every collection's onWrite trigger generates an `audit_event`. Helper:

```typescript
function emitAudit(before, after, ctx, action) {
  const entityType = ctx.resource.replace(/.*\/(\w+)\/[^/]+/, '$1');
  return admin.firestore().collection('audit_events').add({
    entity_type: entityType,
    entity_id: after.id || before.id,
    action,
    field_changed: diffKeys(before, after),
    old_value: before,
    new_value: after,
    triggered_by_user: after.author_user_id || before.author_user_id || 'system',
    triggered_by_app: after.recorded_by_app || 'cf',
    recorded_at: admin.firestore.FieldValue.serverTimestamp(),
    app_version: after.app_version || null,
  });
}
```

### Cross-doc validators (pre-write hook callable wrappers)

Per Phase 4 ratification, validation that requires cross-doc reads goes in a callable CF that the client calls *instead of* writing directly:

```typescript
// Client code:
const result = await firebase.functions().httpsCallable('createProductionEntry')({
  job_id: 'J-1042', machine_id: 't-1-1', qty_pcs: 250, station: 'plating'
});

// CF code:
exports.createProductionEntry = functions.https.onCall(async (data, ctx) => {
  // Validate cross-doc invariants
  await assertWorkerOnShift(ctx.auth.uid, data.machine_id);
  await assertJobActive(data.job_id);
  await assertMachineNotDown(data.machine_id);
  await assertStockSufficient(data.machine_id, data.qty_pcs);

  // Validate data shape (Zod)
  productionEntrySchema.parse(data);

  // Commit
  return admin.firestore().collection('production_entries').add({
    ...data,
    author_user_id: ctx.auth.uid,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    app_version: ctx.app?.appVersion || 'unknown',
  });
});
```

**Trade-off:** loses Firestore offline-first for these specific writes. The handler PWA must distinguish:

- **Plain Firestore writes** (offline-first; client writes directly to Firestore via SDK; rules enforce; queue when offline)
- **CF-mediated writes** (online-only; cross-doc validation before commit; queue locally if CF unreachable, retry with backoff)

In alpha, route only the **most cross-doc-sensitive writes** through CF: dispatch_events (no double-dispatch check), production_entries (worker-on-shift + machine-not-down + stock-sufficient), and DFT measurements (route violation check). Routine writes (notes, simple state changes) stay direct-Firestore.

### Topic digest cron

Per [TOPIC_DIGESTS.md](TOPIC_DIGESTS.md):

```typescript
exports.topicDigestCron = functions.pubsub.schedule('every 1 hours')
  .onRun(async (ctx) => {
    const affectedTopics = await findTopicsUpdatedSince(oneHourAgo);
    const filesToCommit = [];
    for (const topic of affectedTopics) {
      const md = await renderTopicMarkdown(topic);
      filesToCommit.push({ path: `docs/topics/${topic.path}.md`, content: md });
    }
    const indexMd = await renderTopicIndex();
    filesToCommit.push({ path: 'docs/topics/INDEX.md', content: indexMd });

    await commitToGitHub(filesToCommit, {
      branch: 'main',
      message: `chore(topics): hourly digest refresh ${new Date().toISOString()}`,
    });
  });
```

GitHub PAT stored in Firebase Functions secrets via `firebase functions:secrets:set GITHUB_PAT`.

## Acceptance Criteria (the bar)

- [ ] Every CF idempotent (verified via duplicate-trigger test)
- [ ] Every parent doc carries `last_applied_event_id` (Phase 5)
- [ ] Audit event generated for every state change across every collection
- [ ] CF replay/rebuild admin function tested on a sample parent doc; reconstructs state correctly from event log
- [ ] Topic digest cron runs hourly, commits to GitHub, no diff = commit-skip
- [ ] Daily Firestore export to GCS verified; first export retrievable
- [ ] Anomaly detector generates kind:'anomaly' notes on the 11 categories per [ANOMALY_INBOX.md](ANOMALY_INBOX.md)
- [ ] Cross-doc validators (createProductionEntry, createDispatchEvent, createDftMeasurement) callable + tested
- [ ] Min-instances=1 set on `eventSourcingAggregator` and `topicDigestCron`; cold-start time <300ms after first invocation

## Implementation Notes

- Use Firebase Functions v2 (Node 18+); v1 is deprecated for new projects
- For idempotency, prefer Firestore transactions over read-then-write — atomic guarantee
- Cloud Function failure: configure DLQ via Pub/Sub (Firestore-triggered functions retry 7 days then drop silently without explicit setup)
- App Check token verification on callable functions: `if (!ctx.app) throw new functions.https.HttpsError('failed-precondition', 'App Check failed')`
- For long-running jobs (bulk migration, replay), use Cloud Tasks or Pub/Sub to queue work asynchronously; HTTPS callable can return job_id for status polling
- Logs: structured logging via `functions.logger.info({ job_id, action: 'normalized' })` — searchable in Cloud Logging

## Future Considerations

- **CF observability dashboard** — Cloud Monitoring dashboard surfacing per-CF: invocation count, error rate, latency P50/P95/P99, cold-start frequency
- **CF circuit breaker** — auto-disable a CF if error rate > threshold; alert admin
- **Move to Cloud Run for high-cost CFs** — `eventSourcingAggregator` + `topicDigestCron` may benefit from always-on Cloud Run if min-instances=1 cost grows
- **Event coalescing for high-frequency aggregators** — Phase 5 lock; revisit implementation when traffic warrants

## Related

- [FIRESTORE_RULES.md](FIRESTORE_RULES.md) — what the rules don't enforce, CFs do
- [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md) — event coalescing + min-instances=1 lock
- [EVENT_SOURCING.md](EVENT_SOURCING.md) — aggregator CF detail
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — schemaNormalizer + bulkMigration + replayRebuild detail
- [TOPIC_DIGESTS.md](TOPIC_DIGESTS.md) — topicDigestCron detail
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — anomalyDetector + steward-facing CF actions
- [AUTH_MODEL.md](AUTH_MODEL.md) — provisioning + revocation CFs

---

*Authored 7 May 2026 by Aurelius.*
