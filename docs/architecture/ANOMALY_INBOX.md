# Anomaly Inbox — The 11 Categories

**Phase:** 8
**Status:** LOCKED — 7 May 2026 (Phase 8 R1 Q2: cut to 6 high-signal + 5 critical adds; ~11 total)

---

## Problem

Anomaly inbox surfaces auto-detected data integrity issues for steward disposition. Wrong category mix = alert fatigue (steward dismisses everything by week 2 = inbox dies). Adversary specifically called out: 2σ outliers fire ~5% by definition (~10 noise alerts/day); some categories redundant with rules-layer rejection; missing critical categories.

## Adversarial Findings (Phase 8)

> "9 categories conflate noise with signal. Cut to 6 high-signal categories. Better to have an empty inbox most days than a full one always."

Concrete cuts and adds documented + ratified.

## Locked Decision

### The 11 categories

#### KEPT (6 high-signal categories)

##### 1. Job staleness >12h

**Trigger:** Job in `in-flight` status with no production_entry, route_history event, or DFT measurement for >12h.
**Severity:** medium → high based on age.
**Disposition options:** investigate / reassign / mark stalled / escalate.
**Why high-signal:** legitimate operational pulse — stalled jobs are real money sitting still.

##### 2. Machine-down production entry

**Trigger:** production_entry created where `machine_id.current_status === 'down'`.
**Severity:** high (data is wrong; machine isn't actually running).
**Disposition options:** correct entry (typo on machine_id) / mark machine recovered / discard entry.
**Why high-signal:** indicates either operational chaos (running on machine flagged as down) or mis-attribution.

##### 3. Dangling cross-doc references

**Trigger:** any write references an entity that doesn't exist or has been soft-deleted (e.g., production_entry references nonexistent or deleted machine_id).
**Severity:** high (foreign-key integrity broken).
**Disposition options:** correct reference / restore deleted entity / discard entry.
**Why high-signal:** Phase 4 rules can't enforce FK integrity (would require get() per write); CF post-write detection fills the gap.

##### 4. DFT measurement >2× target band

**Trigger:** `micron_value > target_band_high * 2` for the job's quality_tier.
**Severity:** high (likely measurement error or genuine quality crisis).
**Disposition options:** correct measurement / verify equipment / route to rework / escalate to customer.
**Why high-signal:** real outliers signal real problems; sanity hard-block (>50µm) catches the most extreme; this catches the 2x band cases.

##### 5. Missing check-out 14h

**Trigger:** worker `clock_in` event with no `clock_out` 14h later.
**Severity:** low → medium (depending on context).
**Disposition options:** reach out to worker / auto-clock-out / mark forgotten.
**Why high-signal:** affects payroll + productivity; mostly forgotten not malicious. **Tuned to NOT fire daily** — only escalates after 14h, not at end-of-shift.
**Note:** adversary flagged this as noisy. Compromise: keep but with grace period; review precision after 30 days; cut if false-positive rate >50%.

##### 6. Conflict accumulation

**Trigger:** pending-conflicts inbox count exceeds dynamic threshold (e.g., >20 in last 7 days, or 3σ above 30-day baseline).
**Severity:** medium (meta-signal; system is producing many conflicts).
**Disposition options:** investigate root cause / acknowledge / batch-resolve.
**Why high-signal:** tells the steward "something systemic is off."

#### CUT (3 categories from original proposal)

| Cut | Reason | Replacement |
|---|---|---|
| **Numeric 2σ outliers** | Fires ~5% by definition; 10 alerts/day of pure statistical noise | Replace with 3σ + min-30-sample gate + per-field tuning. DFT outliers matter (covered by category #4); weight outliers on noisy scales don't |
| **Stock balance <0** | Should be hard rules-layer rejection | Move to security rules: reject any write that would push current_level negative |
| **Stale build** | Already rejected at rules layer (Phase 6 must-add: stale-build rejection) | No replacement needed |

#### ADDED (5 critical categories)

##### 7. Same job, two simultaneous in-progress entries on different machines

**Trigger:** ProductionEntry creates `current_status: in-flight` on two different machine_ids within 5 minutes for same job_id.
**Severity:** high (entry confusion; data is internally inconsistent).
**Disposition options:** identify which is correct / merge / mark one as transit / discard.
**Why critical:** real operational confusion that escapes per-write rules.

##### 8. Customer name fuzzy collision

**Trigger:** new customer added with name within Levenshtein distance ≤2 of existing customer.
**Severity:** medium (likely duplicate-master problem).
**Disposition options:** merge into existing / confirm separate / annotate.
**Why critical:** ABC Industries vs ABC Industries Pvt Ltd — left unresolved, splits historical data.

##### 9. DFT measurement on a job that never went through plating

**Trigger:** dft_measurement created for job whose route_history has no plating event.
**Severity:** high (route violation; inspection result invalid).
**Disposition options:** correct route / discard measurement / reroute through plating.
**Why critical:** quality data integrity directly affected.

##### 10. Dispatched quantity > received quantity

**Trigger:** sum of dispatched_quantity for a job > received_quantity (with tolerance for legitimate weight gain from plating).
**Severity:** high (business-breaking; we're billing customer for more than they sent).
**Disposition options:** investigate split shipments / verify weights / customer dispute.
**Why critical:** the business-critical inconsistency adversary called out specifically.

##### 11. Worker logged production while marked off-shift

**Trigger:** production_entry by worker_id when same worker_id's most recent shift event was `clock_out`.
**Severity:** medium (likely back-fill; possibly mis-attribution).
**Disposition options:** correct timestamp / correct worker / annotate.
**Why critical:** payroll integrity + productivity calculation accuracy.

### Anomaly record schema

Each anomaly is a structured note (per [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md)) with `kind: 'anomaly'`:

```typescript
interface AnomalyNote extends NoteRecord {
  kind: 'anomaly';
  data: {
    detector: string;          // 'job-staleness' | 'machine-down-production-entry' | etc.
    detected_at: Timestamp;
    evidence: {                 // entity references that triggered the detection
      entity_type: string;
      entity_id: string;
      payload?: any;            // detector-specific context
    }[];
    suggested_action: string[]; // disposition options
    confidence: number;         // 0-1; for tuning
  };
  topic_refs: TopicRef[];       // attached to relevant entities
  priority: 'normal' | 'urgent';
  status: 'active' | 'resolved' | 'archived';
  // disposition fields populated on close
  dispositioned_by?: UserRef;
  dispositioned_at?: Timestamp;
  disposition: 'real-issue' | 'false-positive' | 'duplicate' | 'wont-fix';
  resolution_note?: string;
}
```

The `disposition` field is what feeds the **anomaly precision** metric on the steward KPI card. False-positive rate per detector tunes the detector over time.

### Detector implementation (CF post-write)

Each category has its own detector function in `functions/src/anomaly/detectors/`. Detectors run as Firestore post-write triggers + scheduled scans:

- **Real-time detectors** (run on every write): machine-down production-entry, dangling refs, DFT >2x band, dispatched > received, off-shift production
- **Scheduled detectors** (run hourly): job staleness, missing check-out, customer fuzzy collision, conflict accumulation, simultaneous-in-progress

```typescript
// functions/src/anomaly/detectors/machineDownProductionEntry.ts
export const detectMachineDownProductionEntry = functions.firestore
  .document('production_entries/{pid}')
  .onCreate(async (snap, ctx) => {
    const entry = snap.data();
    const machine = await admin.firestore()
      .doc(`machines/${entry.machine_id}`).get();

    if (machine.data().current_status === 'down') {
      await createAnomaly({
        detector: 'machine-down-production-entry',
        evidence: [
          { entity_type: 'production_entry', entity_id: snap.id, payload: entry },
          { entity_type: 'machine', entity_id: entry.machine_id,
            payload: machine.data() },
        ],
        suggested_action: ['correct-entry', 'mark-machine-recovered', 'discard-entry'],
        confidence: 0.95,
        priority: 'urgent',
        topic_refs: [
          { entity_type: 'machine', entity_id: entry.machine_id },
          { entity_type: 'job', entity_id: entry.job_id },
        ],
      });
    }
  });
```

## Rationale

- **Cut the noisy categories** = inbox actually gets read; "empty most days" is the right default
- **Stock<0 → rules** = catch at write time, not after data lands
- **Stale build → already rules** = don't duplicate; rules rejection IS the surface
- **Add real business-breaking detectors** = dispatched>received, route violations, simultaneous-in-progress are the actual integrity problems
- **Customer fuzzy collision** = upstream prevention of master-data split
- **Anomaly precision metric** = self-correcting; bad detectors tune themselves out via false-positive rate

## Acceptance Criteria (the bar)

- [ ] All 11 detectors implemented and deployed as CF triggers
- [ ] Real-time detectors run on every write to relevant collections
- [ ] Scheduled detectors run hourly
- [ ] Anomalies created as `notes` with `kind: 'anomaly'` per structured-mem schema
- [ ] Steward inbox UI surfaces anomalies sorted by priority + age
- [ ] Disposition workflow: 4 options per anomaly (real-issue / false-positive / duplicate / wont-fix)
- [ ] Bulk disposition tested: multi-select + single reason for repeat-flavor (e.g., 60 missing-checkout from yesterday)
- [ ] Anomaly precision metric calculated correctly (% real / total dispositioned)
- [ ] Detector tuning runbook: review precision per detector after 30 days post-launch; cut detectors below 50% precision

## Implementation Notes

- Detectors share helper `createAnomaly(data)` that writes to `notes/` with structured-mem schema
- Anomaly notes auto-attach to relevant `topic_refs` (so they appear in topic digests)
- Suggested action enum: standardized across detectors so dashboard can render consistent action buttons
- For low-confidence detectors (<0.8): mark as `priority: 'normal'`; high-confidence: `priority: 'urgent'`
- Detector unit tests with synthetic data: ensure each detector fires correctly + doesn't false-positive on edge cases
- Periodic detector review: monthly steward + admin meeting to review precision; tune thresholds; add/cut categories

## Future Considerations

- **ML-based anomaly detection** (Phase 2.2+) — replace hand-crafted detectors with anomaly detection model trained on dispositioned history
- **Customer-facing anomaly notifications** (Phase 2.2+) — when DFT >2x band or dispatched > received affects a customer, optionally notify them
- **Per-detector configurability** (Phase 2.1+) — admin can tune thresholds without code change
- **Push notifications for urgent anomalies** (Phase 2.1+) — once PWA push works
- **Anomaly resolution patterns** — if certain anomaly types always resolve the same way, suggest auto-resolve (with audit trail)

## Related

- [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md) — anomalies are notes with `kind: 'anomaly'`
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — disposition UI + KPI card
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — detector implementation
- [FIRESTORE_RULES.md](FIRESTORE_RULES.md) — rules-layer rejection (cut categories moved here)
- [DASHBOARD_VIEWER.md](DASHBOARD_VIEWER.md) — anomaly inbox surface

---

*Authored 7 May 2026 by Aurelius.*
