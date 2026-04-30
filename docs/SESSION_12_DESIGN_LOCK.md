# Session 12 — Phase 2 Home View Design Lock

**Date:** 28 April 2026
**Author:** Aurelius (Cowork session)
**Status:** LOCKED — ready for Session 13 implementation
**Phase:** Phase 2.0 home view — the floor-as-game interface
**Vision anchor:** "Look at the floor as a game and be able to see details of everything. Gamify while actually tracking everything."
**Spiritual benchmark:** Factorio. The factory must grow.

---

## 0. What This Document Is

This is the **single source of truth** for every design decision made in Session 12. It supersedes any conflicting guidance from earlier sessions for the home view scope. It is organized by component (not chronologically by phase) so that future readers — and Claude Code during implementation — can find what they need without scrolling through dialogue history.

Read this end-to-end before opening Session 13. Re-read sections as needed during implementation.

Companion documents:
- `SESSION_13_KICKOFF.md` (root) — the executable plan that ships against this design
- `CLAUDE.md` (root) — the project meta-history; Session 12 is summarized in its closeout section
- `PHASE_2_AUDIT.md` (root) — v2.1 module-boundary audit; informs Stage A modularization in the kickoff

---

## 1. Vision Recap

SEP Dashboard Phase 2 turns the v2.1 form-based dashboard into a **live floor simulator**. The home view IS the app — a top-down map of the actual building with every machine, worker, job, and stock item visible as an entity with drill-down detail. Reworks are observable loops. Quality is color-coded. Productivity becomes measurable per worker, per machine, per area, per customer. The operator sees the shop as one continuously-updating picture.

The simulator/game framing is deliberate. Job-shop work is repetitive and easy to lose sight of; gamification surfaces the variation worth paying attention to (priority urgency, quality drift, bottleneck pile-ups, productivity trends) and makes "the factory grew today" something the operator can feel.

---

## 2. Architecture Recap (Sessions 8, 11) and Session 12 Additions

**From Session 8 charter (locked):** esbuild + ES Modules; 7-layer JS dependency graph (utilities → storage → config → components → tabs → viz → app shell); CSS split across tokens/base/components/responsive; Jest unit + Playwright E2E minimal; v2.1 localStorage keys unchanged; static deploy to GitHub Pages.

**From Session 11 charter (locked):** Konva.js as primary visualization library for the home view (replacing p5.js for that layer); p5.js retained for the analytics tab; Firebase Firestore as the future real-time data sync layer with daily GitHub export as audit backup; storage abstraction designed now for the eventual Firebase migration; sep-invoicing remains a separate PWA on the same origin.

**From Session 11 audit resolutions (locked):** STATE singleton lives in Layer 2 with `getState()` / `setState()` accessors (option C); inline onclick handlers replaced with `addEventListener` / `data-action` delegation; construction overlay deleted (not migrated) during modularization; payroll `calc*` functions promoted to `utils/payroll.js`.

**Session 12 architectural additions:**

- **Two-PWA monorepo** — primary dashboard (`/sep-dashboard/`) and notebook handler entry app (`/sep-dashboard/entry/` or similar). Same monorepo, two esbuild entry points, two bundles, two paths on GitHub Pages. Shared schema, utilities, storage layer (Layers 1–3). Different UI shells (Layer 5+ branches per app). Handler bundle excludes Konva/p5 entirely.
- **Firebase write permissions structural** — handler app writes production entries + job receipts; dashboard writes everything. Firestore security rules enforce. Final permission scope locked before launch.
- **Audit log first-class in storage layer** — append-only event stream alongside writes (job created, qty edited, machine status changed, dispatch confirmed, rework initiated, priority bumped). Required for the notebook handler's data steward role to actually function.
- **Sep-invoicing integration boundary formalized** — separate PWA on same origin; integration is async best-effort via shared storage; resilience principle locked: invoicing failure must not break dispatch and vice versa. See §6.1.
- **Universal color convention scoped to every entity** — one palette (green/orange/red) carries the same meaning across rooms, tanks, corridors, stock items, workers, vehicles. Eliminates per-domain palette drift. State decorators (pulse, hatch, icons, color drift) layer on top.
- **Mood / health signal layer** — schema-ready in Phase 2.0 (`Worker.mood_score`, `Machine.health_score`, `Customer.health_score`), rendered in Phase 2.1+. Soft-state layer above hard process state; gated to steward role per §8.2 productivity-humane defaults.
- **Notes as a generic primitive** — every entity type (machines, workers, jobs, stock, rooms, corridors, inspection station) can carry `Note` records. Operational continuity glue across shifts.

---

## 3. Floor View Design

### 3.1 Viewport (Phase 1 lock)

**Top-down literal.** The floor view mirrors the actual building. Areas placed where they physically are; machines drawn at their fixed positions inside rooms. The operator's spatial intuition from walking the shop transfers directly to the dashboard. No scaling, no semantic re-arrangement.

**Perimeter transport loop** — The floor has a single continuous walkway / transport loop wrapping all production rooms. Material on handcarts and 3-wheelers moves along this loop; workers and material enter/exit production rooms through doorways and the building through gates. The colored borders on the floor plan (green / orange / red) demarcate maintenance-state segments of this single loop, not separate routes. Loop has *width* (a corridor with edges, not a thin line); job-movement animations travel along it from room doorway to room doorway.

**Operational state on the floor view** — beyond production state, the floor view also surfaces:
- *Corridor maintenance state* — segments of the perimeter loop render in their actual maintenance color (universal green/orange/red per §3.3)
- *Redevelopment markers* — green and red crosses on areas mark redevelopable spaces (green = swing space, easy repurpose; red = needs demolition / room-type overhaul). Passive at 2.0; surfaces in a future Planning overlay (§10 backlog)

Source of layout truth: `docs/floor-plan.png` (full plant, to be added — see §11) plus per-room interior layouts (one supplied for VAT Room 1; others banked, see §11). Layout coordinates extracted into `src/config/rooms.js` and `src/config/machines.js` so positions are data, not hardcoded.

### 3.2 Entity Vocabulary (Phase 2 lock — revised post-VAT-Room-1 review)

**Geometric primitives, honest top-down geometry.** No skeuomorphic art; visual language matches the existing CAD plan so the operator's mental model transfers without translation.

**Hierarchy:** plant → perimeter loop + rooms → (within each room) tanks/machines + internal pathways + doors → workers and jobs as moveable overlays.

| Entity | Shape | Position | State semantics | Render notes |
|---|---|---|---|---|
| **Room** | Labeled rounded rectangle | Fixed per floor plan | — (composite) | Sized to actual footprint; thin border default; thickens/colors on alarms or filter focus |
| **Plating tank — cyanide** (in VAT Rooms 1, 2) | Rectangle | Fixed inside room | Process: running / idle / down | The actual electroplating bath. **Multi-line tanks are modeled as N independent Machine entities sharing chemistry** — e.g., VAT Room 2's big T contains 2 jigging lines = Tank 5 + Tank 6 (separately scheduled, share bath chemistry constraint via `shared_bath_with`). VAT Room 1's T1–T4 are single-line each |
| **Plating barrel — acid** (in Barrel Room) | Circle | Fixed inside room | Process: running / idle / down | Top-down of cylindrical tumbling drum |
| **Pickling tank** (in Area 4) | Rectangle | Fixed inside room | Process: running / idle / down | HCl bath, surface-cleaning step |
| **Pickling dip tank** (water rinse, Area 4) | Rectangle (smaller, lighter border) | Fixed inside room | Capacity: empty / partial / full | 2× water rinses after pickling; can park material when downstream is full |
| **Staging tank** (ST in plating rooms) | Rectangle (smaller) | Fixed inside room | Capacity: empty / partial / full | Holds incoming pickled material before operator loads to plating tank |
| **Passivation tank** (PT in plating rooms) | Rectangle (smaller) | Fixed inside room | Process: idle / running | Chemical passivation step (post-plating) |
| **Drum — passivation rinse** (D in plating rooms) | Small oval | Fixed inside room | Process: idle / running | Drum-shaped container holding water; first post-passivation rinse. Present in both VAT Rooms |
| **Rinse Dip Tank** (RDT, VAT Room 2 only at present) | Rectangle (smaller) | Fixed inside room | Process: idle / running | Additional post-passivation water rinse — gives VAT Room 2 a two-stage rinse vs VAT Room 1's single Drum rinse |
| **Internal pathway** (within rooms) | Dotted polyline | Fixed per room interior | — (passive) | Operator and material walking paths inside rooms |
| **Door** (room ↔ perimeter loop connector) | Dashed rectangle on room boundary | Fixed | — (passive) | Explicit connection point where material crosses room boundary |
| **Inspection Station** | Small circle (representing the upturned drum used as workbench) | Mostly fixed (outside VAT Room 2, in pathway next to its FG strip); inspector may float occasionally | Process: idle / inspecting | Quality testing happens here — DFT measurements, pass/rework decisions |
| **Worker** | Small filled dot with 1–2 letter monogram | Assigned room (or transit) | Status: on-shift / on-break / off-shift / in-transit | Inferred location from production entries until cameras (see §11) |
| **Job** | Small badge above current machine | At current machine / staging tank / FG strip / inspection station | State + quality + priority + loitering | Color-coded state (§3.3); WPP-derived progress ring (§3.4); border thickness encodes priority tier; micro-clock surfaces loitering (§3.4) |
| **Customer vehicle** (Phase 2.1+, transient) | Small vehicle icon | At gate during arrival/departure | Transient — appears on dock/dispatch event | Operational awareness ("3-wheeler at Back Gate, unloading") |
| **Stock** | Not rendered on floor | — (HUD only) | Capacity / threshold | Lives in HUD right-rail Attention Stack (§5.1) |

**Exterior infrastructure** (drawn but passive — *not* inside rooms):

| Entity | Notes |
|---|---|
| **Rectifier** | Sits outside production room walls; one per area (electrical proximity constraint). Drawn passively |
| **Finished Goods strips** | Exterior to the rooms, in the perimeter zone adjacent to each room. Each room owns its adjacent FG strip; material parks there for open-air drying before dispatch transit |
| **Dryer (centrifugal, shared)** | Located in the right-side empty zone exterior to all rooms (next to Acid Pickling). Primarily for Barrel-Room material (~2 min spin); occasionally used by VAT Rooms. **No dedicated workforce** — operators from any room can use it as needed. Schema: `Machine.shared_resource: true` |
| **Perimeter loop** | The continuous transport corridor (see §3.1); rendered with maintenance-state coloring per segment |
| **Gates** | Back Gate = customer material in; Main Gate = product out + stock in. Asymmetric flow roles |
| **Defunct Rooms** | Currently store raw chemistry / zinc (per Session 12 dialog); marked redevelopable-with-demolition (red cross) |
| **Empty Area / Cycle Stand** | Adhoc storage and material spillover; marked as redevelopable swing space (green crosses) |
| **Right-side empty zone** | Houses the shared Dryer; remainder is adhoc material unloading spillover area |
| **Bathroom, PC Unit (Power Control Unit), Office, Guard Room, Staff Room, Water Tank, Incoming Warehouse** | Support spaces; mostly passive on dashboard |
| **Redevelopment markers** | Green crosses (swing space, easy repurpose) and red crosses (demolish-to-repurpose) — passive annotations on the floor view; surface in future Planning overlay |

### 3.3 State Encoding (Phase 3 lock — revised to universal color convention)

**Two-layer model:**

1. **Base layer — universal color convention.** Every entity (rooms, tanks, barrels, corridors, stock items) carries a base color reflecting its overall health/maintenance state. Same palette everywhere:
   - **Green** = healthy / functional / well-maintained
   - **Orange** = needs attention, not urgent
   - **Red** = dysfunctional / overdue / broken / urgent
2. **Decorator layer — state-specific signals on top of the base.** Pulse for life, hatch for down, icons for warnings, color drift for SLA pressure, fill-level for capacity. Decorators are *additive* — a healthy plating tank that's currently running renders as green base + warm pulse; a dysfunctional tank renders as red base + dark fill + diagonal hatch.

**Principles:**
- Color carries meaning, not decoration
- Motion is reserved for life and alarms
- Hatch/border patterns do work color shouldn't
- **Every color signal has a redundant non-color encoding** (icon, shape, hatch) for color-blind accessibility
- Color names are placeholders for actual `tokens.css` palette values

#### Machine state decorators (over base color)

| Process state | Base | Decorators |
|---|---|---|
| Running | Green | Slow low-amplitude warm pulse (signals life) |
| Idle (functional, no current job) | Green | None |
| Down (dysfunctional) | Red | Dark fill + diagonal hatch (color + shape redundancy) + ⚠ icon |
| Maintenance scheduled (warning) | Orange | ⏰ icon |

#### Capacity-state decorators (for staging tanks, dip tanks)

| Capacity | Encoding |
|---|---|
| Empty | Hollow / no fill | 
| Partial (≤50%) | Fill from bottom proportional to current level |
| Near-full (>80%) | Fill + ⏰ icon |
| Overflow / parking-overdue | Red base override + ⚠ icon (downstream is jammed) |

#### Job state (badge color, layered on universal base — neutral when in-flight)

| State | Color | Position |
|---|---|---|
| In-flight | Neutral brand | At current machine / staging tank / inspection station |
| Ready | Green | Migrated to room's owning Finished Goods strip |
| Dispatched | — | Removed from floor (queryable in history) |

#### Job quality (badge decoration)

| State | Decoration |
|---|---|
| Not yet measured | Undecorated |
| Pass (within agreed spec for that `quality_tier`) | Small green ✓ icon |
| Out of spec / rework needed | Amber ring + ⏰ icon (rework is a planned route, not an error) |

#### Priority encoding (badge border + color drift — composes naturally with universal palette)

| Source | Encoding |
|---|---|
| Static — client tier | Border thickness: tier-1 = thick (3px), tier-2 = medium (2px), default = thin (1px) |
| Dynamic — time-in-plant pressure | Programmed color drift on badge: 0–18h neutral, 18–22h orange tint + ⏰ icon (early warning), 22–24h orange pulse + ⏰ icon, 24h+ red pulse + ⚠ icon (SLA breach, alarm tier) |

Thick-border + orange-pulse badge = "tier-1 client, approaching SLA breach." Thin-border + red-pulse = "default tier broke SLA, needs explanation." The two priority sources compose; combined priority score = client_tier_weight × elapsed_pressure_curve. Dashboard sorts and surfaces by combined score.

#### Alarms / warnings

| Alarm | Encoding |
|---|---|
| 12h Ready loitering | Badge pulses red + ⚠ icon after threshold |
| Low stock | Stock bar turns red + pulses + ⚠ icon |
| Machine down >N hours | Room border turns red + ⚠ icon (peripheral-vision catch) |
| Per-station loitering (job sitting too long at a sub-station) | Badge gains orange micro-clock when current-station-elapsed exceeds typical-station-time × 1.5 (see §3.4) |
| Corridor segment overdue maintenance | Segment renders red on universal base; clickable in future Maintenance overlay (banked §10) |

**Room-level escalation:** alarms on entities also light up the room's border so peripheral vision catches them when focus is elsewhere. Property toggle on Konva Group node — cheap to install, cheap to walk back.

#### Worker presence

| State | Encoding |
|---|---|
| On shift, at station | Filled monogrammed dot at assigned room (green base) |
| On shift, in transit | Dot sliding along perimeter loop (inferred from production entries until cameras — §11) |
| On break | Dimmed outline-only dot at staff room |
| Off shift | Not rendered |

#### Mood / health signal layer (Phase 2.1+ — banked)

A "soft state" layer on top of the hard process state. Schema-ready in Phase 2.0 (`Worker.mood`, `Machine.health_score`); rendered via subtle color gradient overlays in Phase 2.1+. Use cases:

- *Machine* — running fine vs. running rough vs. concerning (anomaly signal short of full down state); productivity decline as visible gradient
- *Worker* — productivity gradient; flags potential burnout or unusual patterns (sensitivity-handled per §8.2 — gated to steward role, never displayed publicly as a "worker color")
- *Customer* — relationship health gradient (rework rate, dispute frequency, payment timeliness)

Defer rendering decisions until Phase 2.1 design pass; the data model accommodates from day one.

### 3.4 Job-Flow Visualization (Phase 4 lock — revised with granular process model)

**End-to-end route (granular):**

```
Receipt at Back Gate → pathway / Incoming Warehouse (often spillover-unorganized)
  → Pickling Tank (~15 min variable, oil/dust dependent)
  → Dip Tank 1 (water rinse) → Dip Tank 2 (water rinse)
  → [optional parking in dip tank if downstream plating areas are full]
  → handcart transit along perimeter loop (counterclockwise — see flow direction below)
  → door → Staging Tank in target plating room
  → operator loads hand basket → Plating Tank (VAT ~20 min variable / Barrel ~90 min variable)
  → Passivation Tank (~2 min)
  → Drum / Passivation Rinse Dip (water rinse — both VAT Rooms)
  → [VAT Room 2 only: additional Rinse Dip Tank (RDT) — second rinse stage]
  → exit door → FG strip exterior to room (open-air drying, weather-variable)
  → [optional: shared exterior Dryer in right-side empty zone (~2 min spin) — primarily Barrel material; occasionally VAT material]
  → Inspection Station (DFT measurement)
  → Pass: dispatch via Main Gate
  → Fail: rework loop back to plating (amber-trail animation)
```

**Floor-view rendering granularity:** the floor view shows tanks/machines as primitives (so T2-dysfunctional reads from the floor without drilling). Sub-station detail (which dip tank, which staging tank) is in the panel.

**Material flow direction along loop** — counterclockwise from Back Gate (in) → Pickling → up through plating areas → out via Main Gate. Workers move freely both ways; *material* has a logical direction. Animations are choreographed counterclockwise as the default; reworks may animate against the grain to emphasize the loop.

**Job movement animation** — event-triggered. When a job changes stations, the badge tweens along the perimeter loop (or internal pathway, for within-room moves) over ~2 seconds. The loop is one physical lane; multiple concurrent animations are visually offset (slight Y-jitter or time-staggered) so badges don't collide on the same rendered line. Calm-mode toggle in HUD suppresses animation while keeping badge positions current.

Expected density: ~3–6 corridor animations/hour (3 plating areas × 30–60 min cycle), plus higher within-room movement.

**Reworks** — same animation, distinct trail. When a job loops backward (Inspect fails → back to Plate), the trail color shifts to amber + ⏰ icon and the path may curve to make the loop visually obvious. Reworks are common, not exceptional; their visibility is the productivity-honesty mechanism.

**Production progress (the game mechanic)** — every job badge has a thin **progress ring** showing % complete (cumulative completed ÷ target). Ring fills as production entries land. Target is **derived, not entered**:

- VAT jobs: target_pieces = received_kg ÷ item_WPP (master data, default derivation "weigh 5, divide")
- Barrel jobs: target_kg = received_kg directly (no conversion)

When WPP isn't yet calibrated, ring renders as a *dotted* outline instead of solid — visual honesty about data quality, implicit invitation to populate the WPP table. ~70% of items have known WPP at launch; remaining ~30% calibrated over time.

**Per-station loitering indicator** — micro-clock on badge surfaces when current-station-elapsed exceeds the typical cycle time × 1.5 for that station type. Example: a barrel job that has sat in a staging tank for 45 min when typical pre-load wait is 10 min gains an orange micro-clock. Surfaces parking and queuing pressure *before* the SLA timer fires. Cheap to compute (current state + ProductionEntry timestamps); diagnostically powerful.

**Multiple jobs per machine** — rare but possible (mixed-customer barrel batches). Badges stack with slight offset; click expands to a list view in the panel.

**Bottleneck pile-ups (Factorio-derived)** — badges visibly stack at any of the four pile-up locations when downstream is constrained:

| Pile-up location | Constraint that fills it |
|---|---|
| **Pathway / Incoming Warehouse** | Pickling tanks all full |
| **Pickling Dip Tanks** | Plating areas can't intake (staging tanks full) |
| **Staging Tanks** in plating rooms | Plating tanks all running, no operator capacity |
| **Finished Goods strips** (per room) | Dispatch slow, ready material accumulating |

The pile becomes the alarm before the alarm fires; the operator can SEE which stage is the binding constraint at any moment.

**Production rate hint on machines** — explicitly *not* implemented (modulating the running pulse based on throughput would read as noise, not signal).

### 3.5 Process Timings (initial calibration — refined by actuals)

These are baseline cycle times per machine type. Configurable per `MachineType` and overridable per `Item` (some items genuinely take longer). Calibrated by actuals once the dashboard collects production entries — Phase 2.0 ships with these as defaults; 2.1 surfaces variance and updates defaults from data.

| Step | Avg duration | Variability | Notes |
|---|---|---|---|
| Pickling | 15 min | High (oil/dust dependent) | Shorter for clean material, longer for heavy contamination |
| Pickling dip × 2 | Minutes | Low | Water rinse; rapid |
| Handcart transit (Pickling → Plating) | ~30 sec to 2 min | Low | Distance-dependent on target plating area |
| Staging tank wait | Variable | High | Queue time before operator loads basket |
| Plating — VAT (cyanide) | 20 min | Moderate (client/material dependent) | Plus jigging/setup time |
| Plating — Barrel (acid) | 90 min | Moderate | Full barrel spin cycle |
| Passivation | ~2 min | Low | Chemical step |
| Passivation rinse dip | Minutes | Low | Water rinse |
| Dryer (Barrel only) | 2 min | Low | Centrifugal spin |
| FG open-air drying | Variable | High (weather/humidity) | Time on FG strip is a soft state — surfaces in panel |
| Inspection (DFT measurement) | Minutes per batch | Low | Per-batch DFT readings |

**Two clocks per job:**

- **SLA clock** — wall time from material receipt at Back Gate; customer-facing; drives the 24h breach alarm. Strict (does not pause for reworks per §6 schema).
- **Process clock** — cumulative active processing time (pickling onward); internal-facing; drives productivity stats.

The gap between SLA clock and process clock = "time material sat in pathway / warehouse / dip parking before active processing started" = a real, measurable inefficiency the dashboard surfaces ("avg time-to-pickling is 45 min — is offloading our bottleneck?").

**Capacity baseline:** ~4 tonnes/day intuited by Rishabh. Rendered as a comparison line on productivity sparklines once 2 weeks of data accrue (Phase 2.1+).

---

## 4. Interaction Model (Phase 5 part 1 lock)

### 4.1 Patterns

**Hover = peek.** Light tooltip, transient. Machine name + current state, or job ID + customer + % done. No commitment, no panel open.

**Click = open panel.**
- Desktop: right-edge slide-in, ~360px wide, persistent until dismissed
- Mobile: bottom sheet, ~70% viewport height, leaves a strip of floor visible
- Floor never disappears

**Drill-down navigates within the panel.** Click VAT Room 1 → room detail (machines, current jobs, today's throughput, on-shift workers). Click a machine → machine detail (current job + history, downtime log, productivity stats). Click a job → job card (customer, item, qty received/completed, route history with quality tags, dispatch readiness). Click a worker → worker detail (today's productivity, weekly stats, area attribution). Breadcrumb at top of panel keeps navigation legible.

**Reciprocity panel ↔ floor.** Click an entity name in the panel → that entity highlights/centers on the floor. Two views stay in sync; the operator can pivot between spatial and tabular reading of the same fact.

**Editing inside the panel.** Action buttons live where the data lives — log production entry on machine detail; mark dispatched on the job card; log DFT measurement on the inspection step; log refill on the stock item. Inline forms within the panel; no separate modals.

### 4.2 Floor-Direct Quick Actions (right-click desktop / long-press mobile)

The dashboard's editing role is **exception handling**, not bulk entry — handler app owns bulk routine entry. Floor-direct actions are *frequent during a shift*, *single-decision* (no multi-field form), and *operational* (changing physical reality).

Per-entity vocabulary:

| Entity | Quick actions |
|---|---|
| Machine | Mark down / recover · log standard production tick (single-tap, default unit) · mark needs maintenance (warning, not down) · pause/resume current job · **add note** |
| Worker | Mark on break / back · reassign to room (if floatable) · clock out early · assign to specific machine · **add note** |
| Job badge | Mark ready (move to staging) · mark dispatched · route to inspection · mark as rework (initiate detour) · **bump priority / demote priority** · **add note** |
| Stock bar | Log refill received · mark depleted (urgent) · adjust threshold · **add note** |
| Room (empty space) | Mark room down (cleaning/full shutdown) · isolate filter (show only this room) · **add note** |
| Inspection Station | Mark currently inspecting (with job badge) · log DFT result · **add note** |
| Gate | — (passive infrastructure label, no actions) |
| Corridor segment (Phase 2.1+ Maintenance overlay) | Log maintenance done · update next-due date · **add note** |

**Notes / comments affordance** — small UI primitive, high day-to-day utility. Notes show as a small "💬" badge on the entity (icon + count if >1). Click expands a popover showing all notes (newest first), with author + timestamp. Examples: *"T3 making weird noise — check tomorrow"* / *"T1 needs anode replacement next week"* / *"This customer prefers thicker DFT, run high end of band"*. Operational continuity glue across shifts.

Anything with multiple fields (DFT measurement with micron value + inspector + batch ID, full job receipt, dispatch confirmation form) routes to the panel.

### 4.3 Mobile Status Feed (separate surface, not a scaled dashboard)

The simulator/game feel needs ~10–13" of screen. Below that, the floor either pinch-zooms (breaks the "see everything" promise) or compresses to abstract icons (loses the building metaphor). **Mobile is a separate surface**, designed bottom-up as a status feed:

- Top: alarm count + today's headline numbers (ready-to-dispatch, in-flight, low-stock count)
- Middle: live activity stream — *"VAT 1 finished Job #142 at 14:23"* / *"Barrel 3 low on zinc anodes"*
- Bottom: tap-to-drill into any item via the same panel pattern (sheet from bottom)

Phone is the watch-face; desktop is the operations room. Notebook handler interacts with the *handler PWA* (separate app), not this status feed — they're different surfaces with different purposes.

---

## 5. HUD & Overlays (Phase 6 lock)

### 5.1 Layout — Austere by Default

Game-UX precedent (Factorio, Cities Skylines, RimWorld): minimal chrome, detail one click away, the simulated space dominates the screen. The floor commands ~85% of screen real estate.

| Region | Behavior | Contents |
|---|---|---|
| **Top bar** (always, ~48px) | Static | Clock + shift indicator (Morning OT / Standard / Evening OT) · alarm count + bell · search · overlay-mode picker · calm-mode toggle · hamburger (left rail expand) |
| **Right rail "Attention Stack"** (always, ~140px) | Static when no panel open; compacts to icons-with-badges when panel opens | Categorized scrollable list: top priority jobs · critical stock items · machine alarms |
| **Left rail** (collapsed by default) | Hamburger expands | Filter toggles · layer switches (workers on/off, jobs on/off, corridor highlights on/off) · view modes |
| **Bottom chip** (single chip, expands on click) | Compact default | Headline counts: "8 in flight • 3 ready • 2 at-risk • Y dispatched today" |

### 5.2 Overlay Modes

A single picker in the top bar swaps how the floor is colored. Standard view is default; the others are *lenses* — same data, different question being asked.

| Overlay | Behavior | Launch |
|---|---|---|
| **Standard** | Phase 3 color language (machine status, job state, alarms, priority) | Phase 2.0 |
| **Priority** | Rooms/machines tint by combined priority score of jobs they hold; hot = "you have urgent work here" | Phase 2.1 |
| **Quality** | Rooms/machines tint by recent DFT pass rate (normalized against agreed `quality_tier`); hot = many failures | Phase 2.1 |
| **Productivity** | Rooms tint by today's or week's throughput; cool = quiet, hot = busy | Phase 2.2+ (needs ≥2 weeks of data) |
| **Stock-criticality** | Machines tint by their dependence on currently-low stock items | Phase 2.2+ |
| **Worker activity** | Rooms tint by hours-of-presence; validates floatable workers | Post-cameras (see §11) |

### 5.3 Stock Display Strategy

The "every category, even coffee pouches" tracking ambition will produce a long stock list. Default view shows **critical-only** (anything below 30% of threshold), max 8 items in the rail. Expand exposes all stock, grouped by category (Plating Chemistry, Consumables, Office, Maintenance, PPE, Utilities), with collapsible groups and search-within-stock. Always-visible chip at rail top: "3 critical, 7 low" — tappable.

### 5.4 Factorio-Derived Additions

| Addition | Behavior | Launch |
|---|---|---|
| **Bottleneck pile-ups** | Ready jobs visibly stack at Finished Goods strips when dispatch is slow (see §3.4) | Phase 2.0 |
| **Production rate sparklines** | Small graphs in job/machine/worker/customer panels: today vs 7-day average | Phase 2.1 |
| **Milestone toasts** | Bottom-right toast on small wins: "First job dispatched today" / "100kg processed today" / "First zero-rework day this month" | Phase 2.1 |
| **Multi-zoom map** | Zoomed-out "all 4 areas + corridors" minimap or zoom-out mode | Phase 2.2+ |
| **Time-travel / replay** | Scrub backward to see floor state at past timestamp | Phase 2.2+ |

Explicitly *not* taken from Factorio: pause / time-warp (real-time data), player avatar (we have actual workers), crafting menus (this measures, doesn't construct).

---

## 6. Data Model Additions for Phase 2

Schema sketches in TypeScript-ish notation for clarity. Final schema design is Claude Code's to nail; vocabulary and concepts here are locked.

```typescript
// Customer entity
interface Customer {
  id: string;
  name: string;
  contact_info: { /* phone, email, address */ };
  client_tier: 'tier-1' | 'tier-2' | 'default';
  default_quality_tier: 'premium' | 'standard'; // affects DFT inspection rigor
  default_billing_unit: 'kg' | 'pcs';
  notes?: string;
  health_score?: number; // 0-100; relationship health gradient (rework rate, payment timeliness, dispute frequency); Phase 2.1+
  sep_invoicing_customer_id?: string; // foreign key into sep-invoicing app's customer table for cross-app linking
  created_at: Timestamp;
}

// Item (master data per item type)
interface Item {
  id: string;
  customer_id: string; // items are often customer-specific
  description: string;
  wpp_grams: number | null; // null until calibrated; "weigh 5, divide" derivation
  wpp_calibrated_at: Timestamp | null;
  default_plating_method: 'cyanide' | 'acid';
  hazmat_notes?: string;
}

// Job entity (the central unit of work)
interface Job {
  id: string; // e.g., J-2026-1042
  customer_id: string;
  item_id: string;
  invoice_id?: string; // optional link to sep-invoicing
  received_kg: number;
  received_pcs?: number; // derivable from received_kg / wpp; stored if explicitly counted
  target_pcs?: number; // computed: received_kg / wpp (for VAT jobs); null for barrel jobs measured in kg
  target_kg?: number; // for barrel jobs; same as received_kg
  quality_tier_override?: 'premium' | 'standard'; // defaults to customer's
  client_tier_at_receipt: 'tier-1' | 'tier-2' | 'default'; // snapshot in case customer tier changes
  current_priority_bump: number; // 0 default; +N to manually elevate
  current_status: 'in-flight' | 'ready' | 'dispatched';
  current_location: { type: 'machine' | 'staging' | 'gate'; ref: string };
  route: 'standard' | 'rework-active' | 'rework-completed';
  rework_segments: ReworkSegment[];
  received_at: Timestamp;
  ready_at?: Timestamp;
  dispatched_at?: Timestamp;
  sla_deadline_at: Timestamp; // received_at + 24h
}

// ProductionEntry (append-only event)
interface ProductionEntry {
  id: string;
  job_id: string;
  machine_id: string;
  worker_id: string;
  qty_pcs?: number;
  qty_kg?: number;
  station: 'pickling' | 'plating' | 'inspection' | 'dispatch';
  recorded_at: Timestamp;
  recorded_by_app: 'dashboard' | 'handler';
  notes?: string;
}

// DFTMeasurement (append-only event)
interface DFTMeasurement {
  id: string;
  job_id: string;
  micron_value: number; // target band 8-12 µm for premium; looser for standard
  measured_by: string; // worker id
  measured_at: Timestamp;
  outcome: 'pass' | 'fail-rework';
  notes?: string;
}

// ReworkSegment (subdocument on Job, also surfaceable as event)
interface ReworkSegment {
  started_at: Timestamp;
  ended_at?: Timestamp; // null while active
  reason: string; // free text or enum: 'low-dft' | 'high-dft' | 'finish-defect' | 'other'
  triggered_by: string; // worker id
}

// Worker entity
interface Worker {
  id: string;
  name: string;
  monogram: string; // 1-2 letters for badge dot
  role: 'full-time' | 'part-time' | 'notebook-handler' | 'guard';
  role_in_room?: 'plating-operator'        // VAT Room 1 specialized: hangs and plates only
              | 'passivation-worker'        // VAT Room 1 specialized: passivation only
              | 'combined-operator'         // VAT Room 2 model: hangs, plates, AND passivates (full room operation)
              | 'pickler'                   // Area 4
              | 'barrel-operator'           // Barrel Room
              | 'inspector'                 // Inspection Station
              | 'floor-supervisor'
              | 'dispatch';
  home_area: 'area-1' | 'area-2' | 'area-3' | 'area-4' | 'office' | null;
  home_room_id?: string;
  floatable: boolean;
  current_status: 'on-shift' | 'on-break' | 'off-shift' | 'in-transit';
  current_location_room_id?: string; // inferred from production entries until cameras
  hire_date: Timestamp;
  mood_score?: number; // 0-100; Phase 2.1+ rendering, gated to steward role
  evaluation_notes?: string; // private, gated to steward
}

// Room entity
interface Room {
  id: string; // e.g., 'vat-room-1', 'barrel-room', 'pickling-area-4'
  name: string;
  type: 'plating-vat' | 'plating-barrel' | 'pickling' | 'support' | 'storage' | 'admin';
  position_x: number; // floor coords
  position_y: number;
  width: number;
  height: number;
  area: 'area-1' | 'area-2' | 'area-3' | 'area-4' | 'support';
  doors: Door[]; // connection points to perimeter loop
  internal_pathways: Pathway[]; // dotted lines connecting tanks within room
  fg_strip_exterior_id?: string; // adjacent FG strip on exterior
  rectifier_exterior_id?: string; // adjacent rectifier
  staffing_complement: { role: string; count: number }[]; // expected workforce when fully staffed
  current_status: 'operational' | 'partial' | 'down' | 'maintenance';
}

// Door (room ↔ perimeter loop connector)
interface Door {
  id: string;
  room_id: string;
  position_x: number;
  position_y: number;
  width: number;
  side: 'top' | 'bottom' | 'left' | 'right';
  perimeter_loop_segment_id: string; // which segment of the loop this connects to
}

// Pathway (within-room walkway)
interface Pathway {
  id: string;
  room_id: string;
  points: { x: number; y: number }[]; // polyline for the dotted path
}

// PerimeterLoopSegment (a colored maintenance section of the building loop)
interface PerimeterLoopSegment {
  id: string;
  points: { x: number; y: number }[]; // polyline for the loop edge
  width_px: number;
  maintenance_state: 'green' | 'orange' | 'red'; // universal color base
  last_maintained_at?: Timestamp;
  next_due_at?: Timestamp;
  notes?: string;
}

// RedevelopmentMarker (passive cross marker on the floor)
interface RedevelopmentMarker {
  id: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  type: 'green-cross' | 'red-cross'; // green = swing-space, red = demolish-to-repurpose
  notes?: string;
}

// Note (comments / sticky notes attached to any entity)
interface Note {
  id: string;
  entity_type: 'machine' | 'worker' | 'job' | 'stock' | 'room' | 'corridor' | 'inspection-station';
  entity_id: string;
  body: string;
  author_user_id: string;
  created_at: Timestamp;
  resolved_at?: Timestamp; // soft-delete or "addressed"
}

// DispatchEvent (explicit entity for invoicing integration)
interface DispatchEvent {
  id: string;
  job_id: string;
  customer_id: string;
  dispatched_by_user: string;
  dispatched_at: Timestamp;
  mode: '3-wheeler' | 'bike' | 'cycle' | 'hand' | 'other';
  vehicle_details?: string; // license plate / driver name when known (eventually camera-derived)
  invoice_id?: string; // populated when invoicing integration confirms invoice exists
  invoice_status: 'pending-check' | 'linked' | 'missing-alert-sent' | 'invoicing-down';
  customer_acknowledgment_at?: Timestamp; // signed delivery
}

// MaintenanceLog (per-corridor / per-room / per-machine maintenance entries — Phase 2.1+)
interface MaintenanceLog {
  id: string;
  entity_type: 'corridor-segment' | 'room' | 'machine';
  entity_id: string;
  performed_at: Timestamp;
  performed_by_user: string;
  next_due_at?: Timestamp;
  notes?: string;
}

// Machine entity (production unit, including sub-process tanks)
interface Machine {
  id: string; // e.g., t-1-1, st-1-1, pt-1-1, d-1-1, barrel-3-4, pickling-4-2
  name: string; // e.g., "T1", "ST1", "PT1", "Drum"
  area: 'area-1' | 'area-2' | 'area-3' | 'area-4';
  room_id: string; // belongs to a room
  type: 'plating-vat-cyanide'      // T1-T4 in VAT Room 1 (single-line each); Tank 5/6 in VAT Room 2 (multi-line modeled as 2 entities sharing chemistry)
      | 'staging-tank'             // ST1-ST3 in plating rooms (capacity state)
      | 'passivation-tank'         // PT in plating rooms (process state)
      | 'drum-rinse-dip'           // D in both VAT Rooms — water-containing post-passivation rinse, drum-shaped
      | 'rinse-dip-tank'           // RDT in VAT Room 2 — additional post-passivation water rinse (second stage)
      | 'pickling-hcl'             // Area 4 pickling tanks (process state)
      | 'pickling-dip-water'       // Water rinse tanks in Area 4 (capacity state — can park material)
      | 'plating-barrel-acid'      // Barrel Room (process state)
      | 'dryer-centrifugal-shared' // Exterior to all rooms, in right-side empty zone; shared resource, no dedicated workforce
      | 'inspection-station';      // Mostly outside VAT Room 2; floating
  shared_bath_with?: string[];     // ids of other Machines sharing the same physical bath/chemistry (e.g., Tank 5 + Tank 6 in VAT Room 2)
  shared_resource?: boolean;       // true for resources accessible from multiple rooms (e.g., the Dryer)
  shape: 'rectangle' | 'circle' | 'oval';
  state_kind: 'process' | 'capacity'; // determines how state is rendered (status colors vs fill levels)
  position_x: number; // within room, in floor units
  position_y: number;
  width: number;
  height: number;
  functional: boolean; // false for dysfunctional units (e.g., T2 in VAT Room 1 currently)
  current_status: 'running' | 'idle' | 'down' | 'maintenance' | 'inspecting'; // process-kind machines
  current_capacity_kg?: number; // capacity-kind machines (staging, dip)
  capacity_max_kg?: number; // capacity-kind machines
  default_cycle_time_min?: number; // process-kind machines; baseline timing
  status_changed_at: Timestamp;
  health_score?: number; // 0-100; mood/health signal for Phase 2.1+ rendering
  primary_operator_role?: 'plating-operator' | 'passivation-worker' | 'pickler' | 'inspector';
}

// Stock entity
interface Stock {
  id: string;
  name: string;
  category: 'plating-chemistry' | 'consumables' | 'office' | 'maintenance' | 'ppe' | 'utilities';
  tracking_mode: 'replenishment' | 'per-job-allocation';
  unit: 'kg' | 'L' | 'pcs' | 'units' | 'kWh';
  current_level: number;
  threshold_low: number;
  threshold_critical: number;
  last_refill_at?: Timestamp;
  weighted_avg_unit_cost?: number; // derived from receipts
}

// AuditEvent (append-only, every write generates one)
interface AuditEvent {
  id: string;
  entity_type: 'job' | 'production-entry' | 'machine' | 'stock' | 'worker' | 'customer' | 'item' | 'dft-measurement';
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'state-change';
  field_changed?: string;
  old_value?: any;
  new_value?: any;
  triggered_by_user: string; // user id (dashboard) or 'handler-app' for handler entries
  triggered_by_app: 'dashboard' | 'handler';
  recorded_at: Timestamp;
}
```

**Notes on the schema:**

- `quality_tier` ripples through DFT inspection rigor, rework decisions, productivity stats normalization, and quality heatmap calculations. Treat as first-class.
- `rework_segments` array enables time-breakdown views (primary / rework / staging) per job, plus customer-level "rework share" analytics.
- `AuditEvent` is what makes the notebook handler's data steward role functional. Without it, "who changed what when" is unanswerable.
- `Machine.position_x/y/width/height` is the data that makes the top-down literal viewport renderable. These are derived from the floor plan during Stage B of Session 13.
- `Job.client_tier_at_receipt` snapshots the tier at job creation; customer tier changes don't retroactively re-prioritize old jobs.
- `Machine.state_kind` distinguishes process-state machines (running/idle/down rendered as colored fill + decorators) from capacity-state machines (rendered as fill-level overlay over green base).
- `Note` is a generic primitive — every entity type can carry notes; rendered as a small "💬" badge on the entity. High day-to-day operational utility for cross-shift continuity.
- `mood_score` and `health_score` (on Worker, Machine, Customer) are schema-ready for Phase 2.1+ rendering. Mood/health rendering is gated to the steward role per §8.2 to avoid public ranking/shaming.

### 6.1 Sep-Invoicing Integration Contract

`sep-dashboard` and `sep-invoicing` are separate PWAs on the same GitHub Pages origin (`rishabh1804.github.io/sep-invoicing/`). They share storage primitives without a formal API surface, but the integration contract is locked here so both apps know what to expect.

**Trigger event:** `DispatchEvent` is created in dashboard when a job is dispatched.

**Integration flow:**

1. Dashboard creates `DispatchEvent` with `invoice_status: 'pending-check'`
2. Dashboard checks shared storage for an invoice matching `(customer_id, dispatched_at ± window)`:
   - **Invoice found** → write `dispatch_event.invoice_id`, set `invoice_status: 'linked'`, store key invoice details locally for offline reference (invoice number, total, date)
   - **Invoice not found** → set `invoice_status: 'missing-alert-sent'`, surface alert in Attention Stack: *"Job J-X dispatched 14:22, no invoice found in sep-invoicing"*
   - **Sep-invoicing unavailable** (storage read fails) → set `invoice_status: 'invoicing-down'`, log to audit, do NOT block dispatch flow

**Resilience principles (locked):**

- **Invoicing failure must not break dispatch** — dispatch always succeeds in dashboard; integration is async best-effort
- **Dashboard failure must not break invoicing** — sep-invoicing operates independently
- **No cross-app blocking writes** — both apps own their data; integration is read-only-with-link
- **Audit log records every integration attempt** — successful link, missing alert, or invoicing-down event all generate `AuditEvent` entries

**Phase 2.0 ships:** `DispatchEvent` schema + manual link fields. **Phase 2.1 ships:** automatic check-and-link logic + alert generation. Until 2.1, link is manual via panel.

---

## 7. Print Artifacts

### 7.1 Job Slip (ships in 2.0)

Half-page A5 portrait. Generated automatically at job creation; printable from the panel by handler or dashboard user.

```
=== PRIORITY — TIER 1 ===                  <- only on tier-1+ slips, colored bar
SEP                              JOB SLIP
[QR code]                        #J-2026-1042

Customer:        ABC Industries
Item:            M8 hex bolts
Process:         ACID ZINC (Barrel Room)   <- prominent, operational
Received:        250 kg / 1,250 pcs (WPP 200g)
Received at:     28 Apr 2026, 14:30
SLA deadline:    29 Apr 2026, 14:30        <- prominent

ROUTE
[ ] Pickling   Done @ __:__ by ____
[ ] Plating    Done @ __:__ by ____
[ ] Inspection Done @ __:__ by ____
    DFT measured: ___ µm
[ ] Dispatched Done @ __:__ by ____

[ ] RUSH (stamp here if bumped post-receipt)

Special instructions:
  - Quality tier: PREMIUM / STANDARD       <- per customer/job override
  - [hazmat or item-specific notes if any]

Notes: ________________________________
```

**Behavior:**
- Tier-1+ slips automatically print with a colored header strip; default-tier slips omit it
- Station stamp boxes capture *time taken* organically — by dispatch, the slip carries its own time audit (pickling done at 15:20, plating at 18:45, etc.)
- QR code encodes the job's URL in the dashboard for future scan-to-look-up
- Implementation: browser print with print-CSS template; no PDF library needed for the slip itself
- Reprintable from the job panel at any time (lost slip recovery)

### 7.2 Quality Certificate (deferred to 2.1, spec'd here for context)

Full A4 with letterhead. Auto-generated when a job hits Ready post-inspection; printable at dispatch; stored in Firebase Storage attached to the job record.

Contents: company info + "Plating Quality Certificate" + cert ID + customer + item + qty processed + plating method (cyanide / acid zinc) + DFT measurements (target band per `quality_tier` + measured average + range) + plating date + dispatch date + inspector signature line + dispatcher signature line + customer acknowledgment line.

**Implementation:** client-side `pdf-lib` (~150KB), lazy-loaded only when print is triggered. Stored PDF retrievable from job card forever (re-print on customer request months later is trivial).

**Sample format from current manual process** to be supplied by user during Session 13/14 implementation. Letterhead artwork to be supplied at the same time. Both banked in §11.

---

## 8. Cross-Cutting Concerns

### 8.1 Accessibility (Color-Blindness)

**Every color signal has a redundant non-color encoding.** Roughly 8% of men have red-green color deficiency; without redundancy, the SLA escalation and the DFT pass/fail signals are invisible to them.

| Signal | Color | Redundant encoding |
|---|---|---|
| 22h amber pulse (SLA warning) | Amber | ⏰ icon |
| 24h red pulse (SLA breach) | Red | ⚠ icon |
| 12h Ready loiter | Red | ⚠ icon |
| DFT pass | Green | ✓ check icon |
| DFT fail / rework | Amber | ○ ring + ⏰ icon |
| Machine down | Dark | Diagonal hatch pattern |
| Low stock | Red | ⚠ icon on bar |
| Priority tier | Border thickness | Already non-color (geometric) |

Bake in from day one; expensive to retrofit.

### 8.2 Productivity Measurement (Humane Defaults)

Per-worker output is the north-star metric (Session 11). Measurement creates incentives, and dashboards that display individual rankings prominently push workers toward gaming the metric (cherry-picking easy jobs, rushing pickling to inflate counts, unhealthy competition).

**Defaults:**
- **Team productivity** displayed prominently (room-level, area-level, day-level)
- **Individual productivity** is panel-only and gated to the steward / Rishabh role
- **Worker-vs-worker comparisons** live in the analytics tab, framed diagnostically ("VAT 2 has lower throughput than VAT 1 — worker issue or machine issue?") rather than as leaderboards
- **Productivity stats normalized by `quality_tier`** — standard-quality jobs run faster than premium; comparing them straight would mis-attribute productivity. Stats are tier-segmented or weighted.

### 8.3 Hotkeys (Factorio-Grade Keyboard Control)

Mouse-only navigation would be a regression from the genre. Minimum set:

| Key | Action |
|---|---|
| `F` | Focus floor (close panel, return to default view) |
| `P` | Open production graph in panel |
| `S` | Focus search bar |
| `O` | Open overlay-mode picker |
| `Esc` | Close panel / popover / dismiss focus |
| Arrow keys | Pan floor |
| `+ / -` | Zoom in / out |
| `1`–`4` | Jump to overlay modes (Standard / Priority / Quality / Productivity) |
| `Space` | Toggle calm mode |

### 8.4 Empty / Error / Onboarding States

What does the dashboard look like at 6am before any jobs are entered? At 11pm after dispatch is done? When Firebase sync fails for an hour? When the handler hasn't logged anything for 4 hours and dashboard data is stale? When localStorage hits quota?

**Sketch the empty state of every panel and the worst-case error state of every sync interaction before Phase 7 spec hardens.** Day-one impression is shaped by these states, not by the busy-shift state. Concrete deliverables:

- **Empty floor (pre-shift):** "No jobs in flight. Waiting for material." with a subtle animation suggestion
- **Sync error:** banner at top "Sync delayed (last successful: HH:MM). Showing local data." Non-blocking, dismissible
- **Stale data warning:** "Handler last logged 4h ago — dashboard may be behind." Investigates the handler app status if possible
- **Quota exceeded:** modal "Local storage full. Sync to clear." with action button

### 8.5 Search Bar Scope

Narrow at launch — **job IDs and customer names only**. The most common search use case is "I have a job number written down, where is it?" Workers and machines you find by hovering the entity directly. Broader search (workers, machines, stock items) is easy to add once panel-navigation patterns prove out.

### 8.6 Performance Budget (banked, design-time consideration)

Konva floor with rooms + machines + worker dots + active job badges + animated corridor traversals could reach 50+ animated nodes at peak. Set targets during Stage B of Session 13:

- 60fps on desktop with full scene
- 30fps acceptable on mid-tier tablet
- Memory growth <50MB over 12-hour idle session
- Bundle size: dashboard <800KB compressed, handler app <200KB compressed

Phone status feed is a separate surface and inherits no Konva budget.

---

## 9. MVP Scope (Phase 2.0 — May 10 launch)

### Ships in 2.0

- Modular bundle (per Session 8 charter) — esbuild + 7-layer + 4-file CSS
- Floor view fully designed (top-down literal, all entities including expanded tank vocabulary + Inspection Station, universal color base + state decorators, priority encoding, accessibility redundancy, corridor animations with lane-staggering, progress rings, badge stacking, multi-location bottleneck pile-ups, per-station loitering indicator, redevelopment markers passive)
- Interaction model fully implemented (hover/click/right-click + panel + reciprocity + per-entity quick actions + drill-down with breadcrumbs)
- HUD austere layout (top bar + right-rail Attention Stack + collapsed left + bottom chip)
- **Standard overlay only** (no Priority, Quality, Productivity, Maintenance, Planning overlays at launch)
- Hotkey set (F, P, S, O, Esc, arrows, ±, 1-4, Space)
- Empty + error + sync-warning states
- Job slip print (full layout per §7.1)
- Handler PWA skeleton (second esbuild entry; minimal forms for job receipt + production entry; same storage layer)
- Firebase Firestore wired (real-time sync, offline-first, daily GitHub export)
- Audit log (append-only, every write)
- v2.1 data compatibility (existing localStorage keys unchanged, new fields additive)
- Construction overlay removed (replaced by Phase 2.0 live)
- Schema-ready for Phase 2.1 expansions: `mood_score`, `health_score`, `evaluation_notes`, `MaintenanceLog`, `Note` entity, `RedevelopmentMarker`, `DispatchEvent.invoice_*` — fields exist; deeper rendering / UI deferred
- Sep-invoicing integration: `DispatchEvent` schema + manual link via panel (automatic check-and-link is 2.1)
- Workforce model entities (`Worker.role_in_room`, `Room.staffing_complement`); productivity attribution via these entities is 2.1+

### Saved for 2.1

- Priority overlay
- Quality overlay
- Productivity sparklines in panels (job/machine/worker/customer)
- Milestone toasts (first dispatch of day, 100kg processed, etc.)
- Quality certificate generation + storage
- Mobile status feed (separate surface)
- Search beyond job/customer (workers, machines, stock items)
- **Notes / comments UI affordance** (small popover; entity-attached note rendering)
- **Sep-invoicing automatic check-and-link** (poll on dispatch, alert on mismatch)
- **Customer vehicle as transient entity** at gates (operational awareness)
- **Mood / health rendering** as subtle color gradients (schema lives in 2.0)
- **Maintenance overlay** (corridor + room-state surfacing)

### Saved for 2.2+

- Productivity overlay (needs ≥2 weeks of data)
- Stock-criticality overlay
- Multi-zoom map view
- Time-travel / replay
- Customer-facing portal (3rd PWA in monorepo)
- Worker activity overlay (post-cameras, see §11)
- Anomaly flagging analytics
- Print artifacts polish (letterhead branding once supplied)
- **Planning overlay** (redevelopment what-if scenarios using `RedevelopmentMarker`)
- **Workload-distribution overlay** (overloaded vs idle workers; sensitivity-handled)
- **Audio alerts** (beep on critical alarm)
- **Daily / weekly summary print artifacts**
- **Data correction workflow** (explicit edit-with-reason UI)
- **Multi-language / localization** (Hindi / regional)
- **Power and water consumption tracking** (facility ops)
- **Multi-select batch actions, drag-and-drop reassignment**

---

## 10. Backlog (Out of Phase 2 Scope)

- Inventory bootstrap day-1 entry flow (when Phase 2 rollout begins)
- PWA push notifications (DFT failures, low stock, ready-to-dispatch)
- Returns / post-dispatch rework data model (new job vs reopen — Session 11 unresolved)
- In-house rejections data model (loop back vs scrap-as-cost — Session 11 unresolved)
- 3-period production model (Morning OT / Standard / Evening OT) per-machine vs shop-level — Session 11 deferral
- Multi-month GST summary (from PROJECT_REFERENCE.md old backlog)
- Camera-derived vehicle identification (license plate / driver name from gate cameras)
- Note resolution / archive workflow (mark notes as addressed; cross-reference to maintenance / actions taken)
- AR overlay capability (once cameras + photos exist; project floor-state onto live camera feed)
- Worker fatigue / safety alerts (e.g., dwell time in red corridor near acid-pickling area)

---

## 11. Open Items for Future Sessions

| Item | Why Important | When |
|---|---|---|
| **Notebook handler app architecture** | Two-PWA design needs full pass before Stage F of Session 13 finalizes (subpath vs separate, Firebase rules, conflict resolution, schema migration) | Session 13+ candidate |
| **Camera placement & type** | Unlocks worker real-time location tracking, gate-vehicle ID (license plate / driver), theft / safety / quality dispute resolution | Future session, post-2.0 |
| **Quality cert sample review** | Match the format your customers already accept rather than imposing new one; user has sample but it's outdated | When 2.1 cert generation begins |
| **Letterhead/branding artwork** | Plain functional design at first; brand applied when artwork supplied | When 2.1 cert begins or earlier |
| **Floor plan PNG** | The literal viewport layout depends on it; coordinate extraction into `src/config/rooms.js` blocks Stage B | **Add to repo at `docs/floor-plan.png` before Session 13 begins** |
| **Per-room interior layouts** (VAT Room 2, Barrel Room, Pickling Area 4) | Stage B accurate rendering needs them; VAT Room 1 sketched in Session 12 dialog. Without them, Stage B renders other rooms as labeled boxes and refines in 2.0.x patches | When convenient pre-Session 13 or in 2.0.x |
| **Photographs of plant interior** | Coordinate calibration (size measurements with scale reference); onboarding artifact; future computer-vision baseline. Useful, not blocking | When convenient |
| **WPP master data population** | 70% known at launch per user; remaining 30% calibrated over time via "weigh 5, divide" workflow | Ongoing post-launch |
| **Edge cases — returns, rejections** | Session 11 flagged as unresolved; quality tags + route history cover most but specifics surface during implementation | When they appear in production data |
| **Inspection Station floating-vs-fixed boundary** | Mostly fixed at upturned drum outside VAT Room 2 next to its FG strip, but inspector may float occasionally. Determine: render as one fixed entity with optional ad-hoc location override, or as a worker-bound role | Pre-Session 13 if dialog warrants |

---

## 12. References

- **Floor plan:** `docs/floor-plan.png` (to be added)
- **v2.1 audit:** `PHASE_2_AUDIT.md` (root)
- **Session 8 charter:** `docs/SESSION_8_READING.md`
- **Session 11 closeout:** `CLAUDE.md` § "Session 11"
- **Session 12 implementation kickoff:** `SESSION_13_KICKOFF.md` (root)

---

*Documented 28 April 2026 by Aurelius. Phase 2.0 home view design locked. Implementation handoff to Session 13.*
