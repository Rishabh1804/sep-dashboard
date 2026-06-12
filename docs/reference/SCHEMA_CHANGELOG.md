
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
