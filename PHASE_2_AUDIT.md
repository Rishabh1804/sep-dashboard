# PHASE_2_AUDIT.md — v2.1 → Modular Split Map
**Aurelius — Session 12 prep · 28 April 2026**

---

## Scope

Read-only audit of `index.html` (4,972 lines) to identify module boundaries for the Phase 2 modularization charter (Session 8). No code is modified by this document. The split below maps every region of the current file to a target file in the 7-layer architecture.

The construction overlay (CSS lines 1015–1210, HTML lines 1215–1264, JS lines 4912–4967) is excluded from the Phase 2 build — it is a v2.1-only temporary banner and will be deleted, not migrated.

Line numbers reference `index.html` as it stands today.

---

## File Inventory Snapshot

| Region | Lines | Approx LOC | Target layer |
|---|---|---|---|
| `<style>` block | 16–1210 | 1,195 | CSS files (4) |
| Construction overlay HTML | 1215–1264 | 50 | DELETE in Phase 2 |
| App shell HTML (header, tabs, panels, FAB) | 1267–1724 | 458 | `index.html` template |
| `<script>` block | 1726–4969 | 3,243 | 7-layer JS modules |
| **Total** | | **4,946** | |

---

## CSS Split (lines 16–1210)

Per charter Decision 4: split into `tokens.css`, `base.css`, `components.css`, `responsive.css`. Charter-allotted budgets in parens.

### `src/css/tokens.css` (target ≤150 lines)

| v2.1 lines | What | Notes |
|---|---|---|
| 31–151 | `:root` design tokens (typography scale, font families, weights, letter-spacing, spacing scale, semantic spacing, radius, surfaces, text colors, semantic colors, shadows, layout) | Single source of truth. Must be loaded first. |
| 153–186 | `.dark` override block | Same token names, dark values. Stays adjacent to light tokens. |

**Audit notes:**
- All tokens are already named consistently (`--fs-*`, `--sp-*`, `--r-*`, etc.). No renames needed.
- Construction overlay introduces undefined tokens (`--radius-lg`, `--space-lg`, `--space-2xl`, `--space-md`, `--space-sm`, `--bg-muted`, `--transition`) with px fallbacks at lines 1035, 1047, 1056, 1065, 1073–1101 — these are dead names from a different design system. Drop with the overlay.

### `src/css/base.css` (target ≤200 lines)

| v2.1 lines | What |
|---|---|
| 22–29 | Reset (`*`, `html`, `body`, `button`, `input/select/textarea`) |
| 188–263 | Layout shell (`.app-header`, `.app-title`, `.app-date`, `.header-actions`, `.header-btn`, `.tab-bar`, `.tab-btn`, `.tab-content`, `.tab-panel`) |
| 265–299 | Section labels (`.section-label`, `.section-label-md`, `.section-label-lg`, `.section-zone`, `.section-zone-hero`) |
| 666–710 | Utilities (`.text-*`, `.ff-mono`, `.flex-between/center/wrap`, `.gap-*`, `.mt-*`, `.mb-*`, `.d-none`, `.area-count*`, `.chip-row`, `.period-area-card`) |

**Total estimated: ~190 lines.** Within budget.

### `src/css/components.css` (target ≤300 lines)

| v2.1 lines | What |
|---|---|
| 301–356 | Card tier system (`.card-hero` + 6 per-tab tints, `.card-action`, `.card-base`, `.card-daily`, `.card-info`) |
| 358–395 | Intra-card typography (`.card-title`, `.card-value`, `.card-value-xl`, `.card-label`, `.card-meta`) |
| 397–601 | Component patterns: `.badge*`, `.btn*`, `.nb`, `.stat-grid`/`.stat-pill*`, `.toggle-*`, `.input`, `.worker-row`/`.worker-*`, `.mark-btn`, `.card-group`, `.col-grid`, `.alert-banner`/`.alert-*` |
| 628–664 | Save indicator (`.save-dot`), empty state (`.empty-state*`) |
| 712–736 | Settings sidebar (`.settings-overlay`, `.settings-panel`, `.settings-body`, `.settings-row`) |
| 738–792 | FAB (`.fab-container`, `.fab-btn`, `.fab-menu`, `.fab-item*`) |
| 794–863 | Worker picker overlay (`.picker-overlay`, `.picker-sheet`, `.picker-header`, `.picker-body`, `.picker-section-label`, `.picker-worker`, `.picker-check`, `.picker-name`, `.picker-where`) |
| 865–906 | Confirm dialog (`.confirm-overlay`, `.confirm-dialog`, `.confirm-icon`, `.confirm-title`, `.confirm-desc`, `.confirm-breakdown`, `.confirm-btns`) |
| 908–928 | Production period cards (`.period-card`, `.period-header`, `.period-toggle-icon`, `.period-body`) |
| 930–976 | Invoice modal (`.inv-modal-overlay`, `.inv-modal`, `@keyframes slideUp`, `.inv-modal label/select/input`, `.inv-line-item`, `.inv-line-remove`, `.inv-tax-preview`) |
| 978–984 | Month lock badge (`.lock-badge`) |

**Total estimated: ~310 lines.** Slightly over the 300-line budget. Recommend splitting `inv-modal` block (~46 lines) into a sibling `components-invoice.css` if budget is hard, or accept ~310 as practical given component count.

### `src/css/responsive.css` (target ≤150 lines)

| v2.1 lines | What |
|---|---|
| 603–626 | `@media (max-width: 400px)` small-phone fixes; `@media (min-width: 700px)` desktop enhancement |
| 941–944 | Invoice modal desktop centering breakpoint |
| 986–1013 | `@media print` styles + `.print-header`/`.print-footer` defaults |

**Total estimated: ~70 lines.** Comfortably under budget.

### CSS-level audit findings

- **Inline-style violation, line 2538, 2544, 2615, 2968, 3146 (et al):** several render functions emit `style="..."` inline (e.g. `style="color:var(--text-muted);font-size:var(--fs-2xs)"`, `style="margin-left:auto;color:var(--danger)"`). These violate the global rule "no inline styles." Capture during the JS migration as components, not CSS. Add to fix backlog.
- **Per-tab card-hero tints (lines 316–322)** are coupled to tab IDs (`#tab-home .card-hero`). When tabs become components, decide whether to keep ID-scoped CSS or move to a `data-tab="home"` attribute selector. Recommend: keep IDs for CSS, since tab IDs are stable.
- **Construction overlay tokens** (`--radius-lg`, `--space-*`, `--bg-muted`, `--transition`) reference undefined variables — they only render via px fallbacks. Confirms the overlay was not built with the same token system. Delete with overlay.

---

## JS Split (lines 1733–4909)

Per charter Decision 5: 7-layer architecture. Each layer imports only from layers below.

### Layer 1 — Utilities (`src/js/utils/`)

Zero dependencies. Pure functions only.

| Module | v2.1 lines | Functions |
|---|---|---|
| `utils/currency.js` | 1737 | `sepRound` |
| `utils/date.js` | 1739–1767 | `localDateStr`, `formatDate`, `formatDateShort`, `tnow`, `isSunday`, `getWeekEnd` |
| `utils/format.js` | 1752, 1754 | `formatCurrency`, `esc` (alias `escHtml` per global standards) |
| `utils/month.js` | 4413, 4284–4292 | `monthOf`, `monthDates` |
| `utils/csv.js` | 4272–4280 | `csvCell`, `csvDownload` |
| `utils/calc-prod.js` | 2440–2505, 2861–2872 | `getReq`, `recalcExtra`, `initProdDay` (pure given areas/cfg/prod) |

**Audit notes:**
- `esc` should be renamed `escHtml` to match the global Universal Code Standards rule.
- `getReq` and `recalcExtra` currently call `getAreas()` internally — must be refactored to take `areas` as a parameter to keep them pure (Layer 1 cannot depend on Layer 2 storage).
- `initProdDay` is already pure.

### Layer 2 — Storage (`src/js/storage/`)

| Module | v2.1 lines | Exports |
|---|---|---|
| `storage/storage.js` | 1891–1901 | `loadJSON`, `saveJSON` (the single read/write boundary; future Firebase-sync hook lives here per Session 11 charter) |
| `storage/keys.js` | 1773–1803 | `K` (storage key registry) |
| `storage/state.js` | 1959–1966 | `getState()`, `setState()` accessors over the `STATE` singleton (per cross-cutting finding 4 — Architect-locked decision). All tabs and components import these from Layer 2; nothing else exports mutable state. |

**Audit notes:**
- `saveJSON` calls `showSaveDot()` (line 1899) — that's a UI side-effect bleeding into Layer 2. Refactor to emit a `data:saved` event via `pubsub` and let a Layer 4 component subscribe.
- Per Session 11, the storage wrapper is the integration seam for the future Firebase trajectory. Design the API now: `load(key, default)`, `save(key, data)`, `subscribe(key, cb)` — synchronous facade today, async-capable later.

### Layer 3 — Config (`src/js/config/`)

Static defaults. No imports.

| Module | v2.1 lines | Exports |
|---|---|---|
| `config/workers.js` | 1809–1834 | `DEF_PERM`, `DEF_CW` |
| `config/areas.js` | 1836–1850 | `DEF_AREAS` |
| `config/wage.js` | 1852–1863 | `DEF_CFG` (hour rate, snack rate, OT multipliers, shift schedules, guard/excluded IDs) |
| `config/stock.js` | 1865–1872 | `DEF_STOCK` |
| `config/invoice.js` | 1874–1885 | `DEF_INV_CFG` |

**Audit note:** `APP_VERSION` (line 4899) belongs here too — `config/version.js` or fold into a `config/app.js`.

### Layer 4 — Components (`src/js/components/`)

Reusable UI fragments with their own DOM lifecycle.

| Module | v2.1 lines | Notes |
|---|---|---|
| `components/save-dot.js` | 1972–1980 | Subscribes to `data:saved` event |
| `components/dark-mode.js` | 1986–1995 | `toggleDarkMode`, `initDarkMode` |
| `components/fab.js` | 3750–3827 | `toggleFab`, `closeFab`, `fabAction` (action dispatch table; the actual handlers — `markAllPresent`, `addProdNote`, `toggleHoliday` — live in their respective tabs and are wired via pubsub or direct import from Layer 5) |
| `components/worker-picker.js` | 2658–2739 | `openPicker`, `togglePickerWorker`, `closePicker` (currently uses `STATE.pickerPeriod`/`STATE.pickerArea` globals — refactor to parameters) |
| `components/confirm-dialog.js` | 2742–2789 | `showProdConfirm`, `cancelConfirm` (generalize to a generic confirm component; production-confirm becomes one caller) |
| `components/invoice-form.js` | 4648–4880 | `openInvoiceModal`, `closeInvModal`, `addInvLine`, `onInvClientChange`, `updateRateDropdown`, `onRateSelect`, `recalcInvPreview`, `submitInvoiceForm` |
| `components/invoice-detail.js` | 4134–4241 | `viewInvoice`, `closeInvDetail`, `markInvPaid`, `markInvPartial` |
| `components/settings-panel.js` | 3550–3744 | `openSettings`, `closeSettings`, `addWorkerPrompt`, `toggleWorkerActive`, `getStorageUsed`, `exportData`, `importData` |
| `components/print-pay.js` | 4529–4572 | `printCWPay`, `printPermPay` (opens a child window — keep isolated) |
| `components/alerts.js` | 4578–4642 | `getCWPayDueAlerts`, `getAttendancePatternAlerts` (pure HTML-string producers, but tied to alert-banner styling — Layer 4) |
| `components/cards.js` | (no v2.1 source) | NEW: extract repeated card-render templates from inline tab code (`worker-row`, `pay-row`, `period-area-card`) |

**Audit note — global-handler problem:** the v2.1 file uses `onclick="functionName()"` extensively (header buttons line 1278/1283, FAB line 1719, picker close 2701, settings close 3564, invoice modal close 4661, every action button across tabs). All these depend on the function being on `window`. In modular form, refactor to event delegation per Universal Code Standards rule "no inline handlers — all events via `data-action`." This is a substantial mechanical refactor (~80 inline handlers) but unavoidable for the layer boundary to hold.

### Layer 5 — Tabs (`src/js/tabs/`)

One file per tab panel. Each consumes Layers 1–4.

| Module | v2.1 lines | Notes |
|---|---|---|
| `tabs/home.js` | 2054–2136 | `renderHome`, `renderHomeAlerts` |
| `tabs/attendance.js` | 2142–2242 | `renderAttendance`, `markAtt`, attendance-filter listener |
| `tabs/production.js` | 2248–2925 | Largest module: `renderProduction`, `renderProdAttendance`, `lockProdAtt`, `unlockProdAtt`, `autoAssignRosters`, `autoPickling`, `renderProdPeriods`, `togglePeriod`, `setProdCap2`, `confirmProduction`, `renderProdLog`, `logProdEntry`, holiday/shift helpers (`isTodayHoliday`, `isShiftSunday`, `toggleHoliday`, `renderShiftBanner`). Also entry point for production-tab data access — wraps storage helpers `getAreas`, `getCfg`, `getProdLogs`, `getProdDay`, `saveProdDay` (currently lines 1928–1946) which should themselves move to `storage/production.js` so this tab stays presentation-focused. |
| `tabs/finance.js` | 2976–3345, 4426–4523 | `calcDayWages`, `calcMonthWages`, `calcCWWeeklyPay`, `calcPermMonthlyPay`, `renderFinance`, `renderCWPayCard`, `recordCWAdvance`, `markCWPaid`, `renderPermPayCard`, `recordAdvance`, `markPermPaid`. Also the month-close UI block: `renderMonthLock`, `lockMonth`, `unlockMonth`. The pure pay calculations belong in a `payroll/` sub-module (could be promoted to Layer 1 utilities since they're domain-pure once given attendance/cfg/advances). |
| `tabs/invoice.js` | 3833–4131, 4244–4264 | `renderInvoice`, `renderInvList`, `renderClientList`, `renderGSTRegister`, `shiftGSTMonth`, client/rate CRUD prompts (`addClient`, `editClient`, `editClientRates`, `editInvConfig`), `exportGSTRegister`. Sub-tab nav listener at 3862. |
| `tabs/stock.js` | 3351–3437 | `renderStock`, `updateStock`, `editStockQty` |
| `tabs/history.js` | 3443–3544 | `renderHistory`, prev/next nav listeners |
| `tabs/finance-export.js` | 4294–4399 | `exportAttendanceCSV`, `exportPayrollCSV`, `exportCostsCSV` (could fold into `tabs/finance.js` if small, or split for clarity) |

**Audit notes:**
- `tabs/production.js` is by far the heaviest (~675 lines). After moving worker-picker, confirm-dialog, calc utilities, and storage helpers out, the remainder is a manageable ~400 lines of view + write logic.
- `tabs/finance.js` similarly mixes pure payroll calc with view code. The four `calc*` functions (~140 lines, lines 2976–3115) are domain-pure given attendance + cfg + advances — promote to `utils/payroll.js` (Layer 1) so they're testable in isolation. This is also where Jest unit tests get the highest leverage per charter Decision 2.
- Month-lock helpers (`getMonthLocks`, `isMonthLocked`, `requireUnlocked`, lines 4405–4424) are cross-cutting (used by attendance, production, finance). They belong in `utils/lock.js` (Layer 1) or `storage/lock.js` (Layer 2), not inside `tabs/finance.js`.

### Layer 6 — Viz (`src/js/viz/`)

Empty for Phase 2.0-alpha. Per the Session 11 charter pivot, this layer becomes Konva.js (interactive floor map) + p5.js (analytics art). Scaffold a placeholder so the directory exists and the import boundary is testable, but no source migrates from v2.1 — the v2.1 dashboard has no viz code today.

### Layer 7 — App shell (`src/js/app.js`)

Single orchestrator file.

| Module | v2.1 lines | Notes |
|---|---|---|
| `app.js` | 1997–2048, 4886–4909 | `TAB_ORDER`, `switchTab`, swipe handlers, `renderTab` dispatch, `initData`, `init`, `APP_VERSION`, service-worker registration, `DOMContentLoaded` boot. **Note:** `STATE` itself moves to `storage/state.js` (Layer 2) per cross-cutting finding 4. |

**Audit note:** Swipe handlers (2022–2032) and tab-bar click delegate (2015–2018) belong in `app.js` because they own tab routing.

### Pubsub (`src/js/pubsub.js`, ~15 lines per charter)

Used to break two upward dependencies:
1. `storage/storage.js` emits `data:saved` → `components/save-dot.js` listens.
2. Cross-tab refresh: e.g. `markAtt` in attendance tab triggers a re-render in home tab. Currently done with `if(STATE.currentTab==='home') renderHome()` peppered through writers (lines 2231, 2858, 3417). Replace with `pubsub.emit('attendance:changed')` and `pubsub.emit('production:changed')`.

---

## HTML Split

The v2.1 single-file root contains static markup that becomes the build entry point.

### `src/index.html` (template shell)

| v2.1 lines | What |
|---|---|
| 1–14 | `<head>`: meta, manifest, font preconnect/link |
| 1267–1289 | `<header class="app-header">` |
| 1291–1299 | `<nav class="tab-bar">` (7 buttons) |
| 1301–1693 | `<main class="tab-content">` containing 7 `<div class="tab-panel">` blocks. Each panel has a static skeleton — hero card + section labels + placeholder children — that the corresponding tab module fills in via `renderXxx()`. |
| 1695–1724 | `<div class="fab-container">` |
| Body close + `<script src="dist/bundle.js">` |

**Static vs dynamic markup audit:**
- Home tab (1308–1364): hero numbers and stat pills are placeholders (`—`); alerts container is empty. All filled by `renderHome`/`renderHomeAlerts`.
- Attendance tab (1367–1409): hero summary placeholders, `#workerList` filled by `renderAttendance`.
- Production tab (1412–1472): hero placeholders, `#prodAttSection`, `#prodPeriodsContainer`, `#prodLog` all dynamically rendered.
- Finance tab (1475–1553): hero/stat-pill placeholders, `#finCWCard`, `#finPermCard`, `#finMonthLock` dynamically rendered. Export buttons static with `onclick`.
- Invoice tab (1556–1592): sub-nav static, `#invSubPanel` dynamic, "+ New Invoice" button static.
- Stock tab (1595–1650): contains a stale hard-coded sample of three items (`Zinc Anodes`, `Growel 1728`, `Sodium Cyanide`) that are immediately overwritten by `renderStock`. Drop these placeholders in the modular template — they're misleading dev artifacts.
- History tab (1653–1691): hero placeholder, prev/next buttons static, `#histData` dynamic.
- FAB (1696–1724): fully static; menu items use inline `onclick="fabAction(...)"` — refactor to `data-action`.

**Recommendation:** Each tab panel's static skeleton becomes a small per-tab template fragment co-located with its module (`tabs/home.html` next to `tabs/home.js`), assembled at build time by an esbuild plugin or a tiny pre-step. Alternative: keep all static markup in one root `index.html` (current pattern), and have tab modules query their root by ID. Recommend the second — simpler, matches charter Decision 1 "single HTML entry point."

### Construction overlay (lines 1215–1264) — DELETE

Remove from Phase 2 entirely. It's a v2.1-only banner per Session 10 docs and the corresponding JS lives at 4912–4967.

---

## Cross-Cutting Audit Findings

These don't fit a single layer but block clean migration:

1. **`window`-attached handlers.** ~80 inline `onclick="..."` handlers across HTML and JS-emitted templates. The Universal Code Standards rule is `no inline handlers — all events via data-action`. Mechanical refactor: replace each `onclick="fn(args)"` with `data-action="fn"` + serialized args, then a single delegated listener per tab dispatches via a function map. This is the largest single chunk of mechanical work in Phase 2.

2. **Inline `style="..."` attributes.** Visible at lines 1455 (`style="display:none"`), 2538/2544/2615/2968 (period card colors), 3146 (OT cost), 3210/3215 (button width), 3289 (border separators), 3294 (pay rows), 3311+ (advance flags), settings-panel header (3562), invoice-modal headers, plus several inline-style attributes inside HTML literals in tab-render functions. Each violates "no inline styles." Convert to CSS classes during the JS migration — track in a fix backlog.

3. **`alert()`/`prompt()`/`confirm()` modals.** Used throughout settings (3659–3700), invoice CRUD (4046–4108), advance recording (3224–3250, 3307–3345), confirm flows. Phase 2 may keep these for v2.0-alpha (charter doesn't demand replacement), but flag for the eventual UX pass — a custom modal component already exists in `confirm-dialog`. Out of scope for the migration itself.

4. **`STATE` reads/writes across files — RESOLVED (Architect, 28 Apr 2026).** `STATE.today`, `STATE.currentTab`, `STATE.attFilter`, `STATE.histDate`, `STATE.darkMode`, `STATE.invTab`, `STATE.invMonth`, `STATE.pickerPeriod`, `STATE.pickerArea` are mutated from multiple modules. **Decision: STATE lives in Layer 2 as a singleton exposed via `getState()` / `setState()` accessors** (`storage/state.js`). Modules import the accessors from Layer 2 (below them); the layer rule stays pure (no carve-out, no slippery slope), no mutable exports leak out, and no pubsub overhead. This composes with the future Firebase migration — `getState()`/`setState()` becomes the seam where the storage backend swaps out without callers changing. Rejected alternatives: (a) Layer 7 carve-out — weakens the rule. (b) Full pubsub — every read becomes a subscription, adds reactive overhead and debugging surface for not-much-gain at this scale.

5. **Storage-helper colocation.** Functions like `getPermWorkers`, `getCWWorkers`, `getActivePermProd`, `getActiveCW`, `getAllProdWorkers`, `findWorker` (1903–1915), `getAreas`, `getCfg`, `getProdLogs`, `getProdDay`, `saveProdDay` (1928–1946), `getStock`, `getStockLog` (1949–1950), `getSettings` (1953), `getMonthLocks`, `isMonthLocked` (4405–4410), `getClients`, `getRates`, `getInvoices`, `getInvCfg`, `getClientRates` (3838–3859), `getFY`, `genInvNumber` (3843–3855) are a thin domain layer between Layer 2 (raw `loadJSON`/`saveJSON`) and Layer 5 (tabs). Recommend a `storage/` sub-folder splitting by domain: `storage/workers.js`, `storage/attendance.js`, `storage/production.js`, `storage/stock.js`, `storage/invoice.js`, `storage/lock.js`, `storage/settings.js`. These are still Layer 2 — they only depend on `storage.js` + `keys.js` + Layer 3 defaults.

6. **Test surface for charter Decision 2 (Jest).** Highest-leverage pure functions to write tests for first:
   - `utils/currency.sepRound` — trivial but foundational
   - `utils/date.*` — timezone-safety regressions are the prior pain point
   - `utils/csv.csvCell` — escaping correctness
   - `utils/payroll.calcCWWeeklyPay`, `calcPermMonthlyPay`, `calcDayWages`, `calcMonthWages` — load-bearing financial math
   - `utils/calc-prod.getReq`, `recalcExtra`, `initProdDay` — once refactored to be parameter-pure
   - `utils/lock.isMonthLocked`, `monthOf` — gating logic for write paths
   The Playwright E2E set (charter: 2–3 tests) should cover: (a) mark a worker present → home count updates; (b) lock production → confirm → attendance store written; (c) create invoice → appears in GST register.

---

## Recommended Migration Order (Session 9+)

1. Pull tokens to `tokens.css`. Verify visual parity by loading existing v2.1 with the new tokens file (drop-in test).
2. Pull base + components + responsive CSS. Verify visual parity again.
3. Stand up esbuild + npm scaffold. Empty `app.js` boots; HTML loads bundle.
4. Migrate Layer 1 utilities. Stand up Jest. Write the high-leverage tests above.
5. Migrate Layer 2 storage (with the domain splits).
6. Migrate Layer 3 config.
7. Migrate Layer 4 components (FAB, settings, dark mode, save dot — the small ones first).
8. Migrate Layer 5 tabs one at a time, starting with the smallest (Stock or History) to validate the pattern, then Home, Attendance, Finance, Invoice, Production last.
9. Wire pubsub for cross-tab refresh; remove the explicit `if(STATE.currentTab==='home') renderHome()` peppering.
10. Refactor inline `onclick`/`style` as each tab is touched.
11. Delete the construction overlay HTML/CSS/JS at the end (or keep until Phase 2.0-alpha is on GitHub Pages, then remove).
12. Add the Playwright happy-path tests.

Estimated session count for the full migration: **3–5 sessions** (matches charter "Session 9 opens with v2.1 code audit and modularization" + 2–4 follow-ups for the long tabs).

---

## Charter Tightening — Architect Decisions (28 Apr 2026)

Resolved before Session 13 push:

| Item | Decision | Notes |
|---|---|---|
| Inline `onclick` handlers (~80) | **Accept mechanical refactor** — swap to `addEventListener` / delegated `data-action`. No architectural change; just budget the time during tab migration. |
| `STATE` mutable global | **Option (c): STATE lives in Layer 2 as a singleton with `getState()` / `setState()` accessors** (`storage/state.js`). Modules import from below; layer rule stays pure; composes with future Firebase migration as the storage-backend swap seam. Rejected (a) Layer 7 carve-out (slippery slope) and (b) full pubsub (reactive overhead, not worth at this scale). |
| Construction overlay (~370 lines: CSS 1015–1210, HTML 1215–1264, JS 4912–4967) | **Delete entirely.** Phase 2 IS the rollout; the overlay was a v2.1 stopgap. Saves ~370 lines cleanly. |
| Payroll calcs in `tabs/finance.js` | **Promote to `utils/payroll.js` (Layer 1).** Pure functions belong in Layer 1; high-leverage Jest target. |

## Remaining Open Questions

- **Per-tab template fragments vs single root HTML?** Recommendation: single root, keep current pattern. Decide before tab migration.
- **Konva floor-map scaffold in Phase 2.0-alpha or defer to Phase 2.1?** Charter Decision pre-Session 11 said p5.js viz alongside the migration; Session 11 pivoted to Konva-first. Recommend deferring all viz to a post-migration phase so the modularization itself is unblocked. The empty `viz/` directory is enough scaffold for now.

---

*Documented 28 April 2026 by Aurelius — Phase 2 module audit. No code modified.*
*Updated 28 April 2026 — Charter tightening decisions locked by The Architect before Session 13.*
