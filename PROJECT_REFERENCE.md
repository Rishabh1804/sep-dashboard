# SEP Dashboard — Project Reference

**Current Build:** v2.1 (4,531 lines, 130 functions)
**Created:** 28 March – 2 April 2026 across 7 sessions
**Owner:** Rishabh Jain, Business Manager, Soma Electro Products
**Live URL:** https://rishabh1804.github.io/sep-dashboard/

---

## Architecture

**Single-file HTML app.** All CSS, JS, HTML in one file. No build tools. localStorage for persistence. Mobile-first (base CSS ≤400px, desktop @media 700px+). Deployed as a PWA via GitHub Pages with service worker for offline use.

**Fonts:** Fraunces (display/hero numbers) + Inter (body) + JetBrains Mono (numeric data) via Google Fonts CDN.

**Design System:** 7 design principles all scored 4.5/5 (locked). Token system — 9-step type scale, 10-step spacing, semantic colour domains, 5-tier card system (Hero→Action→Base→Daily→Info), 4-level intra-card hierarchy (title→value→label→meta). Three typographic voices: Fraunces for display, JetBrains Mono for data, Inter for body.

---

## Design Principle Scores (current — all locked)

| Principle | Score | Status |
|-----------|:-----:|--------|
| Hierarchy | **4.5** | ✅ 3 type voices, ff-mono for data |
| Proportion/Scale | **4.5** | ✅ Confirm title fs-xl, mono weight balanced |
| Emphasis | **4.5** | ✅ Per-tab hero tints, 3-beat rhythm |
| Balance | **4.5** | ✅ 375px breakpoint, responsive |
| Unity/Rhythm | **4.5** | ✅ 95%+ token adoption |
| Contrast | **4.5** | ✅ WCAG AA, light + dark |
| Similarity | **4.5** | ✅ Component patterns consistent |
| **Overall** | **4.5** | **All locked** |

---

## Tab Structure

| Tab | Purpose | Hero Focal Point |
|-----|---------|-----------------|
| Home | Today's snapshot + alerts | Present count + production + cost |
| Attendance | Mark present/absent | Headcount + Perm/CW badges |
| Production | 3-period flow, capacity, piece entry | Total pieces + extra/snack cost |
| Finance | Cost tracking, pay cards, month lock | Today's cost + month total |
| Invoice | Client master, invoicing, GST | Month invoiced + receivables |
| Stock | Chemical inventory | Stock status (OK / items need attention) |
| History | Date navigation, past records | Present count for selected date |

---

## Data Model (22 localStorage keys)

### CW Keys
| Key | Format | Purpose |
|-----|--------|---------|
| `sep_cw_emp_v2` | Array of `{id, name, inactive?, deactivatedOn?, deactivateReason?}` | CW worker roster |
| `sep_cw_att_v2` | Object keyed by `{id}_{YYYY}_{MM}_{DD}` → `{status, otHours, time}` | CW attendance |
| `sep_cw_cfg_v2` | `{hourRate: 41.25}` | CW config |
| `sep_cw_pay_v2` | Object keyed by Saturday date → `{paid, amount, date}` | CW weekly payments |
| `sep_cw_adv_v1` | Object keyed by `{id}_{satDate}` → amount | CW weekly advances |

### Perm Keys
| Key | Format | Purpose |
|-----|--------|---------|
| `sep_pe_emp_v1` | Array of `{id, name, role, dailyRate, inactive?, deactivatedOn?, deactivateReason?}` | Perm roster |
| `sep_pe_att_v1` | Same format as CW att | Perm attendance |
| `sep_pe_pay_v1` | Object keyed by `YYYY-MM` → `{paid, amount, date}` | Perm monthly payments |
| `sep_pe_adv_v1` | Object keyed by `{id}_{year}_{month}` → amount | Perm advances |

### Production Keys
| Key | Format | Purpose |
|-----|--------|---------|
| `sep_prod_log_v1` | Object keyed by `YYYY-MM-DD` → full day log | Production daily logs |
| `sep_prod_areas_v1` | Array of area objects with capacity levels | Area config |
| `sep_prod_cfg_v1` | `{hourRate, snackRate, permOtMultiplier, ...shifts}` | Production config |
| `sep_perm_snack_log_v1` | Array of `{empId, date, otHours, snack, week}` | Perm snack audit |

### Invoice Keys
| Key | Format | Purpose |
|-----|--------|---------|
| `sep_clients_v1` | Array of `{id, name, gstin, stateCode, billingPref}` | Client master |
| `sep_rates_v1` | Array of `{id, clientId, material, unit, rate, effectiveFrom}` | Rate cards |
| `sep_inv_v1` | Array of full invoice objects (see below) | Invoice register |
| `sep_inv_cfg_v1` | `{companyName, gstin, stateCode, sac, gstRate, seriesPrefix, nextNumber, bank*}` | Invoice config |

**Invoice object shape:**
```
{id, invNo, date, clientId, clientName, clientGstin, sac,
 lineItems: [{desc, unit, rate, qty, amount}],
 taxableValue, cgst, sgst, igst, total,
 supplyType: 'intra'|'inter', payStatus: 'unpaid'|'partial'|'paid',
 payDate, payAmount, createdAt}
```

### Month Lock Key
| Key | Format | Purpose |
|-----|--------|---------|
| `sep_month_lock_v1` | Object keyed by `YYYY-MM` → `{locked, lockedAt, summary}` | Month-close locks |

**Month lock summary shape:**
```
{permTotal, cwTotal, extraTotal, snackTotal, invoiceTotal, presentDays, absentDays}
```

### Stock & System Keys
| Key | Format | Purpose |
|-----|--------|---------|
| `sep_stock_v1` | Array of `{id, name, unit, qty, threshold, maxQty?, category}` | Stock items |
| `sep_stock_log_v1` | Array of `{id, name, delta, newQty, date, time}` | Stock movements |
| `sep_settings_v1` | `{darkMode, swipeTabs}` | App settings |
| `sep_data_version` | Integer | Data version |

---

## Production Areas

| Area | Group | Dependent | Capacity Levels | Default Roster |
|------|-------|:---------:|-----------------|---------------|
| VAT A1 | vat | No | Off/33%(3)/66%(4)/100%(5) | Sharat, Bhanu, Lucky, Lal, Suklal |
| VAT A2 | vat | No | Off/25%(2)/50%(3)/75%(4)/100%(4) | Sharat, Sai, Shambhu, Mantu |
| Barrel | barrel | No | Off/25%(2)/50%(2)/75%(3)/100%(3) | Sunil, Birsa, Tuklu |
| Pickling-VAT | vat | Yes (A1,A2) | Auto: 0/2/3 based on parent caps | Lucky, Lal, Suklal |
| Pickling-Barrel | barrel | Yes (Barrel) | Auto: 0/1/2 based on parent cap | Rupa, Bhanu |

**Pickling rules:**
- VAT: 3 workers when both VATs at 100%, else 2, else 0
- Barrel: 2 when >50%, 1 when ≤50%, 0 when off

---

## Workers (19 production + 2 non-production)

### Permanent (10)
| ID | Name | Role | Daily Rate | OT Eligible |
|----|------|------|:----------:|:-----------:|
| shyam_bera | Shyam | Production Supervisor | ₹576 | Yes (at ₹496 base) |
| sharat_mahato | Sharat | VAT A1 Lead | ₹496 | Yes |
| sunil_mahato | Sunil | Barrel Lead | ₹496 | Yes |
| rupa_bera | Rupa | VAT A2 Lead | ₹496 | Yes |
| bp_sharma | Bhanu | Worker | ₹496 | Yes |
| lk_das | Lucky | Worker | ₹496 | Yes |
| lal | Lal | Worker | ₹496 | Yes |
| suklal | Suklal | Pickling Lead | ₹440 | Yes |
| uday | Uday | Guard | ₹360 | No |
| rounak | Rounak | Data Admin | ₹0 | No (inactive) |

**Perm OT rate:** ₹496/day ÷ 8h × 1.1 = ₹68/hr (all eligible perm, including Shyam at reduced rate)

### Contract Workers (11)
Kusu, Sripati, Naren, Champai, Budheswar, Sai, Shambhu, Mantu, Rocky, Birsa, Tuklu

**CW rate:** ₹41.25/hr, no OT premium (1.0×), ₹20/day snack for evening OT

---

## Wage Calculation Rules

| Component | Formula |
|-----------|---------|
| CW daily wage | `(standard_hours + OT_hours) × ₹41.25` |
| Perm daily wage | `dailyRate` (fixed per day if present) |
| Perm OT | `OT_hours × ₹68/hr` |
| CW advance | Weekly deduction from `sep_cw_adv_v1` keyed by `{id}_{satDate}` |
| Perm advance | Monthly deduction from `sep_pe_adv_v1` keyed by `{id}_{year}_{month}` |
| Extra cost | `shortfall_workers × period_hours × ₹41.25` per period |
| Snack | `evening_OT_workers × ₹20` (CW + Perm) |
| All currency | `sepRound()` = `Math.floor()` — never fractional paisa |

---

## Invoice Rules

| Component | Value |
|-----------|-------|
| SAC | 998871 (Job work — electroplating) |
| GST Rate | 18% total |
| Intra-state (JH) | CGST 9% + SGST 9% |
| Inter-state | IGST 18% |
| Invoice series | SEP/{FY}/{0001} auto-incremented |
| State code | 20 (Jharkhand) |
| Rate types | Per kg or per piece, per client per material |
| Payment states | unpaid → partial → paid |
| Creation method | Form-based modal (v2.1) with rate card auto-fill |

---

## Key Utility Functions

| Function | Purpose | Critical Rule |
|----------|---------|--------------|
| `sepRound(n)` | Math.floor for currency | Always use, never raw Math.floor |
| `localDateStr(d)` | YYYY-MM-DD in local timezone | Never use toISOString() |
| `formatCurrency(n)` | ₹ + Indian locale formatting | Uses sepRound internally |
| `esc(s)` | HTML escape | Use in all template literals |
| `getCfg()` | Deep-merge config with DEF_CFG defaults | Prevents crash on missing nested keys |
| `getInvCfg()` | Deep-merge invoice config with DEF_INV_CFG | Same pattern |
| `genInvNumber()` | Auto-generate next invoice number | Uses FY from date + nextNumber |
| `getFY(dateStr)` | Financial year string (e.g. "2026-27") | April = new FY |
| `isMonthLocked(m)` | Check if a month is locked | Used to enforce read-only |

---

## Build Rules (from design spec)

1. Single-file HTML — no build tools
2. Token compliance mandatory — no raw px in CSS
3. Mobile-first — base CSS for phones, @media 700px for desktop
4. localStorage for all state
5. Pass-by-pass builds with review between
6. **Never use `text-overflow: ellipsis`** — wrap or abbreviate
7. `sepRound()` for all currency
8. `localDateStr()` for all dates
9. Never use `toISOString()`
10. `ff-mono` class for all JS-rendered numeric/currency values

---

## Session History

| Session | Version | Focus | Lines | Functions | Key Additions |
|---------|---------|-------|:-----:|:---------:|---------------|
| 1 | v1.0 | Token system + Skeleton | 1,340 | — | Design tokens, 5-tier cards, 6-tab shell |
| 2 | v1.1 | Data & Logic | 2,040 | — | Workers, attendance, wages, settings |
| 3 | v1.2 | Production flow | 2,842 | — | 3-period system, picker, confirm, FAB |
| 4 | v1.3 | Design polish | 2,884 | — | Type rebalance, weight ramp, WCAG fix |
| 5 | v1.4 | Functional gaps | 3,190 | 89 | Pay cards, piece entry, Sunday/holiday |
| 6 | v2.0 | Design + Invoice + Ops | 3,960 | 113 | Invoice module, CW advance, NaCN limit, design 4.5 |
| 7 | v2.1 | PWA + Payroll + Invoice Modal | 4,531 | 130 | PWA deploy, month-lock, printable pay, invoice form, attendance alerts |

---

## WCAG Contrast (verified Session 4, maintained through v2.1)

All text/semantic colours pass 4.5:1 on their surfaces (light + dark mode).

Key adjusted values:
- `--text-muted: #706e68` (was #9e9d97)
- `--accent: #b45a37` (was #d97757)
- `--attend: #177a36` (was #1a8a3e)
- `--danger: #c13e34` (was #d4483e)
- `--warning: #8a6b08` (was #a6800a)

---

## Operational Completeness Tracker

| Feature | Status | Notes |
|---------|:------:|-------|
| Worker roster (perm + CW) | ✅ | 10 perm + 11 CW, add/deactivate with date/reason |
| Attendance marking | ✅ | Present/Absent toggle, filter by type |
| Production attendance lock | ✅ | Lock → auto-assign → edit → confirm |
| 3-period model (M.OT/Std/E.OT) | ✅ | Enable/disable OT, per-period capacity |
| Sunday OT suppression | ✅ | "Add OT anyway" link instead of enable buttons |
| Capacity segmented controls | ✅ | Per area per period |
| Worker picker (bottom sheet) | ✅ | Perm/CW separated, conflict detection |
| Auto-pickling | ✅ | Dependent on parent area capacity |
| Extra cost calculation | ✅ | Shortfall × hours × ₹41.25 |
| Snack calculation | ✅ | Evening OT workers × ₹20 |
| Confirm → write attendance | ✅ | P/OT + otHours to cwAtt/peAtt |
| Perm snack audit log | ✅ | Appended on confirm |
| Piece/weight entry | ✅ | Accumulating log with timeline |
| Sunday auto-detect | ✅ | Day-of-week check |
| Holiday manual toggle | ✅ | FAB action, persists in prod log |
| CW weekly pay card | ✅ | Full calculation + mark paid + **print** |
| Perm monthly pay card | ✅ | Full calculation + advances + mark paid + **print** |
| Perm advance entry | ✅ | UI + deduction from monthly pay |
| CW advance entry | ✅ | UI + deduction from weekly pay |
| Invoice creation | ✅ | **Form-based modal** (was prompt chains) |
| Client master + rate cards | ✅ | GSTIN, state code, per-material rates |
| Invoice detail + payment tracking | ✅ | View, mark paid/partial |
| GST Register + CSV export | ✅ | Monthly view with summary, export for backend |
| Invoice config (Settings) | ✅ | Company, GSTIN, SAC, series, bank details |
| NaCN upper limit | ✅ | maxQty field with over-limit warning |
| Inactive worker deactivation | ✅ | Date, reason, reactivate button |
| Stock management | ✅ | 6 chemicals, threshold + max alerts, +/−/set |
| Dark mode | ✅ | Tokenized, WCAG AA compliant |
| Export/Import JSON | ✅ | Full backup/restore |
| FAB quick actions | ✅ | Mark All Present, Attendance, Production, Add Note, Toggle Holiday |
| Settings sidebar | ✅ | Workers, config, invoice settings, data management |
| **Month-close / lock** | ✅ | **NEW v2.1** — Lock after 28th, summary, read-only |
| **Printable salary breakup** | ✅ | **NEW v2.1** — CW + Perm print windows |
| **CW pay due-date alert** | ✅ | **NEW v2.1** — Thu/Fri warning, Sat overdue |
| **Attendance pattern alerts** | ✅ | **NEW v2.1** — 3+ consecutive or 3/7 days absent |
| **PWA (GitHub Pages)** | ✅ | **NEW v2.1** — Offline, installable, auto-deploy |

### Still Pending

| Feature | Priority | Notes |
|---------|----------|-------|
| Month-lock enforcement on edit | HIGH | Lock currently shows badge but doesn't block attendance/production edits |
| Editable past production days | MEDIUM | Date picker on Production tab |
| Monthly analytics dashboard | MEDIUM | Staffing efficiency %, area utilization, cost trends |
| CSV/Excel export (attendance/payroll) | MEDIUM | Monthly attendance and payroll export |
| Validation guards | MEDIUM | Duplicate invoice numbers, advance > wage warning, client deletion referential integrity |
| Bidirectional CW↔Production sync | LOW | Edit in CW tab reflects in production log |
| Invoice PDF generation | LOW | Formal invoice PDF for clients |
| Multi-month GST summary | LOW | Quarterly GST return data |
