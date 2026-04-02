# NEXT SESSION SPEC — Session 8 Options

**Current state:** v2.1, design score 4.5/5 (locked), productivity score 4.3/5, 130 functions, 7 tabs
**Live URL:** https://rishabh1804.github.io/sep-dashboard/

---

## Option A: Hardening & Enforcement (Productivity 4.3 → 4.5)

**Target:** Close remaining gaps that affect daily reliability.

### A1. Month-Lock Enforcement
- Currently the lock shows a badge but doesn't actually prevent edits
- When a month is locked:
  - Attendance tab: hide toggle buttons for dates in locked month
  - Production tab: hide capacity controls, picker, confirm for locked dates
  - Finance tab: hide "Mark as Paid" and "Record Advance" for locked periods
  - History tab: show "Locked" badge, hide all edit controls
- Use `isMonthLocked()` check in `markAtt()`, `lockProdAtt()`, `markCWPaid()`, `markPermPaid()`

### A2. Validation Guards
- **Duplicate invoice number prevention:** Check `sep_inv_v1` before saving; warn if same number exists
- **Advance > wage warning:** If advance exceeds calculated wage, show warning (don't block)
- **Client deletion referential integrity:** If client has invoices, show count and require confirmation
- **Empty attendance guard:** Warn if confirming production with 0 workers present
- **Rate card duplicate prevention:** Don't allow same material for same client twice

### A3. Undo on Mark-Paid
- "Mark as Paid" for CW/Perm/Invoice currently has no undo
- Add "Undo" button that appears for 10 seconds after marking paid
- Or: add "Unmark" option that resets to unpaid with confirmation

### A4. History Tab — Locked Month Badge
- When browsing a locked month in History, show locked badge
- Disable any edit controls for locked dates
- Show the month summary (from lock data) as a card

---

## Option B: Analytics & Export (Productivity 4.3 → 4.5)

### B1. Monthly Analytics Section (Home tab or new sub-view)
- **Staffing Efficiency %:** `(days with zero shortfall ÷ working days) × 100`
- **Average Extra Cost/Day:** Mean daily extra cost for the month
- **Area Utilization:** Per-area: days active ÷ working days (horizontal bar or text)
- **OT Distribution:** Morning vs Evening OT hours for the month
- **Month-over-Month:** Compare current month to previous (↑↓ arrows)
- Data source: iterate `sep_prod_log_v1` for current + previous month

### B2. CSV Export (Attendance + Payroll)
- "Export" button on Finance tab → generates CSV with:
  - Monthly attendance per worker (date, status, OT hours)
  - Monthly payroll summary (per worker: days, gross, OT, advance, net)
  - Monthly cost breakdown (wages, extra, snack, OT by day)
- Uses `Blob` + `URL.createObjectURL` pattern (same as GST export)

### B3. Invoice PDF Generation
- "Download PDF" button on invoice detail panel
- Generates a formal invoice PDF with:
  - Company header, GSTIN, address
  - "Tax Invoice" title with invoice number and date
  - Client details (name, GSTIN, state)
  - Line items table with description, HSN/SAC, qty, rate, amount
  - Tax summary (CGST + SGST or IGST)
  - Total in words
  - Bank details for payment
  - Signature block
- Uses HTML-to-print or canvas-based PDF generation

### B4. Dashboard Charts
- Simple bar/line charts using SVG or Canvas (no library dependency)
- Daily cost trend (last 7 days) on Home tab
- Monthly attendance heatmap on History tab
- Keep it lightweight — no Chart.js or D3 dependency

---

## Option C: Editable History & Sync (Productivity 4.3 → 4.5)

### C1. Editable Past Production Days
- Date picker on Production tab (currently locked to today)
- Select any past date → load its production data → edit capacity, workers, pieces
- Respect month-lock — locked dates show read-only view
- Save updates back to `sep_prod_log_v1`

### C2. Bidirectional CW↔Production Sync
- Currently: Production confirm writes attendance, but editing attendance directly doesn't update production log
- Add sync: when marking CW absent on Attendance tab, update production log if it exists for that date
- Show warning: "This worker is assigned in production. Remove from production?"

### C3. Multi-Day Attendance View
- Calendar-style grid view for a month
- Per-worker row showing P/A/OT status for each day
- Click a day to jump to History detail for that date
- Color-coded: green=present, red=absent, blue=OT

---

## Option D: Combined Session (Recommended)

1. **A1** — Month-lock enforcement (blocks edits). ~15 min.
2. **A2** — Validation guards. ~15 min.
3. **B1** — Monthly analytics on Home tab. ~20 min.
4. **B2** — CSV export for attendance + payroll. ~15 min.
5. **A4** — History tab locked month badge. ~10 min.

This gets productivity to ~4.5 and closes the most impactful remaining gaps.

---

## Files to Upload for Session 8

1. **index.html** (or SEP_Dashboard_v2.1.html) — The current build
2. **SESSION_7_HANDOFF.md** — What was done, scores, gaps
3. **PROJECT_REFERENCE.md** — Architecture, data model, workers, rules (updated)
4. **This file** (NEXT_SESSION_SPEC.md) — Session 8 options

Tell the new chat which option you want (A/B/C/D) and it will have full context.
