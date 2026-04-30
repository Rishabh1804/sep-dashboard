# Session 13 — Kickoff: Phase 2.0 Implementation

**Phase:** Phase 2.0 home view alpha
**Target deploy:** 10 May 2026
**Tool:** Claude Code (per Tools & Workflow boundary in `CLAUDE.md`)
**Source design lock:** [`docs/SESSION_12_DESIGN_LOCK.md`](docs/SESSION_12_DESIGN_LOCK.md) — read before starting

---

## Objective

Build the Phase 2.0-alpha skeleton: working modular bundle, floor view rendering with Konva, basic interaction (hover/click/right-click + panel), Standard overlay only, handler app skeleton, Firebase sync wired, job slip print. Ship a functional simulator the operator can use day-one; polish ships in 2.1+.

This is the **MVP slice** defined in §9 of the design lock. Anything not in the "Ships in 2.0" list is out of scope for this session.

---

## Prerequisites

Before starting:

1. **Read** in this order:
   - `CLAUDE.md` (full project history; Sessions 8, 10, 11, 12 are most relevant)
   - `docs/SESSION_12_DESIGN_LOCK.md` (the source of truth for everything design-related)
   - `PHASE_2_AUDIT.md` (v2.1 module-boundary findings; informs Stage A)
2. **Verify auth** — Claude Code must be on Claude account / subscription, NOT API key. Confirm via top bar reads "subscription plan name" not "API Usage Billing." See CLAUDE.md auth notes if conflict.
3. **Confirm** `docs/floor-plan.png` exists — Stage B coordinate extraction depends on it. If not present, request from user before starting Stage B.
4. **Set model** — `/model` to Sonnet 4.6 (Opus is overkill for refactor/modularization work).

---

## Implementation Order

Each stage estimates active time only. Total: ~22h, padded for testing/debugging gives ~30h. May 10 deadline is 12 days out from Session 12 close — comfortable margin if cadence holds.

### Stage A — Repo modularization (~6h)

Objective: convert v2.1 single-file `index.html` (4,972 lines) into the 7-layer modular structure ratified in Session 8 charter, with the audit resolutions from Session 11 applied.

1. **Extract CSS** from inline `<style>` in index.html into:
   - `src/css/tokens.css` (~150 lines — colors, spacing, timing)
   - `src/css/base.css` (~200 lines — reset, typography, layout)
   - `src/css/components.css` (~300 lines — cards, buttons, modals)
   - `src/css/responsive.css` (~150 lines — mobile-first @media queries)
2. **Split JS** into 7-layer `src/js/` structure:
   - Layer 1: `utils/` — currency, date, validation, **payroll** (per audit recommendation)
   - Layer 2: `storage/` — localStorage abstraction with `getState()` / `setState()` accessors (per audit Blocker 2 resolution, option C)
   - Layer 3: `config/` — defaults, worker roster, **rooms** (floor plan coordinates)
   - Layer 4: `components/` — PayCard, WorkerPicker, InvoiceForm, etc.
   - Layer 5: `tabs/` — home (NEW Konva floor view), attendance, production, finance, invoice, stock, history
   - Layer 6: `viz/` — Konva floor renderer, p5.js placeholder for analytics tab
   - Layer 7: `app.js` — orchestrator
   - Plus `pubsub.js` (~15 lines) for cross-tab events
3. **Replace ~80 inline onclick handlers** with `addEventListener` or delegated `data-action` listeners (per audit Blocker 1)
4. **Delete construction overlay** (~370 lines — per audit Blocker 3 resolution)
5. **esbuild config** (~30 lines, target ~50ms rebuilds)
6. **npm scripts:** `build`, `dev`, `test`
7. **Jest setup** for unit testing `utils/` (pure functions; sub-100ms)

**Acceptance:** v2.1 functionality preserved end-to-end (run a smoke test of every tab); enforce layer rule via lint or build check (reverse imports fail); CSS uses tokens (no raw px).

### Stage B — Floor view foundation (~5h)

Objective: render the top-down literal floor with all entity classes static (no interactions yet). Use the universal color convention (green/orange/red base + state decorators) per Design Lock §3.3.

1. **Konva integration** — install via npm (not CDN per Phase 2 architecture); set up Stage > Layer > Group hierarchy
2. **Render rooms** from `src/config/rooms.js` — coordinates extracted from `docs/floor-plan.png` by manual measurement; rooms as labeled rounded rectangles
3. **Render machines** as fixed children inside rooms — full expanded vocabulary per Design Lock §3.2:
   - **VAT Room 1** (known layout): 4 plating tanks (T1–T4, single-line each, T2 dysfunctional → red), 3 staging tanks (ST1–ST3, capacity-state), 2 passivation tanks (PT1–PT2), 1 drum/passivation rinse dip (D), internal dotted pathways, doors as dashed boxes. Workforce: 5 specialized (3 plating + 2 passivation)
   - **VAT Room 2** (known layout): 1 large plating bath subdivided into 2 jigging lines → modeled as **2 Machine entities sharing chemistry via `shared_bath_with`** (call them Tank 5 and Tank 6 per user vocab); 1 staging tank (ST), 2 passivation tanks (PT upper + PT lower), 1 drum/rinse dip (D), 1 additional Rinse Dip Tank (RDT — second post-passivation rinse stage); single bottom-right door. Workforce: 4 combined-operators (each does hanging + passivation across the room)
   - **Barrel Room** and **Acid Pickling Area 4** — render as labeled boxes initially (per-room interior layouts pending — see Design Lock §11). Refine in 2.0.x patches as layouts arrive
   - **Shared exterior Dryer** — render as a single Machine entity in the right-side empty zone (next to Acid Pickling), with `shared_resource: true`. Accessible from any room; primarily used by Barrel material, occasionally by VAT material. No dedicated worker
   - Use `Machine.state_kind` to choose render mode: process-state (status colors + decorators) vs capacity-state (fill-level overlay over green base)
4. **Render workers** as monogrammed dots placed via `Worker.role_in_room` + `Room.staffing_complement` defaults
5. **Render job badges** with progress ring (use sample/seed data; WPP-derived denominator with dotted-when-uncalibrated comes in Stage C with the storage layer)
6. **Render perimeter loop** as a single continuous polyline / polygon with color-coded maintenance segments (universal palette); loop has visible width — multiple animation tracks possible (Stage C)
7. **Render Inspection Station** at primary location (outside VAT Room 2, in pathway next to its FG strip) as a small circle representing the upturned drum
8. **Render exterior infrastructure** — rectifiers (one per area, exterior to rooms), Finished Goods strips (per-room exterior), gates with directional flow labels (Back Gate = material in, Main Gate = material out + stock in), defunct rooms (raw chemistry storage, drawn passive), redevelopment markers (green/red crosses passive)

**Acceptance:** floor view renders correctly at desktop (1920×1080) and tablet (1024×768); spatial layout matches floor plan PNG; universal color convention applied (green/orange/red base + state decorators); perimeter loop renders as one continuous segmented polyline; T2 dysfunctional reads red from default zoom without drilling.

### Stage C — Interaction & panel (~3h)

1. **Hover tooltips** per entity (machine name + state, job ID + customer + %, worker name + room)
2. **Click → side panel** — right-edge slide-in (~360px desktop), bottom sheet (~70vh mobile)
3. **Drill-down navigation** within panel with breadcrumbs (room → machine → job → worker)
4. **Panel ↔ floor reciprocity** — selecting in panel highlights/centers on floor
5. **Right-click → quick action popover** with per-entity vocabulary from Design Lock §4.2 (note: "add note" action is schema-ready in 2.0; full UI for note popover is 2.1)
6. **Inline forms** within panel for edits (production entry, mark dispatched, log refill)
7. **Perimeter-loop animation** — when a job changes stations, badge tweens along the loop polyline over ~2s; counterclockwise default for material flow (workers move freely both ways); reworks animate with amber trail; calm-mode toggle suppresses
8. **Animation lane staggering** — concurrent badge animations are visually offset (slight Y-jitter or time-staggered) so multiple traveling badges don't collide on the same rendered line; the loop is one physical lane but the rendering accommodates concurrent visual tracks
9. **Per-station loitering indicator** — micro-clock decorator on badge when current-station-elapsed exceeds typical-station-time × 1.5; cheap derived calculation from current state + ProductionEntry timestamps

**Acceptance:** at least one path through receive job → move to plating → mark ready → dispatch works end-to-end via interaction layer; right-click action set works for machines, workers, jobs, stock; calm mode visibly suppresses animation; multiple concurrent corridor animations don't visually collide; loitering micro-clock surfaces on a deliberately-stalled test job.

### Stage D — HUD chrome (~2h)

1. **Top bar** (~48px) — clock, shift indicator (compute from current time), search input, calm-mode toggle, hamburger
2. **Right rail Attention Stack** (~140px) — categorized scrollable list: top priority jobs + critical stock + machine alarms
3. **Collapsed left rail** — hamburger expands to filter toggles + layer switches
4. **Bottom chip** — small headline counts, click to expand
5. **Standard overlay** rendering (default; no mode picker yet — Priority/Quality overlays are 2.1)
6. **Hotkey set** — F, P, S, O, Esc, arrows, +/-, Space (1-4 keys are 2.1 overlay shortcuts)

**Acceptance:** chrome is visible but the floor still commands ~85% of screen real estate; alarms surface in Attention Stack; hotkeys work without modifier keys conflicting with browser defaults.

### Stage E — Print artifact (~1h)

1. **Job slip print-CSS template** matching Design Lock §7.1 layout (A5 portrait)
2. **Print button** on job panel
3. **QR code generation** via `qrcode.js` or similar lightweight library
4. **Tier-1 colored header strip** rendered conditionally
5. **Tested via browser print preview** — verify layout at A5 print size

**Acceptance:** print preview shows correct layout including QR; tier-1 jobs show colored strip; default-tier jobs omit it; reprint works for any historic job.

### Stage F — Handler app skeleton (~2h)

⚠ **Blocking pre-req:** the *Notebook handler app architecture* session (banked in Design Lock §11) should run before this stage hardens. Final decisions on subpath vs separate deploy, Firebase rules, conflict resolution, and schema migration should land first. Stage F can begin in skeleton form (forms + storage layer wiring), but production-ready handler app waits on the architecture session.

1. **Second esbuild entry point** (`src/handler/main.js`) producing a separate bundle; no Konva/p5
2. **Minimal forms:** job receipt (customer + item + received_kg) and production entry (job + machine + qty)
3. **Same storage layer** (Layer 2) — handler writes go through identical `setState()` accessors as dashboard
4. **Phone-optimized UI** — large tap targets, minimal chrome, offline indicator
5. **Service worker for PWA install on phone**

**Acceptance:** handler app loads on phone, can submit a production entry, entry appears in dashboard within 5 seconds via Firebase sync (Stage G dependency).

### Stage G — Firebase sync wiring + invoicing integration scaffolding (~3h)

1. **Firebase Firestore SDK** — lazy-loaded (defer until storage layer needs it)
2. **Storage layer routes through Firestore** when online; localStorage fallback for offline-first
3. **Real-time listeners** — dashboard subscribes to job/machine/stock/notes/dispatch_events collections; UI re-renders on change
4. **Audit log** — append-only `audit_events` collection; every write generates an event
5. **Daily GitHub export script** — Cloud Function or scheduled task that snapshots Firestore → JSON → commits to GitHub repo
6. **Firebase security rules** — handler can write `production_entries`, `jobs`, `dft_measurements`; dashboard writes everything; no client can write `audit_events` directly (server-side only)
7. **Sep-invoicing integration scaffolding** (per Design Lock §6.1):
   - `DispatchEvent` schema in Firestore with `invoice_status` enum
   - On dispatch in dashboard: create `DispatchEvent` with `invoice_status: 'pending-check'` (manual link via panel in 2.0; automatic check-and-link is 2.1 work)
   - Panel surface for manual `invoice_id` entry on dispatch event
   - Resilience principle: invoicing failure must NOT block dispatch flow (and vice versa)

**Acceptance:** entry from handler appears in dashboard within 5s; offline writes queue and sync when reconnected; audit events recorded for every write; daily export job runs successfully and commits; dispatch creates `DispatchEvent` record with placeholder for manual invoice link.

### Stage H — Deploy alpha (~1h)

1. **Update or remove construction overlay copy** — overlay is deleted in Stage A; if any redirect-to-overlay logic remains in `index.html`, remove it
2. **Update PWA manifest** — confirm icons, name, scope point to Phase 2.0
3. **GitHub Pages deploy** — push to main; verify live at `rishabh1804.github.io/sep-dashboard/`
4. **Manual smoke test** end-to-end on desktop + phone (handler app at subpath)
5. **Rollback plan** — if alpha is broken, revert to v2.1 commit (`524769c` per Session 10) is one git command

**Acceptance:** Phase 2.0 alpha live; basic flows working; v2.1 data carried over correctly (no migration; same localStorage keys); both PWAs installable.

---

## Acceptance Criteria for Phase 2.0-Alpha

Hard requirements before Session 13 closes:

- [ ] All v2.1 functionality preserved (full data compat per Session 8 charter)
- [ ] Floor view renders all rooms, expanded machine vocabulary (plating, staging, passivation, rinse dip, dryer, inspection station), sample jobs at correct positions
- [ ] Universal color convention applied (green/orange/red base + state decorators per Design Lock §3.3); T2 dysfunctional reads red from default zoom
- [ ] Perimeter loop renders as one continuous polyline with maintenance-state segments; redevelopment markers (crosses) render passively
- [ ] Hover / click / right-click all functional with per-entity vocabulary
- [ ] At least one path works end-to-end: receive job → pickling → plating → passivation → FG drying → inspection → ready → dispatched (with `DispatchEvent` created)
- [ ] Multi-location bottleneck pile-ups visible (badges stack at pathway, dip tanks, staging, FG when downstream is constrained)
- [ ] Per-station loitering micro-clock surfaces on stalled jobs
- [ ] Concurrent corridor animations don't visually collide (lane-staggering works)
- [ ] Job slip prints with all locked fields (header, route, stamps, tier-1 strip when applicable)
- [ ] Handler app loads on phone, submits a production entry
- [ ] Firebase syncs an entry from handler → dashboard within 5 seconds
- [ ] Hotkey set works (F, P, S, O, Esc, arrows, ±, Space)
- [ ] Color-blind redundant encoding present on every color signal (icons, hatch, border patterns)
- [ ] Empty states + sync-error banner implemented
- [ ] Audit events recorded for every write
- [ ] Mood / health / note schema fields exist (rendering deferred to 2.1)
- [ ] No raw px in CSS (token compliance)
- [ ] Unit tests pass for `utils/`
- [ ] Construction overlay removed
- [ ] Bundle sizes within budget (dashboard <800KB compressed, handler <200KB compressed)

---

## Deferred from Phase 2.0 (per Design Lock §9)

**Saved for 2.1:** Priority overlay, Quality overlay, Productivity sparklines in panels, milestone toasts, quality certificate generation, mobile status feed (separate surface), broader search (workers/machines/stock).

**Saved for 2.2+:** Productivity overlay (needs ≥2 weeks of data), Stock-criticality overlay, multi-zoom map, time-travel/replay, customer portal, worker activity overlay (post-cameras), anomaly flagging analytics, print artifacts polish (letterhead branding when supplied).

If during Stage A–H any deferred item is found to be cheap to include opportunistically, fine — but don't pull forward at the cost of MVP stability.

---

## Banked Side Sessions

| Session | Why blocking-or-not | When |
|---|---|---|
| **Notebook handler app architecture** | Should land before Stage F finalizes (full design pass: subpath vs separate, Firebase rules, conflict resolution, schema migration) | Cowork, before Stage F |
| **Camera placement & type** | Unlocks worker location tracking (`Worker.current_location` real-time); also benefits theft/safety/quality dispute resolution | Cowork, post-2.0 |
| **Quality cert sample review** | Match customer-accepted format rather than imposing new one | Cowork, when 2.1 cert work begins |
| **Letterhead/branding artwork** | Plain-functional design at first; brand applied when artwork supplied | Cowork, when supplied |

---

## Handoff at Session Close

When Stage H deploys successfully:

1. **Update `CLAUDE.md`** with Session 13 summary — what shipped, blockers encountered, deferred items, any architectural deviations from the design lock and their justification
2. **Commit + push** CLAUDE.md update + final code as the close (atomic commit if possible)
3. **Tag** the commit `phase-2.0-alpha` for easy rollback reference
4. **Notify** by writing a one-line summary in the next Cowork session for handoff

If any stage runs over or hits blockers, prefer **shipping a smaller MVP that works** over a complete MVP that's flaky. Phase 2.1 ships incremental polish; alpha quality matters more than alpha completeness.

---

*Authored 28 April 2026 by Aurelius (Cowork Session 12 closeout). Implementation kickoff for Claude Code Session 13.*
