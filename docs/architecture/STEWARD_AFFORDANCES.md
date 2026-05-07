# Steward Affordances

**Phase:** 8
**Status:** LOCKED — 7 May 2026 (7 strengthened locks via 2 MCQ rounds + adversary probe)

---

## Problem

Per Session 11, the notebook handler transforms in Phase 2 from "sole record-keeper" to **data quality steward + anomaly checker**. Their KPI shifts from entries-recorded to data-integrity-maintained. This phase defines what tools the steward gets in alpha.

## Adversarial Findings

2 BLOCKER + 5 HIGH + 1 MEDIUM. Most critical:

- **BLOCKER** — WhatsApp link previews leak provisioning token (resolved via QR-in-person)
- **BLOCKER** — Anomaly inbox 2σ + duplicate categories = alert fatigue (resolved via cut-and-add to ~11 high-signal categories)
- **HIGH** — Edit-with-reason theater (free-text "fixed"); resolved via structured enum + steward distribution tracking
- **HIGH** — Steward KPI undefined (resolved via four-metric weekly card)
- **HIGH** — Re-issue token doesn't kill old phone offline queue (resolved via active_token_id rotation)
- **HIGH** — Missing tools: bulk disposition + quick-correct inline edit (both required day-1)

All addressed.

## Locked Decision

### Alpha-required steward surfaces

1. **Pending conflicts inbox** (Phase 5 surface) — steward-exclusive disposition
2. **Anomaly inbox** with 11 categories — steward-exclusive disposition (see [ANOMALY_INBOX.md](ANOMALY_INBOX.md))
3. **Edit-with-reason workflow** — structured enum reason + optional evidence + steward distribution tracking
4. **Audit log search** — entity-first default (must-add); advanced free-text behind tab
5. **Build version monitoring** + force-update prompt + `min_supported_build` editor (must-add: confirm-twice modal)
6. **Worker provisioning UI** — add/re-issue/revoke (QR-in-person flow per Phase 3+8)
7. **Bulk migration approval** — three-stage discipline (per Phase 6); `migration_batch_id` + revert (must-add)
8. **Customer/Item master data CRUD** — admin can add/edit; steward read-only

### Steward KPI weekly card (Phase 8 R1 Q4 lock)

Four metrics on a single card on the dashboard:

| Metric | Computation | Target band |
|---|---|---|
| **Anomaly inbox aging** | Median time-to-disposition over last 7 days | <2h dispatched |
| **Edit-with-reason rate** | Edits / 1000 entries over last 7 days | 5-50/1000 (too low = missing things; too high = upstream quality bad) |
| **Dispute reopens** | Entries edited then re-edited (different reason) within 7 days | <2% |
| **Anomaly precision** | % of dispositioned anomalies marked "real issue" vs "false positive" over last 7 days | >80% |

4-week trend per metric. Click any metric → drill-down to underlying events.

### Edit-with-reason workflow (Phase 8 R1 Q3 lock)

For corrections of handler entries beyond 24h window:

1. Steward (or admin) opens entry in dashboard → **Edit with reason** button
2. Modal opens:
   - Diff preview (current values → new values)
   - **Reason: structured dropdown** (typo / operator-misread / equipment-misread / customer-disputed / late-correction / other)
   - **Evidence ref: optional field** (link to note ID, photo URL, conversation reference)
   - Free-text only when reason = "other"
3. Submit creates new revision in `revisions[]` array (per [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md) pattern)
4. Original record unchanged on disk (revisions append-only)
5. Audit event generated with full diff + reason + evidence
6. Per-steward reason distribution tracked: if 80%+ "other", that's the actual signal (not the audit trail)

### Bulk disposition + quick-correct (Phase 8 R2 Q2 lock)

**Bulk disposition** for repeat-flavor anomalies:
- Multi-select anomaly inbox items
- Single reason dropdown applied to all selected
- Batch resolve with audit trail per item
- Critical for week-2 reality (60+ items of same flavor; without bulk, inbox is write-only)

**Quick-correct inline edit** for one-character typo fixes:
- Inline edit button on entry rows in activity stream / recent entries
- Opens compact dialog (single field at a time)
- Still creates revision in `revisions[]` (forensic preservation)
- Bypasses the full edit-with-reason modal for trivial typos

### Active token rotation (Phase 8 R2 Q1 lock)

Per [AUTH_MODEL.md](AUTH_MODEL.md):
- Worker doc carries `active_token_id` field
- Re-issue rotates field; old token instantly invalidated
- **Rejected-write inbox** in dashboard surfaces writes from old phones that fail revoke check
- Steward decides: retry-via-handler-app / discard / annotate

### Role boundary (Phase 8 R2 Q3 lock)

| Action | Admin (Rishabh) | Steward |
|---|---|---|
| View anomaly inbox | ✅ | ✅ |
| **Close/disposition anomalies** | View-only | ✅ EXCLUSIVE |
| **Steward KPI weekly card** | View | ✅ EXCLUSIVE (graded by it) |
| Edit-with-reason | ✅ | ✅ |
| Bulk migration approval | ✅ EXCLUSIVE | View only |
| Worker provisioning | ✅ EXCLUSIVE | View only |
| Customer/Item master data CRUD | ✅ | View only |
| `min_supported_build` editor | ✅ EXCLUSIVE | View only |
| Audit log search | ✅ | ✅ |
| Override disputed steward decisions | ✅ EXCLUSIVE | — |

Forces the steward role to actually function (someone owns it). Admin retains override authority.

### Deferred to 2.1+

- **Stock graduation** (replenishment → per-job-allocation) — admin tool when items mature
- **Voice note transcription** (no voice notes in alpha per Phase 7)
- **Productivity-metric anomaly review** — needs ≥2 weeks data baseline
- **Mood/health score manual override UI** — schema-ready, rendering deferred per Design Lock

## Rationale

- **Steward role boundary** = forces ownership; without uniquely-theirs surfaces, role collapses into "Rishabh does it eventually"
- **Four-metric KPI card** = "data integrity" becomes measurable, not aspirational
- **Structured enum + per-steward distribution** = real signal from edit-with-reason (raw text becomes "fixed"; distribution shows what's actually happening upstream)
- **Bulk disposition** = closes the week-2 inbox-flood failure mode
- **Quick-correct inline** = closes the typo-fix-friction failure mode
- **Active_token_id rotation** = closes the stolen-phone-offline-queue exploit (Phase 3 revocation was illusory for offline data)
- **Confirm-twice min_supported_build editor** = bumping it can lock out handlers; needs friction

## Acceptance Criteria (the bar)

- [ ] All 8 alpha-required steward surfaces deployed
- [ ] Pending conflicts inbox + anomaly inbox: steward-exclusive disposition (rules + UI gate)
- [ ] Edit-with-reason: structured enum dropdown; optional evidence; per-steward distribution tracked
- [ ] Steward KPI weekly card: 4 metrics computed correctly; 4-week trend visible
- [ ] Bulk disposition: multi-select + single-reason workflow tested with mock data
- [ ] Quick-correct inline edit: tested for typo-fixes across all entry types
- [ ] active_token_id rotation: re-issue invalidates old token even from offline queue replay
- [ ] Rejected-write inbox: surfaces writes from rotated tokens
- [ ] Audit log search defaults to entity-first context; "Advanced" tab unlocks free-text
- [ ] `migration_batch_id` + revert(batch_id) admin function tested
- [ ] `min_supported_build` editor with confirm-twice modal
- [ ] Worker provisioning UI: add/re-issue/revoke with QR generation; companion to HANDLER_PROVISIONING runbook

## Implementation Notes

- Steward custom claim `is_steward: true` set on Worker provisioning when role includes steward responsibilities
- KPI metric calculations: aggregator CFs run on schedule (daily at midnight); store snapshots in `kpi_snapshots/` collection for trend rendering
- Edit-with-reason modal: form component in dashboard; reason enum hardcoded with i18n labels
- Per-steward distribution tracking: query audit_events filtered by `triggered_by_user` + `action='edit-with-reason'`; aggregate by reason value
- Bulk disposition UI: react-table with multi-select; single-action toolbar
- Inline quick-correct: floating edit icon on hover (desktop) / long-press (mobile if dashboard ever ships mobile); opens minimal dialog
- Rejected-write inbox: collection `_rejected_writes/` populated by security-rule-deny audit trail; steward reviews and decides per item
- Confirm-twice modal: first confirm = "Are you sure?"; second confirm with explicit warning = "This will lock out X handlers on builds <Y. Type CONFIRM to proceed."

## Future Considerations

- **AI-assisted anomaly disposition** (Phase 2.2+) — ML model suggests likely disposition based on historical steward decisions
- **Mobile steward app** (Phase 2.1+) — steward responds to anomalies from phone (currently dashboard-only)
- **Steward delegation** (Phase 2.2+) — admin can delegate specific anomaly categories to specific stewards
- **Audit log analytics** (Phase 2.2+) — pattern detection on audit events; e.g., "this customer's invoices always have edit-with-reason in the same field"
- **Push notifications for urgent anomalies** (Phase 2.1+ once PWA push works on Android)

## Related

- [ANOMALY_INBOX.md](ANOMALY_INBOX.md) — the 11 categories detail
- [AUTH_MODEL.md](AUTH_MODEL.md) — `active_token_id` rotation; custom claims
- [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md) — pending-conflicts inbox source
- [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md) — `revisions[]` schema for edit-with-reason
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — bulk migration approval UI
- [DASHBOARD_VIEWER.md](DASHBOARD_VIEWER.md) — surfaces these affordances
- [HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md) — worker provisioning workflow

---

*Authored 7 May 2026 by Aurelius.*
