
## v2.1 — 12 June 2026: Job id = sep-{IM source id} (was sep-{challanNo})

The real 508-challan export's dry-run tripped the collision guard: **107
challan-number collisions**. Root cause: `challanNo` is the **customer's**
challan number — different customers issue overlapping numbers ("1", "10",
"100" each appear from multiple clients) and 4 rows carry no number at all.
It was never a valid identity.

- `Job.id` (imported) = `sep-{incomingMaterial.id}` (e.g. `sep-IM-0044`) —
  source ids are unique across the export and stable across re-imports.
- `sep_invoicing_challan_no` remains the human cross-reference field
  (omitted when the source row has none); the picker keeps displaying
  "Challan {no}".
- The importer guard now detects duplicate SOURCE ids (data corruption);
  duplicate customer challan numbers are two legitimate jobs.

No document shape change — id format only. Pre-seed: no live jobs existed
beyond the fixture, so no migration.

## v2.2 — 12 June 2026: Stage D field completion (evidence-order forms)

Additive, optional-field changes only — no migration; pre-v2.2 documents
remain valid. Driven by the soma-internal evidence order (decisions/
2026-06-12.md §2) and two skew rulings:

- **`workers/{wid}/shifts`**: + `slot?: 'morning_ot' | 'regular' |
  'evening_ot'` — T-CH: tags each in/out onto the payroll OT decomposition
  (morning 6–8:30 = 3 hr convention; evening post-5 PM). Alpha shifts carry
  `direction: 'in' | 'out'` (the Stage C field) rather than the four-state
  `action`; the aggregator treats them equivalently.
- **`production_entries`**: + `rounds?: number`, `round_size?: number` —
  the register's native grain ("108-round", "25×6"). When the operator
  enters only rounds, the client derives `qty_*` = rounds × round_size.
- **`jobs`**: + `challan_no?: string` — the customer's paperwork number as
  captured at receipt by the handler. A LABEL, not a key (the 107-collision
  ruling stands). `sep_invoicing_challan_no` remains the importer-sourced
  legacy cross-ref; readers (job picker) check both.
- **`stock_items/{sid}/receipts`**: `unit_cost`, `cost_unit`, `supplier_id`
  now OPTIONAL, validated when present; `cost_unit` must accompany
  `unit_cost`. Ruling from codex evidence (zinc PO #70): material arrives
  on unpriced challans, the priced invoice follows days later. Forcing a
  fake cost at receipt would corrupt the weighted-average rollup.
- **`stock_items/{sid}/depletions`**: + `level_after?: number` (≥ 0) — the
  chemistry stock-take companion; `level_after === 0` is Shyam's "NIL" and
  drives the dashboard Live view's reorder alert.
- **`notes`**: + `priority: 'normal' | 'urgent'` (handler now writes it);
  `kind` gains `power_cut` / `incident` as first-class values (power-cut
  log evidence; the codex's cut-#N record becomes an urgent note).

Rules deployed alongside: receipt/depletion validators updated; NEW
collection-group read matches for `shifts` + `depletions` (the Live
viewer's check-in stream and NIL alerts query across parents).
