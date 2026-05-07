# Handler Forms — Field-Level Spec

**Phase:** 7
**Status:** LOCKED — 7 May 2026
**Companion:** [HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md) for shell + universal template

---

## Overview

Nine forms shipping in alpha. Notebook handler sees all 9; future role-apps (Inspector, Dispatch, etc.) see role-specific subsets. Every form follows the universal template (HANDLER_UI_SHELL.md) and is wrapped in Zod validation per Phase 6.

Common fields (every form):
- `idempotency_key: string` (UUID generated on form open)
- `app_version: string` (build hash)
- `created_at: Timestamp` (server-set per Phase 4)
- `author_user_id: string` (= request.auth.uid; rules-pinned)
- Implicit: form draft auto-saved to IndexedDB on every keystroke

---

## Form 1 — Job Receipt

**Frequency:** ~30/day. **Default submit:** Submit & return.

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `customer_id` | typeahead | recent-first | required, must exist | Big-button picker grid + search fallback |
| `item_id` | typeahead | recent for customer | required, must exist for customer | Filtered by customer |
| `received_kg` | number | — | required, >0, <100000 | Numeric input with kg unit |
| `received_pcs` | number (auto-derived) | `Math.floor(received_kg / item.wpp_grams * 1000)` if WPP known | shown as derived; manual override allowed | Dotted ring badge if WPP uncalibrated |
| `client_tier_at_receipt` | enum | from customer.client_tier | required | Read-only display (snapshot) |
| `quality_tier_override` | enum | from customer.default_quality_tier | optional | Toggle: standard / premium |
| `notes` | textarea | "" | optional, max 1000 chars | Below all fields |

On submit:
- Creates `Job` doc with `__schema_version: 1`, `current_status: 'in-flight'`, `received_at: serverTimestamp()`, `sla_deadline_at: received_at + 24h`
- Generates job_id format `J-{YYYY}-{nnnn}` (sequential per year)
- Triggers `auditEventGenerator` CF post-write
- Optionally prints job slip via Stage E (deferred from Session 12 since data-capture-first)

---

## Form 2 — Production Entry

**Frequency:** ~300/day. **Most-frequent form.** **Default submit:** Submit & continue.

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `job_id` | typeahead | last entry's job (with full pre-fill defense bundle: visual diff highlight, 15-min decay, job-completion auto-clear, first-of-session confirm-step) | required, must be `in-flight` job | Big-button picker grid (recent-first) |
| `machine_id` | typeahead | last entry's machine if same job | required, must exist + not down + not maintenance | Big-button picker grid |
| `worker_id` | typeahead | self | required, must be on shift | Picker; default is current handler |
| `qty_pcs` | number | — | required for VAT machines, optional for barrel; >0; sanity hard-block 2σ | Devanagari numpad |
| `qty_kg` | number | — | required for barrel machines; >0; sanity hard-block 2σ | Devanagari numpad |
| `station` | enum | from machine.type | required | Read-only display (auto-detected) |
| `notes` | textarea | "" | optional | Below |

On submit:
- Routed through `createProductionEntry` Cloud Function (Phase 4 cross-doc validation): worker-on-shift, machine-not-down, stock-sufficient, route-valid
- Creates `production_entries/{pid}` with `recorded_by_app: 'handler'`
- Triggers `eventSourcingAggregator` CF (Phase 5 aggressive split): updates Job.current_status, Job.current_location, Worker.current_location, Machine.health_score
- Triggers `auditEventGenerator`

---

## Form 3 — DFT Measurement

**Frequency:** ~30/day. **Default submit:** Submit & continue (batch DFT runs are common).

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `job_id` | typeahead | recent jobs in inspection state | required, must be in-flight + at inspection station | Big-button picker grid |
| `micron_value` | number | — | required, 0 < x ≤ 50 (hard-block >50) | Devanagari numpad with decimal |
| `inspector_id` | typeahead | self | required | Picker; default is current handler |
| `outcome` | enum | "pass" | required: pass / fail-rework | Two big buttons (default highlighted) |
| `failure_mode` | enum | — | required if outcome=fail-rework: low-dft / high-dft / finish-defect / other | Conditional dropdown |
| `notes` | textarea | "" | optional | Below |

On submit:
- Routed through `createDftMeasurement` CF: route-violation check (job must have plating event in route_history)
- Creates `dft_measurements/{mid}`
- If `outcome=fail-rework`: triggers `ReworkSegment` creation in `jobs/{jid}/rework_segments/`
- Triggers job state recompute via aggregator

Sanity hard-block: micron_value > 50 µm physically impossible; rejected at Zod boundary with explicit error.

---

## Form 4 — Dispatch Event

**Frequency:** ~20/day. **Default submit:** Submit & return.

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `job_id` | typeahead | jobs in `ready` status | required, must be `ready` | Big-button picker grid |
| `customer_id` | enum | from job.customer_id | required | Read-only display |
| `mode` | enum | "3-wheeler" | required: 3-wheeler / bike / cycle / hand / other | Big buttons |
| `vehicle_details` | text | "" | optional, max 200 chars | Below mode |
| `dispatched_at` | Timestamp | server-set | required | Read-only display |
| `customer_acknowledgment` | boolean | false | optional | Toggle (worker can mark customer signed delivery slip) |
| `notes` | textarea | "" | optional | Below |

On submit:
- Routed through `createDispatchEvent` CF (Phase 4): no-double-dispatch check (job must not already be dispatched), dispatched-quantity-check (≤ received quantity)
- Creates `dispatch_events/{eid}`
- Triggers job state update (current_status → 'dispatched')
- Best-effort `sep-invoicing` integration check (per Design Lock §6.1; resilience principle: failure does not block dispatch)

---

## Form 5 — Stock Refill

**Frequency:** ~5/day. **Default submit:** Submit & return.

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `stock_item_id` | typeahead | recent | required, must exist | Big-button picker (recent-first by category) |
| `qty_received` | number | — | required, >0 | Devanagari numpad |
| `unit` | enum | from stock_item.unit | required: kg / L / pcs / units / kWh | Read-only display |
| `unit_cost` | number | — | required, >0 (per-receipt cost since prices fluctuate) | Devanagari numpad with currency symbol (₹) |
| `cost_unit` | toggle | "per_kg" | required: per_kg / per_bag / per_liter | Big toggle (Phase 7 must-add: explicit per-kg vs per-bag) |
| `supplier_id` | typeahead | recent | required, must exist (Phase 7 must-add: supplier as first-class entity) | Big-button picker |
| `receipt_photo` | image upload | — | optional | Camera button (Phase 2.1+) |
| `notes` | textarea | "" | optional | Below |

On submit:
- Creates `stock_items/{sid}/receipts/{rid}` event
- Triggers stock aggregator CF: `Stock.current_level += qty_received`; recomputes `weighted_avg_unit_cost`

Supplier entity (must-add): top-level `/suppliers/{sid}` collection with name, contact, payment_terms, delivery_history. Provisioned via dashboard admin UI; selectable in this form.

---

## Form 6 — Stock Depletion

**Frequency:** Variable. **Default submit:** Submit & return.

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `stock_item_id` | typeahead | recent | required, must exist | Big-button picker |
| `qty_depleted` | number | — | required, >0, ≤ current_level | Devanagari numpad |
| `reason` | enum | "production_use" | required: production_use / waste / spillage / theft / other | Big buttons |
| `linked_machine_id` | typeahead | from context | optional (helpful for `production_use`) | Picker |
| `notes` | textarea | "" | optional | Below |

On submit:
- Creates `stock_items/{sid}/depletions/{did}` event
- Aggregator CF updates `Stock.current_level -= qty_depleted`
- If `current_level <= threshold_critical`: triggers anomaly note generation (`kind: 'low-stock'`)

For graduated stock items (per-job-allocation tracking mode, Phase 2.1+), depletions are auto-generated per production_entry; manual depletion form remains for replenishment-mode items.

---

## Form 7 — Machine State Change

**Frequency:** ~10/day. **Default submit:** Submit & return.

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `machine_id` | typeahead | recent | required, must exist | Big-button picker |
| `new_state` | enum | — | required: running / idle / down / maintenance / inspecting | Big buttons (current state highlighted to show contrast) |
| `reason` | text | "" | required for `down`, optional otherwise; max 500 chars | Conditional textarea |
| `linked_note_id` | typeahead | from notes attached to machine | optional (link to detailed note for down events) | Picker |
| `expected_resolution_at` | Timestamp | "" | optional, future-dated | Date+time picker |
| `notes` | textarea | "" | optional | Below |

On submit:
- Creates `machines/{mid}/state_transitions/{tid}` event
- Aggregator CF updates `Machine.current_status` per Phase 5 aggressive split
- For `down` state: triggers anomaly note generation if no `expected_resolution_at` and not already noted

---

## Form 8 — Worker Check-In/Out

**Frequency:** ~40/day (4 actions × 10 workers). **Default submit:** Submit & return. **Form-with-smart-defaults primitive (Phase 7 R1 user lock).**

Optimized to ≤2 effective taps per smart defaults:
- Top bar "Clock" chip shows current state ("Checked in 2h 14m" or "Checked out")
- One tap on chip opens this form pre-filled with action = inferred toggle (in→out or out→in), worker = self, location = current room
- One tap on **Submit** completes; default values almost always correct

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `worker_id` | typeahead | self | required | Picker; default is current handler |
| `action` | enum | inferred toggle | required: clock_in / clock_out / break_start / break_end | Big buttons (inferred default highlighted) |
| `location` | enum | from worker.home_room or last machine | required: home_room / specific_room / in_transit / off_premises | Big buttons |
| `linked_machine_id` | typeahead | last machine if applicable | optional | Picker |
| `reason` | text | "" | optional, mostly for breaks (sick / lunch / prayer / smoke / etc.) | Free-text below |
| `notes` | textarea | "" | optional | Below |

On submit:
- Creates `workers/{wid}/shifts/{sid}` event
- Aggregator CF updates `Worker.current_status` and `Worker.current_location_room_id` per Phase 5

---

## Form 9 — Note (any entity)

**Frequency:** ~5/day. **Default submit:** Submit & return.

Per [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md) — structured-mem schema, not free-text.

| Field | Type | Default | Validation | UI |
|---|---|---|---|---|
| `topic_refs` | multi-select picker | — | required, ≥1 entity | Multi-attach: scrollable list of entities by type tab (machines / jobs / workers / customers / stock / rooms) |
| `summary` | text | — | required, ≤120 chars, "Use when..." voice | Single-line input with character counter |
| `body_md` | textarea | "" | optional, supports markdown | Below summary |
| `kind` | typeahead | suggestions from prior notes | optional, free-form | Suggestions: maintenance-flag / customer-preference / anomaly / safety-concern / quality-concern / incident / observation / reminder |
| `priority` | toggle | "normal" | required: normal / urgent | Big toggle |
| `tags` | multi-input | "" | optional, free-form | Chip input |
| `expires_at` | Timestamp | "" | optional, future-dated | Date picker (suggests defaults per kind) |
| `links` | multi-add | "" | optional: typed links to other notes | Picker for to_note_id; type dropdown |

On submit:
- Creates `notes/{nid}` with structured-mem schema
- Triggers anomaly detector if `kind: 'anomaly'` or `priority: 'urgent'`
- Triggers topic digest refresh on next hourly cron for affected `topic_refs`

Voice attachment: not in alpha (rejected per Phase 7 Round 2 ratification — handler is the literate steward; structured form is their tool, workers verbally report). Phase 2.1+ adds optional voice field.

---

## Acceptance Criteria (the bar)

- [ ] All 9 forms ship in alpha
- [ ] Each form has Zod schema in `src/shared/types/schemas.ts`
- [ ] Each form has Jest unit tests for: required-field validation, range validation, smart-default behavior, idempotency
- [ ] Form draft auto-save tested per form (state recovers across screen-wake)
- [ ] Big-button picker grids load from local IndexedDB cache; no server dependency on offline open
- [ ] Multi-modal submit confirmation (toast + haptic + audio) works on real Android device
- [ ] Form-by-form i18n complete (Devanagari labels + icons + long-press TTS)
- [ ] Sanity hard-blocks tested (DFT >50 µm rejected, qty 2σ-prompt confirm)
- [ ] Idempotency: submitting same form twice in a row produces single record (server dedup ±5min)
- [ ] CF-mediated forms (Production / DFT / Dispatch) handle offline gracefully (queue when CF unreachable, retry with backoff)

## Implementation Notes

- Form components live in `src/handler/forms/`
- Shared form template in Layer 4 component library (`src/components/Form*`)
- Picker components: `BigButtonPicker`, `RecentFirstSearch`, `MultiAttachPicker`
- Numeric input: custom Devanagari numpad component (digits 0-9, decimal point, backspace, submit)
- IndexedDB cache for picker data: refreshed via Firestore listener subscription on app boot; updated by listener
- Zod error messages localized per locale (Devanagari + English)

## Future Considerations

- **Voice attachment** for notes (Phase 2.1+)
- **Camera scan** for QR code on customer parts (Phase 2.1+) — instant job lookup
- **Bulk entry mode** for production entries (Phase 2.2+) — entering multiple machines' production for one shift in one screen
- **Form templates per role-app** — when Inspector PWA ships, re-uses DFT measurement form with subset of fields
- **Field-level audit** — every field's value-history tracked alongside revisions (Phase 2.1+)

## Related

- [HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md) — universal template + shell architecture
- [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md) — Note form schema
- [FIRESTORE_RULES.md](FIRESTORE_RULES.md) — rules these forms write through
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — `createProductionEntry`, `createDftMeasurement`, `createDispatchEvent` CF callable wrappers
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — Zod schemas evolve via migration discipline

---

*Authored 7 May 2026 by Aurelius.*
