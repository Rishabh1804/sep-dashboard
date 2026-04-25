# Session 8 — Reading & Three-Feature Charter

**Phase:** dashboard-phase-2 (`dash-2-1` reading + `dash-2-2` lock)
**Author:** Theron (Builder, sep-dashboard, War Time 2026-04-24)
**Source spec:** [`NEXT_SESSION_SPEC.md`](../NEXT_SESSION_SPEC.md) (root)
**Baseline:** v2.1 — `index.html` 4,531 lines, 130 functions, 7 tabs, design 4.5/5 locked, productivity 4.3/5
**Live:** https://rishabh1804.github.io/sep-dashboard/
**Doctrine:** Edict VIII — charter before build. This document IS `dash-2-1`'s deliverable; the charter PR description IS `dash-2-2`'s deliverable.

---

## 1. What the spec actually is

`NEXT_SESSION_SPEC.md` is a **menu, not a spec.** It offers four options:

- **Option A — Hardening & Enforcement.** Four sub-items: A1 month-lock enforcement (the lock currently shows a badge but doesn't block edits), A2 validation guards (5 bullets), A3 mark-paid undo, A4 history-tab locked-month badge.
- **Option B — Analytics & Export.** Four sub-items: B1 monthly analytics section, B2 CSV export (attendance + payroll), B3 invoice PDF generation, B4 dashboard charts.
- **Option C — Editable History & Sync.** Three sub-items: C1 editable past production days, C2 bidirectional CW↔production sync, C3 multi-day attendance calendar view.
- **Option D — Combined Recommended.** A 5-item mix the spec author recommended: A1, A2, B1, B2, A4.

The Phase-2 charter is **three features max** (one per Phase-3 task slot `dash-3-1/2/3`). Option D as written is five items. Edict VIII forces a choice.

## 2. Priority signals from `PROJECT_REFERENCE.md` "Still Pending" table

| Feature | Priority | Notes |
|---|---|---|
| Month-lock enforcement on edit (**A1**) | **HIGH** | Lock currently shows a badge but doesn't block attendance/production edits — the only HIGH-priority gap on the table |
| Editable past production days (C1) | MEDIUM | Date picker on Production tab |
| Monthly analytics dashboard (B1) | MEDIUM | Staffing efficiency %, area utilization, cost trends |
| CSV/Excel export (**B2**) | MEDIUM | Monthly attendance and payroll export |
| Validation guards (**A2**) | MEDIUM | Duplicate invoice numbers, advance > wage, client deletion ref-integrity |
| Bidirectional CW↔Production sync (C2) | LOW | Edit in CW tab reflects in production log |
| Invoice PDF generation (B3) | LOW | Formal PDF for clients |
| Multi-month GST summary | LOW | Quarterly GST return data |

## 3. Locked features for Phase 3

### Slot 1 (`dash-3-1`) — A1 + A4 bundled: "Month-lock: enforce edits + History badge"

**One feature, four tab surfaces, one merge.** Currently the lock is cosmetic — `isMonthLocked()` returns the right answer but call sites don't gate edits. Bundling A1's four-tab guard with A4's History-side expression of the same lock state is the natural unit (one doctrine, end-to-end).

**Acceptance criteria:**
1. **Attendance tab:** when current month is locked, the toggle buttons for any date in the locked month are hidden / disabled.
2. **Production tab:** when target date is in a locked month, capacity controls, picker, and confirm are hidden / disabled.
3. **Finance tab:** "Mark as Paid" and "Record Advance" controls are hidden / disabled for locked periods.
4. **History tab:** browsing a locked month shows the locked badge; edit controls for locked dates are disabled; month-summary card from `sep_month_lock_v1` renders.
5. `markAtt()`, `lockProdAtt()`, `markCWPaid()`, `markPermPaid()` short-circuit with a clear UI message if the target month is locked.
6. Smoke test additions under `tests/e2e/`: lock a month in test setup, confirm each of the four surfaces blocks its specific edit affordance.

### Slot 2 (`dash-3-2`) — A2: "Validation guards"

**Five plug-in pre-save warnings.** Error prevention is cheaper than recovery; each guard hooks into an existing save path and adds no new UI surface.

**Acceptance criteria:**
1. **Duplicate invoice number:** before `submitInvoiceForm()` writes, scan `sep_inv_v1` for the same `invNo` — warn (don't block) with "use anyway / cancel" prompt.
2. **Advance > wage:** if recorded advance for a worker exceeds calculated wage for the period, show a warning on the pay card. Don't block (Sovereign's call to record over-advance).
3. **Client deletion referential integrity:** when deleting a client from the master, count their invoices in `sep_inv_v1` and require explicit confirmation if count > 0.
4. **Empty attendance guard:** at production confirm, if zero workers are marked present across all areas, warn "no workers present — confirm anyway?".
5. **Rate card duplicate:** when adding a rate to `sep_rates_v1`, prevent same `(clientId, material)` pair appearing twice.
6. Smoke test additions: drive each guard, assert warning surfaces, assert "use anyway" still completes the save.

### Slot 3 (`dash-3-3`) — B2: "CSV export (attendance + payroll)"

**Audit-grade monthly export.** Zero design-system risk (button + Blob + download link, same pattern as the existing GST CSV export). Gives Sovereign a paper-trail medium that fits existing spreadsheet workflows.

**Acceptance criteria:**
1. "Export" button on Finance tab generates one or more CSVs covering the selected month.
2. **Attendance CSV:** per worker × per date — status (P / A / OT) + OT hours.
3. **Payroll CSV:** per worker — days, gross, OT, advance, net for the month.
4. **Cost CSV:** per date — wages, extra cost, snack cost, OT cost.
5. Filenames: `SEP_attendance_{YYYY-MM}.csv`, `SEP_payroll_{YYYY-MM}.csv`, `SEP_costs_{YYYY-MM}.csv`. Numeric values use `sepRound()`. Dates use `localDateStr()`. Per Build Rules 7–9.
6. Implementation: `Blob` + `URL.createObjectURL` (same pattern as existing GST export).
7. Smoke test additions: trigger export from a seeded `localStorage`, intercept the download via `page.waitForEvent('download')`, parse the CSV, assert row counts and key totals match the seed data.

## 4. The fourth feature I say no to — B1 (Monthly Analytics Section)

**Reasoning, on the record:**

1. **Design-surface risk.** Design is locked at 4.5/5. B1 introduces a new section layout (Home tab or sub-view) with five new data presentations — efficiency %, cost/day, area utilization bars, OT distribution, MoM arrows. Every new pixel must clear the token-system bar; that's a real cost on a locked system.
2. **Compute footprint.** B1 iterates `sep_prod_log_v1` across current + previous month on every Home-tab render. Not a correctness risk, but a perf-cliff risk on the PWA that has to remain instant on mobile.
3. **Opportunity cost.** Slot 3 (B2 CSV export) ships the same "audit / reporting" instinct B1 is trying to satisfy — but via a medium Sovereign actually uses (the spreadsheet loop), with zero new UI surface. B2 beats B1 on productivity-per-slot.
4. **Deferrable.** B1 is a clean Session-9 charter candidate. It doesn't block A1/A2/B2 and isn't a prerequisite for anything HIGH-priority.

## 5. Implicitly rejected (named so Sovereign doesn't have to guess)

- **A3 (mark-paid undo):** Useful, but A1's month-lock enforcement largely subsumes the "oops, wrong period" class of errors that A3 protects against. Defer.
- **B3 (invoice PDF):** LOW priority. v2.1's form-based invoice modal already closed the creation-flow gap; PDF is print-tier polish, not productivity. Defer.
- **B4 (dashboard charts):** Nice-to-have visual; same design-surface risk as B1. Defer.
- **C1 (editable past production):** Useful but interacts non-trivially with A1 — must define which months are "still editable" relative to the lock. Better as Session-9 material once A1 lands and the doctrine is concrete.
- **C2 / C3:** LOW priority. Session-9+.

## 6. Phase-3 sequence (Aurelius's ordering, ratified across PR #3 and PR #4)

1. **(this PR)** Spec-review charter — pure-charter, no tests.
2. **`sw.js cache.addAll` hardening** — separate PR immediately after this one merges. Aurelius R2 from PR #3 review. Canonical fix (per Cipher's PR #3 §2 sketch): `Promise.allSettled` + per-asset `cache.add`. Closes a live production bug (any user blocked from Google Fonts gets zero offline support today).
3. **`dash-3-1`** — A1+A4 month-lock enforcement, with `tests/e2e/month_lock.spec.ts`.
4. **`dash-3-2`** — A2 validation guards, with `tests/e2e/validation.spec.ts`.
5. **`dash-3-3`** — B2 CSV export, with `tests/e2e/export.spec.ts`.

Each Phase-3 PR ships its own test file under `tests/e2e/` plus a passing run-log in the PR description, per Sovereign's Playwright arming directive.

## 7. Out-of-scope for Phase 2 / Phase 3

- All of Option B beyond B2, all of Option C, A3 — deferred to Session 9 charter.
- `NEXT_SESSION_SPEC.md` relocation under `docs/` — held for now; the file is historical record of the option menu and lives quietly. Move can happen in a later cleanup PR if Sovereign wants.
- Design-system changes — design is locked at 4.5/5; nothing here loosens that.
- `.github/workflows/deploy.yml` integration with the Playwright suite — held until Sovereign calls for it.

## 8. Acceptance for `dash-2-1` and `dash-2-2`

- **`dash-2-1`:** this document committed to `docs/SESSION_8_READING.md`.
- **`dash-2-2`:** the charter PR description (which carries §3's three locked features and §4's rejected fourth) merged into `main`. On merge, Codex `data/volumes.json` chapter for sep-dashboard updates with the locked-feature list as the chapter `spec_url` body.

> *Session 8 already paid for the territory. This document maps it; the charter PR walks it.*
