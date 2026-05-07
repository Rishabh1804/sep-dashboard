# Dashboard Viewer (Minimal Alpha Scope)

**Phase:** 7
**Status:** LOCKED — 7 May 2026 (Phase 7 Round 2 Q3: bring forward critical operational surfaces from v2.1)

---

## Problem

What does Rishabh see in alpha? NOT the floor view (deferred to Phase 2.1+). The alpha dashboard is the *write-companion* to the handler PWA — Rishabh oversees data flowing in, dispositions exceptions, manages workers + stock. If alpha dashboard ships too thin, Rishabh keeps v2.1 open in another tab → data drift = Phase 2 failure.

## Adversarial Findings

**HIGH** — "If 2.0 ships with this dashboard, Rishabh will keep v2.1 open. Two-system steady state = data drift."

Adversary recommended bringing forward ALL v2.1 surfaces. User chose **moderate scope (R2 Q3 option B)**: bring forward critical operational surfaces; defer per-worker productivity rollup + DFT-fail rework queue to 2.1.

## Locked Decision

### Alpha dashboard surfaces

#### Top bar (always visible, ~48px)

- Clock + shift indicator
- **Pending conflicts inbox count** (badge; click → inbox)
- **Anomaly inbox count** (badge; click → inbox)
- **Stock criticality count** (badge; click → critical stock view)
- Search (job ID + customer name only per Phase 7)
- Calm mode toggle (visual noise reduction)
- Hamburger menu

#### Main canvas (tabbed)

##### Tab 1 — Activity stream (default)

Chronological list of all writes across all handlers. Filterable by:
- Type (jobs / production / DFT / dispatch / stock / machine state / notes)
- Author
- Time range (last hour / today / yesterday / custom)
- Customer (when relevant)

Each entry: timestamp, author, type, summary, link to detail. Click → expanded view with full payload + audit trail.

##### Tab 2 — Recent entries by category

Sub-tabs per entity type:
- **Jobs** — all jobs with current status, location, SLA clock, customer, item, tier
- **Production** — recent production_entries with job + machine + worker + qty
- **DFT** — recent dft_measurements with outcome
- **Dispatch** — recent dispatch_events with mode + customer
- **Stock** — current_level for all stock_items, sorted by criticality (low → high)
- **Machine States** — current_status for all machines, sorted by area + room
- **Notes** — recent notes with summary, kind, priority, status

Each tab: sortable table; pagination; export to CSV.

##### Tab 3 — Job in-flight board

List/table view (NOT floor view) of all jobs with:
- Job ID
- Customer
- Item
- Received at + SLA deadline
- Current status + location
- % done (if WPP calibrated)
- Quality tier
- Assigned worker
- Notes (count + urgent flag)

Filterable by status, customer, area, priority. Sortable by SLA deadline.

##### Tab 4 — Ready-to-dispatch alarms

Jobs in `ready` status, sorted by aging. Color-coded:
- Green: <6h ready
- Orange: 6-12h ready
- Red: >12h ready (12-hour Ready loiter alarm from Session 11 domain model)

Click any alarm → open Dispatch form pre-filled with that job.

##### Tab 5 — Stock reorder alerts

Critical-only by default (current_level <30% threshold). Expandable to show all stock with current levels + thresholds. Click → open Stock Refill form pre-filled.

#### Side panel (right, persistent ~360px)

##### Pending conflicts inbox (Phase 5 surface, steward-exclusive disposition)

LWW-overwritten edits + validation rejections + stale-build rejections. Per-conflict:
- Source: original write attempt (timestamp, author, intended values)
- Resolution: what won (current state)
- Suggested action: re-apply lost / accept winner / annotate / dismiss
- Steward action buttons (admin can view, only steward closes)

##### Anomaly inbox (Phase 8 surface, steward-exclusive disposition)

Auto-flagged anomalies (~11 categories per [ANOMALY_INBOX.md](ANOMALY_INBOX.md)). Multi-select for bulk disposition (Phase 8 must-add).

##### Audit log search (entity-first default)

"Show everything that touched Job J-4521" → list of audit_events filtered by entity. Free-text reason search behind "Advanced" tab.

#### Admin tabs (admin-only)

##### Worker provisioning UI (Phase 8)

- List of all workers (active + revoked + soft-deleted)
- "Add worker" form
- Per-worker actions: re-issue token / revoke (soft) / revoke (immediate) / view token history
- QR code generation for in-person provisioning

##### Bulk migration approval UI (Phase 6 + 8)

- Three-stage flow: dry-run → sample-N → full-run
- Each stage: explicit approval gate with diff preview
- Live progress bar during full-run
- `migration_batch_id` displayed; revert button (must-add)

##### Build version monitoring (Phase 6)

- Bar chart: handler builds in field, sorted by staleness
- Per-handler: last seen, last write, current build
- `min_supported_build` editor (with confirm-twice modal)
- Force-update broadcast (when push capability exists, Phase 2.1+)

##### Steward KPI weekly card (Phase 8)

- Anomaly inbox aging (median time-to-disposition)
- Edit-with-reason rate per 1000 entries (banded target)
- Dispute reopens (entries edited → re-edited within 7 days)
- Anomaly precision (% real vs false positive)
- 4-week trend per metric

### NOT in alpha (deferred to 2.1+)

- **Konva floor view** + animations + HUD overlays + hotkey set
- **Per-worker productivity rollup** (needs ≥2 weeks data baseline per Design Lock)
- **DFT-fail rework queue** (visible in activity stream + recent DFT tab; specialized queue deferred)
- **Job slip print** (dependent on data-capture-first; defers from Session 12)
- **Customer portal** (Phase 2.2+ third PWA)
- **Time-travel / replay UI** (git history of `topics/` is a stop-gap)
- **Multi-zoom map** (depends on floor view)

### Critical operational surfaces brought forward from v2.1

- ✅ Today's activity stream
- ✅ Recent entries by category
- ✅ Job-in-flight board (list view)
- ✅ Ready-to-dispatch alarms (12-hour Ready loiter)
- ✅ Stock reorder alerts
- ✅ Worker version distribution
- ✅ Audit log search

### v2.1 sunset

Alpha launch = v2.1 dashboard sunset. Construction overlay removed (per Stage A modularization). Alpha dashboard at `/sep-dashboard/`; handler PWA at `/sep-dashboard/entry/handler/`.

## Rationale

- **Activity stream as default tab** = matches owner's "what's happening right now" mental model; fastest path to confirming data is flowing
- **Recent entries by category** = familiar table view; replaces v2.1 rendering with new schema
- **Job in-flight board** = the operational pulse owner needs daily; deferred floor view doesn't break this
- **Ready-to-dispatch alarms** = locked Session 11 alarm surfaces in alpha (was supposed to be on floor view; lifted to a list)
- **Stock alerts** = operational continuity; Rishabh acts on these directly
- **Defer productivity rollup** = honest about needing ≥2 weeks baseline; ship when meaningful
- **Defer DFT-fail rework queue** = visible in activity stream; specialized queue is polish

## Acceptance Criteria (the bar)

- [ ] Alpha dashboard at `/sep-dashboard/` deploys cleanly; v2.1 sunset
- [ ] All 5 main canvas tabs implemented + functional
- [ ] Pending-conflicts inbox + anomaly inbox + audit log search all surfaced in side panel
- [ ] Worker provisioning UI with QR generation works end-to-end (per `HANDLER_PROVISIONING.md`)
- [ ] Bulk migration approval UI with 3-stage gates implemented
- [ ] Build version monitoring panel + min_supported_build editor (with confirm-twice modal)
- [ ] Steward KPI weekly card surface (4 metrics; populated as data accrues)
- [ ] Search bar covers job IDs + customer names (Phase 7 narrow scope)
- [ ] Real-time updates via Firestore listeners; staleness indicator per entity card

## Implementation Notes

- Build entry: `src/dashboard/main.js` → bundles to `/sep-dashboard/`
- Heavy real-time use of Firestore listeners; budget ~15-20 active listeners on a typical session
- Konva NOT bundled in dashboard alpha; reserved for 2.1
- Tabs are React Router routes; deep-linkable
- Side panel persistent on desktop (≥1280px); collapses to drawer on smaller screens
- Search: client-side filter on cached entities (no server query for typical search); falls back to server query for older data

## Future Considerations

- **Konva floor view** ships in Phase 2.1 alongside HUD + overlays + hotkeys + interaction model (Session 12 design lock fully realized)
- **Productivity rollup** ships once 2-week baseline accumulated; can be back-computed from existing data
- **DFT-fail rework queue** ships as polish in 2.1
- **Multi-tenant dashboard** when org expands
- **Customer-facing read-only portal** (Phase 2.2+)

## Related

- [HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md) — handler PWA companion
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — steward-exclusive surfaces (anomaly + KPI)
- [ANOMALY_INBOX.md](ANOMALY_INBOX.md) — 11 categories detail
- [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md) — pending-conflicts inbox surface
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — bulk migration approval UI
- [EXCELLENT_DATA_CAPTURE.md](EXCELLENT_DATA_CAPTURE.md) — alpha dashboard supports the bar

---

*Authored 7 May 2026 by Aurelius.*
