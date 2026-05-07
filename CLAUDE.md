# CLAUDE.md — SEP Dashboard Design System Documentation
**Aurelius — Session 8+ Planning**

---

## What I Found

### Current State
- **Build:** v2.1, 4,665 lines (single HTML file), 130 functions
- **Deployment:** PWA via GitHub Pages (rishabh1804.github.io/sep-dashboard)
- **Design:** Locked at 4.5/5 across 7 principles (hierarchy, proportion, emphasis, balance, unity, contrast, similarity)
- **Productivity:** 4.3/5 (gaps: month-lock enforcement, analytics, editable history, validation)
- **Type System:** 3 voices — Fraunces (display), JetBrains Mono (data), Inter (body)
- **Data:** 22 localStorage keys, full payroll + invoicing + stock + production

### Key Architecture Decisions (Locked)
1. **Single-file deployment** — no build tools for production artifact
2. **Token compliance mandatory** — no raw px in CSS
3. **Mobile-first design** — base CSS ≤400px, @media 700px desktop
4. **Currency rounding:** `sepRound()` (floor) for all paisa
5. **Date handling:** `localDateStr()` (never `toISOString()`)
6. **3-period production model** — Morning OT / Standard / Evening OT with capacity segmentation
7. **Month-close lock** — after 28th, prevents edits with summary snapshot

### Production Completeness Tracker
✅ **Locked features:** 32/35  
🔶 **Pending (HIGH):** Month-lock enforcement on edit operations  
🔶 **Pending (MEDIUM):** Analytics, CSV export, editable past dates, bidirectional sync  

---

## What You Want to Build

**Goal:** Phase 2 of SEP Dashboard — major architectural upgrade adding modular structure + p5.js-based financial/user metrics visualization layer.

**Scope:** Full rewrite from single-file (v2.1) to modular architecture (Phase 2.0), maintaining all v2.1 features + data compatibility, then adding Analytics tab with p5.js visualizations.

---

## Architecture Charter — Session 8 (LOCKED)

### Decisions Ratified

1. **Module strategy:** esbuild + ES Modules + npm scripts
   - Build config: 30 lines
   - Rebuild time: ~50ms (vs Webpack's 2-5s)
   - Complexity: minimal, no plugin ecosystem
   
2. **Testing migration:** Jest unit tests → Playwright E2E minimal
   - Unit tests test pure functions (utils/) in <100ms
   - E2E tests cover critical workflows only (2-3 tests)
   - Full suite runs in <1 second instead of 4+ minutes

3. **Data compatibility:** v2.1 localStorage keys unchanged
   - `sep_cw_att_v2`, `sep_pe_att_v1`, etc. — drop-in compatible
   - `storage.js` wrapper provides future migration path
   - No data migration needed

4. **CSS organization:** Split across 4 files
   - `tokens.css` — colors, spacing, timing (150 lines)
   - `base.css` — reset, typography, layout (200 lines)
   - `components.css` — cards, buttons, modals (300 lines)
   - `responsive.css` — mobile-first @media queries (150 lines)

5. **7-Layer JS Architecture** (directed dependency graph)
   - Layer 1: Utilities (currency, date, validation) — zero dependencies
   - Layer 2: Storage wrapper — localStorage abstraction
   - Layer 3: Config (defaults, worker roster) — static data
   - Layer 4: Components (PayCard, WorkerPicker, InvoiceForm) — reusable UI
   - Layer 5: Tabs (home, attendance, production, finance, invoice, stock, history) — views
   - Layer 6: Viz (CostTrend, ProductionFlow, StaffingHeatmap, DataFilter) — p5.js sketches
   - Layer 7: App shell (`app.js`) — orchestrator
   - **Rule:** Each layer may import only from layers below. Reverse imports fail build.
   - **Event bus:** `pubsub.js` (15 lines) for cross-tab communication (emit/on pattern)

### GitHub Integration
- GitHub PAT: **deferred** until Phase 2.0 code is complete
- CI/CD setup: **deferred** until ready to push

### Deployment
- Static files to GitHub Pages (same PWA setup, different build output)
- p5.js loaded from CDN, not bundled
- Single HTML entry point, single bundle.js output

---

## Charter Status

**LOCKED** — All five architectural decisions ratified.  
**Implementation ready** — Session 9 opens with v2.1 code audit and modularization.

---

## Next Session Roadmap (Session 9)

1. **Audit v2.1 code** — identify module boundaries
2. **Extract tokens** — move CSS variables to `src/css/tokens.css`
3. **Set up build** — npm + esbuild.config.js
4. **Modularize JS** — split 4,665-line file into 7-layer structure
5. **Set up Jest** — migrate tests to unit testing framework
6. **Deploy Phase 2.0-alpha** — test on GitHub Pages
7. **Document housekeeping** — update CLAUDE.md with charter, archive old spec files

*Documented 28 April 2026 by Aurelius*

---

## Session 10: Under Construction Overlay (28 April 2026)

### What Was Built

Full-screen "Under Construction" overlay for v2.1, signaling Phase 2 modularization (esbuild, Jest, p5.js).

**Deliverables:**
- ✅ Overlay HTML/CSS/JS integrated into index.html (308 lines added, 4,665 → 4,972 lines)
- ✅ 3-hour localStorage dismissal preference (localStorage key: `construction-dismissed`)
- ✅ Two-step dismissal flow: button → warning modal → acknowledge
- ✅ Read-only mode enforcement (window.CONSTRUCTION_MODE flag + toast warning on save)
- ✅ Responsive design (mobile-first, gradient background #2a2825 → #b45a37)
- ✅ GitHub Pages deployment (commit `524769c`, live at rishabh1804.github.io/sep-dashboard)

**Design (Locked):**
- Gradient overlay (135° diagonal, charcoal to rust)
- Centered white modal (max 600px, 90% mobile)
- Fraunces 48px headline, Inter body fonts (v2.1 tokens)
- Construction emoji 🏗️, professional tone
- Copy: "Back online: May 10, 2026 (or sooner)"
- Details explain modularization, data safety, new tooling

**Timeline:**
- Build + test: 8 minutes (file composition via Python script, Write tool)
- Deploy: 3 minutes (git init → fetch → commit → push, 2 PAT attempts)
- Total: 26 minutes active work + 6 minutes issue resolution

### Issues Faced & Resolved

**3 blocking issues encountered; all resolved:**

1. **File Corruption (Edit tool on large file)**
   - Problem: Sequential Edit commands on 4,665-line file created malformed closing tags, duplicates
   - Solution: Restore from backup, use Write tool instead (single atomic operation)
   - Prevention: Use Write for >5000-line files; Edit for targeted changes only

2. **Git Init Failure (Corrupted .git directory)**
   - Problem: `.git/config` had corrupted state; `git init` failed with "bad config line 1"
   - Solution: Use clean `/tmp/sep-deploy-temp` directory; fresh git init
   - Prevention: Don't reinit in same directory; use separate working directory for each git operation

3. **GitHub PAT Permission Denied (403)**
   - Problem: First PAT lacked `repo` scope
   - Solution: User provided second PAT with full `repo` scope
   - Prevention: Verify PAT scopes before deployment (`repo` required for push)

**Full issue documentation:** See `SESSION_10_CONSTRUCTION_OVERLAY/ISSUES_AND_SOLUTIONS.md`

### Design Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dismissibility | Dismissible + warning | Users can peek; warned not to rely on data |
| Dismissal window | 3 hours (localStorage) | Re-engages frequently; long enough for QA testing |
| Visual style | Gradient (charcoal → rust, 135°) | Fresh, modern, professional (upgrade vibe) |
| Read-only enforcement | localStorage + window flag + toast | Client-side prevents saves without server changes |
| Modal hierarchy | z-index 9999 (overlay) + 10000 (warning) | Ensures overlay above all app content |

### Status Update

**Current v2.1 State:**
- 4,972 lines (was 4,665)
- Design: 4.5/5 (unchanged, overlay respects v2.1 style)
- Productivity: 4.3/5 (unchanged)
- Deployment: GitHub Pages live with overlay active

**What's Next:**
- Session 9 charter: Phase 2.0 modularization (15-hour build)
- Phase 2.0 scope: Esbuild bundler, Jest tests, 7-layer architecture, p5.js viz
- Overlay removal: When Phase 2.0 live (May 10 target), hide or update overlay message

**Detailed Documentation:**
- Session folder: `SESSION_10_CONSTRUCTION_OVERLAY/` (README, WORKLOG, CODE_SNAPSHOTS, GIT_DEPLOYMENT_LOG, ISSUES_AND_SOLUTIONS, DESIGN_SPECS)
- Commit: `524769c` (GitHub main branch)
- Live: https://rishabh1804.github.io/sep-dashboard/ (overlay visible on first visit)

---

*Documented 28 April 2026 by Aurelius (Updated: Session 10 complete)*

---

## Session 11: Domain Model & Phase 2 Vision (28 April 2026)

### What Changed

This session went deep on the **domain model** and crystallized the **product vision** for Phase 2. Several Session 8 charter decisions are now updated based on the clearer vision. No code was written; this is a design lock-in session.

### Vision Statement (LOCKED)

> "Look at the floor as a game and be able to see details of everything. Gamify while actually tracking everything."

The Phase 2 home view IS the app: a live, animated floor map that functions as a visual simulator. Every machine, worker, job, and stock item is a visible entity with drill-down detail. Reworks become observable loops. Quality becomes color-coded. Productivity becomes measurable.

This frame retroactively reshapes several earlier decisions — see Charter Updates below.

### Domain Locked

**Business**: Zinc electroplating job-shop. Two plating methods running in parallel:
- **Cyanide zinc** — bright finish, good throwing power. Used in VATs for larger / geometrically complex parts hung on jigs.
- **Acid zinc** — used in barrels for small loose hardware tumbled in perforated drums.
- **HCl pickling** — pre-treatment for everything; removes oxide/scale before plating.

**Floor Layout**:

| Area | Type | Machines | Functional |
|------|------|----------|------------|
| Area 1 | VAT, cyanide zinc | 4 VATs | 3 |
| Area 2 | VAT (1 physical, 2 lines) | 2 lines | 2 |
| Area 3 | Barrel, acid zinc | 8 barrels | 4 |
| Area 4 | Pickling (HCl) | 6 VATs | — |

Areas are simultaneously physical zones, functional groupings, and organizational units — one entity per area, not three overlapping ones.

**Production Unit definition**: "whatever runs independently and produces its own output." Usually = a machine. In Area 2, = a line within a shared tank. Each unit carries a status flag.

**Units of Measurement**:
- VAT areas (1 & 2): tracked in **pieces** (capacity scales with jig count, customer demands in pieces for clamps/brackets/etc.)
- Barrel area (3): tracked in **kg** (small hardware too numerous to count meaningfully)
- Customer billing: almost always in **kg**
- **WPP (weight per piece)** = master data per item; default derivation is "weigh 5, divide" when unknown
- UI defaults to showing pieces where intuitive, even when underlying unit is kg ("I like to think of it in pieces")

**Job Model**:
- A job is a *bucket of work*: total received quantity → daily production entries chip at it → cumulative completed + % done + remaining
- Single drop-off vs. batched aggregation: both modes supported (user defines per case)
- A job spans many days; multiple production entries per job per day allowed (when parallel units run on the same job)
- One invoice can cover multiple independent jobs (the "two items, one delivery" case)

**Job Lifecycle (revised: route-based, not 5-state linear)**:
- **Operations**: Pickling, VAT plating (cyanide), Barrel plating (acid), Inspection
- **Default route**: Pickle → VAT or Barrel → Inspect → Dispatch
- **Quality-driven detours** are common, not exceptional:
  - VAT → Barrel for extra shine/finish
  - Barrel → VAT to improve DFT
  - Full re-process from scratch when needed
- **DFT (Dry Film Thickness)** is the quality benchmark: target **8–12 micron**. Measured at inspection. Out-of-spec triggers a rework path chosen by failure mode.
- **Quality tags travel with the batch**: DFT measurements, finish notes, defect counts. Visible to customer history and floor view.
- **Coarse status**: in-flight / ready / dispatched
- **12-hour alarm on Ready**: finished plated work loitering in acid-fume atmosphere = quality decay. Dashboard surfaces overdue dispatches as warnings.

**Stock vs. Material (genuinely distinct)**:
- **Material** = customer-owned parts in flight (= jobs). "Material in/out" = job receipt and dispatch.
- **Stock** = our consumables that we deplete to do plating (zinc anodes, sodium cyanide, HCl, zinc salts, additives, brighteners, plus all the rest)

**Stock Model**:
- Universal tracking ambition: "every category, even coffee pouches and A4 paper bundles"
- Categories: plating chemistry, shop consumables, office, maintenance/spares, PPE/safety, utilities (meter readings)
- **Tracking mode trajectory** (macro → micro): each item carries a mode flag
  - Day 1: replenishment-based (log arrivals + exhaustion, infer rate)
  - Over time: critical items graduate to per-job allocation with consumption ratios
  - Coffee stays macro forever; zinc/cyanide graduate when ready
- **Cost on stock**: per-receipt unit cost (prices fluctuate); weighted average derived for consumption rollup; supports cost-per-job analytics
- **Reorder alerts**: threshold per item, low-stock = visible warning on floor view (resource-bar HUD, red when low)

**Workforce (20 total)**:
- 12 part-time contractors (11 floor + 1 production notebook handler)
- 7 full-time
- 1 guard
- **Specialization model**: each worker has a *home area* + *floatable* flag. Contractors mostly floatable; notebook handler stationary.
- **Productivity = north star**: "What everyone does must be a measurable unit. Right now, we don't know the productivity of anyone." Phase 2 makes per-worker output computable. Every production entry and state transition is worker-attributed.
- The notebook handler role transforms in Phase 2: from sole record-keeper to **data quality steward + anomaly checker**. Worth differentiating in UI permissions.

### Charter Updates (Supersedes Session 8 Where Conflicting)

**1. Visualization library: Konva.js (primary) + p5.js (analytics)**

Session 8 picked p5.js for the viz layer. Reconsidered now that the gamified vision is locked.

| Aspect | p5.js | Konva.js |
|--------|-------|----------|
| Paradigm | Imperative draw loop | Object-oriented scene graph |
| Hit detection | Manual (rectangle-checking per entity) | Built-in per node |
| Layering | Manual | Built-in (Stage > Layer > Shape) |
| Sweet spot | Creative coding, generative art | Interactive 2D scenes with persistent objects |

For the home view (persistent scene with clickable entities, drill-downs, status indicators), Konva is purpose-built. Less infrastructure to write, more time on visualization.

**Decision**: Konva.js for the home view's interactive floor map. p5.js retained for the analytics layer (flowing data-art views of weekly/monthly trends, where its creative-coding strengths shine).

**2. Data sync strategy: single-device → Firebase trajectory**

Session 8 charter: localStorage only. Holds for current state since data entry is consolidated to one device (the notebook handler).

**Future state**: Firebase Firestore for live sync, with daily auto-export to GitHub as audit/backup.

| Option | Pros | Cons |
|--------|------|------|
| **Stay single-device** | Simplest. Works while entry is consolidated. | Doesn't scale beyond one entry point. |
| **GitHub-backed JSON** | Free, version-controlled, no vendor lock | Polling-based, conflict resolution awkward, not real-time |
| **Firebase (recommended)** | Real-time updates, offline-first, free at this scale | Vendor lock-in (mitigated by daily GitHub export) |

**Why Firebase wins eventually**: real-time updates deliver the live-floor vision; offline-first handles factory wifi; free tier (~20K writes/day) covers ~100× current scale. Daily JSON export to GitHub gives durable archive + portable fallback.

**Storage wrapper design**: Storage abstraction layer (planned in Session 8 architecture) must be designed *now* with the sync trajectory in mind, even though we're starting on localStorage. Otherwise switching later means rewriting the data layer.

**3. Invoice integration boundary**

Jobs carry an optional `invoice_id` field linking to sep-invoicing (separate PWA on same GitHub Pages origin: `rishabh1804.github.io/sep-invoicing/`).

Same-origin means both apps can share storage primitives directly (localStorage, IndexedDB, BroadcastChannel) without a formal API. The "link" is a shared data namespace, not a request/response integration. Detailed integration design deferred until Phase 2 dashboard is functional.

### Vision-Aligned Features Banked for Later

| Item | Why It Fits the Vision | Why Deferred |
|------|------------------------|--------------|
| **Time-travel / replay** | Scrub backward to see "what did the floor look like Tuesday at 3pm?" Pure simulator-game move. | Builds on existing data foundation; not blocking |
| **Anomaly flagging** | "VAT 2 has 30% rework this week vs. 8% baseline" — makes productivity-measurement actionable, not just observable | Analytics layer; requires data history |
| **Audit trail** (who/when/what per entry) | Critical for notebook handler's data-steward role | Important; design when sync layer formalizes |
| **Worker vs supervisor view** | Notebook handler entry-focused; Rishabh state-focused | UI design phase |
| **PWA push notifications** | DFT failures, low stock, ready-to-dispatch alerts | Capability layer, additive |
| **Initial inventory bootstrap** | Day-1 entry of "what I have right now" | Rollout-time concern; design when migration begins |

### Open Questions Surfaced

These came up in conversation but weren't resolved this session — flagged for future:
- **Edge cases not nailed down**: returns/rework after dispatch (job re-opens vs new rework-job), in-house rejections (loop back vs scrap-as-cost). Quality tags + route history give us most of what we need; specifics come up at implementation.
- **3-period production model** (Morning OT / Standard / Evening OT from v2.1) — does it apply per-machine in Phase 2, or only at shop level for payroll? Fold into worker attribution design when we get there.

### Status

- **Domain model**: LOCKED (this session)
- **Vision**: LOCKED ("floor as a game")
- **Charter**: UPDATED (Konva primary + p5 secondary, Firebase trajectory, invoice integration framed)
- **Implementation**: not started
- **Next session (Session 12)**: pivot to **home view sketch** — the floor-as-game interface using Konva. Open-ended visual design exploration first, then convert to component spec.

### Charter Resolutions (Post-Audit)

After the v2.1 module-boundary audit (full detail in `PHASE_2_AUDIT.md`), resolutions on the four flagged items:

**Blocker 1 — Inline `onclick` handlers (~80 across HTML + JS-emitted templates).** Mechanical work, accepted. Replace with `addEventListener` or delegated `data-action` listeners during modularization. No architectural change required; budget the time in Session 13.

**Blocker 2 — `STATE` as mutable global, read/written from many modules.** Resolved with **option C**: STATE lives in Layer 2 (storage wrapper) as a singleton, exposed via `getState()` / `setState()` accessors. Modules import accessors from Layer 2 (which is below them); the layer rule stays pure, no mutable exports, no full pubsub overhead. Composes well with the eventual Firebase migration — `getState/setState` becomes the seam where the storage backend swaps out without callers changing. (Rejected: option A carve-out would weaken the layer rule; option B full pubsub adds reactive overhead and debugging surface for not-much-gain at this scale.)

**Blocker 3 — Construction overlay (~370 lines: CSS + HTML + JS).** Delete, do not migrate. Phase 2 IS the rollout; the overlay was a v2.1 stopgap. Clean removal during modularization.

**Recommendation — Promote payroll `calc*` functions to `utils/payroll.js`.** Accepted. Four pure functions move from `tabs/finance.js` to Layer 1 (utilities). Pure functions are prime Jest test targets — exactly where unit-testing pays off most.

### Commit Cadence (workflow rhythm)

Cowork-side CLAUDE.md updates and design docs only become visible to Claude Code (next session), scheduled remote agents, and other devices once **committed and pushed to GitHub**. Every Cowork session ending with CLAUDE.md changes triggers a commit + push as part of the handoff. Recorded here as a workflow rule, not a charter decision.

### Scheduled Review

Delta-scan agent scheduled to fire **2026-05-05 at 03:30 UTC** (09:00 IST), running Sonnet 4.6 from the GitHub repo. Output: `SESSION_DELTA_2026-05-05.md` committed to main. Purpose: confirm Phase 2 work has either started per plan or surface drift early. If Session 13 hasn't begun by then, even a "still in design phase" report is useful signal.

*Documented 28 April 2026 by Aurelius (Updated: Session 11 + audit resolutions complete)*

---

## Tools & Workflow (Session 11 closeout)

Phase 2 development uses two complementary tools. The boundary is documented here so neither tool drifts from the agreement.

### Tool Boundary

| Cowork (Claude desktop app) | Claude Code (CLI) |
|---|---|
| Design conversations, vision dialog | All actual coding |
| CLAUDE.md authoring/updates | Build configuration (esbuild, npm) |
| Vision / requirements discovery | Modularization, refactors |
| Cross-app integration discussions | Test runs, lint, type-check |
| Document generation (when needed) | Git operations + deployment |
| Light scripts / one-off file work | Local dev server |
| Cross-session user/feedback memory | Project-level execution |

**Principle**: don't code in Cowork if Claude Code is available; don't brainstorm in Claude Code if Cowork is open. Friction of switching is small once practiced.

### Handoff Mechanism

The shared brain across both tools is the **repo itself** — specifically `CLAUDE.md`. Both tools read it; both can update it. It's the operational source of truth.

Per-session flow:

1. **Cowork session** — design dialog. Ends by writing a `SESSION_N_KICKOFF.md` to the repo with next session's intent + acceptance criteria.
2. **Commit + switch** — git push, open Claude Code in the repo.
3. **Claude Code session** — auto-reads CLAUDE.md + kickoff doc, executes implementation, updates CLAUDE.md at end with what shipped.
4. **Commit + switch back** — next Cowork session reads the new state on load.

### Authentication

- **Cowork**: Claude subscription (Pro/Max/Team) — native to the desktop app.
- **Claude Code**: same Claude subscription via `/login` → "Claude account with subscription". *Not* API billing.
- **API key (`ANTHROPIC_API_KEY`)**: kept in Anthropic Console for programmatic use, but **must not be set in shell environment** when running Claude Code — otherwise overrides subscription auth and pulls from API credit balance.

**Known auth issue**: if `ANTHROPIC_API_KEY` is set as a Windows env var (User or Machine level), Claude Code will report an "Auth conflict" warning and default to API billing despite a successful `/login`. Fix:

```powershell
# Remove from current session
Remove-Item Env:ANTHROPIC_API_KEY

# Remove permanently (User level)
[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')

# If still present, check Machine level (requires admin PowerShell)
[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'Machine')
```

Then close + reopen the terminal. Top bar should change from "API Usage Billing" to subscription plan name.

### Model Selection

- **Cowork**: Opus 4.7 default — suited for complex reasoning + design dialog.
- **Claude Code**: Sonnet 4.6 for coding work (`/model` to switch). Opus is overkill for refactor/modularization; Sonnet is excellent at code and significantly cheaper per token.

### Persona Continuity

The Aurelius working name carries across both tools because it's defined in:
- User's prompt configuration (project-level instruction)
- This CLAUDE.md (`Aurelius — Session 8+ Planning` header at top)

Either tool, started in this repo, picks up the persona automatically. No tool-specific memory configuration needed.

*Documented 28 April 2026 by Aurelius (Session 11 closeout)*

---

## Session 12: Phase 2.0 Home View Design Lock (28 April 2026)

### What Happened

Worked the floor-as-game home view design end-to-end across seven phases: viewport, entity vocabulary, state encoding, job-flow visualization, interaction model, HUD/overlays, and the component spec deliverable. Session ended with the design fully locked, an MVP scope cut for the May 10 launch, and an executable kickoff doc for Claude Code (Session 13). No code written — pure design dialogue per the tool boundary.

The session unfolded as a structured Q&A with the user (Rishabh) confirming or pushing back on each phase's locked decisions. Several high-leverage refinements emerged:

- **Floor plan supplied** — user shared the actual building CAD plan early, which sharpened entity-vocabulary decisions (geometric primitives matching the existing visual language) and revealed gate asymmetry (Back Gate = customer material in; Main Gate = product out + stock in)
- **WPP-derived progress denominator** — the production progress ring works without operator entry by deriving target from received_kg ÷ wpp_grams; dotted ring renders when WPP isn't yet calibrated, solid when it is
- **Priority as load-bearing dimension** — added mid-session; encoded via badge border thickness (static client tier) + color drift (dynamic time-in-plant pressure approaching 24h SLA); composes with rework clock (separate diagnostic measurement)
- **Quality tier as first-class data concept** — premium vs standard quality acceptance ripples through DFT inspection rigor, rework decisions, productivity normalization, and quality heatmap calculations
- **Factorio confirmed as spiritual benchmark** — "the factory must grow" maps cleanly onto the productivity dashboard ethos; ported four mechanics: bottleneck pile-ups, sparkline rate graphs, milestone toasts, multi-zoom map (last banked)
- **Two-PWA monorepo architecture** — handler app as primary data ingestion surface, dashboard as read+exception-edit; same monorepo, two esbuild entry points, Firebase Firestore as shared real-time sync layer (per Session 11 charter trajectory)

### Deliverables

| File | Purpose |
|------|---------|
| `docs/SESSION_12_DESIGN_LOCK.md` | Source of truth for every locked design decision; organized by component (12 sections); includes schema sketches, slip layout, MVP scope cut, and banked items |
| `SESSION_13_KICKOFF.md` | Executable implementation plan for Claude Code; 8 stages totaling ~22h active work; acceptance criteria; deferred items; banked side-session triggers |
| `docs/floor-plan.png` | **Pending — to be added by user**; literal viewport layout depends on it; coordinate extraction blocks Stage B of Session 13 |
| `CLAUDE.md` (this update) | Session 12 closeout entry; references the Design Lock and Kickoff as canonical sources |

### Locked Architectural Additions (Supersedes earlier where conflicting)

1. **Two-PWA monorepo** — primary dashboard + notebook handler entry app share schema, utilities, storage layer (Layers 1–3); two esbuild entry points produce two bundles; handler bundle excludes Konva/p5
2. **Firebase write permissions structural** — handler writes production entries + job receipts; dashboard writes everything; Firestore security rules enforce
3. **Audit log first-class in storage layer** — append-only event stream for every write; required for the notebook handler's data-steward role to actually function
4. **Quality tier as first-class field** — `Customer.default_quality_tier` + `Job.quality_tier_override`; ripples through inspection rigor, rework decisions, productivity normalization, quality heatmap

### MVP Scope Cut (Phase 2.0 — May 10 launch)

**Ships in 2.0:** modular bundle, full floor view design, full interaction model, austere HUD, **Standard overlay only**, hotkey set, empty/error states, job slip print, handler app skeleton, Firebase sync wired, audit log.

**Saved for 2.1:** Priority + Quality overlays, productivity sparklines, milestone toasts, quality certificate generation, mobile status feed, broader search.

**Saved for 2.2+:** Productivity overlay (needs ≥2 weeks of data), stock-criticality overlay, multi-zoom map, time-travel, customer portal, worker activity overlay (post-cameras).

### Banked for Future Sessions

| Item | When |
|---|---|
| **Notebook handler app architecture** | Cowork session before Stage F of Session 13 finalizes (subpath vs separate, Firebase rules, conflict resolution, schema migration) |
| **Camera placement & type** | Cowork session post-2.0; unlocks worker real-time location tracking + theft/safety/quality dispute resolution |
| **Quality certificate sample review** | When 2.1 cert generation begins; user has outdated sample to share |
| **Letterhead / branding artwork** | When supplied; plain-functional design at first |

### Cross-Cutting Concerns Surfaced (in Design Lock §8)

- Color-blindness redundancy (every color signal has icon/hatch/border backup) — bake in day one
- Productivity measurement humane defaults (team prominent, individual gated) — design encodes incentives
- Hotkeys (Factorio-grade keyboard control) — minimum set: F, P, S, O, Esc, arrows, ±, 1-4, Space
- Empty / error / sync-warning states — sketch before Phase 7 spec hardens
- Performance budget — 60fps desktop, 30fps tablet, <50MB memory growth, <800KB dashboard bundle
- Print artifacts — job slip ships 2.0 (with priority header strip + station stamps + tier-1 distinction); quality cert deferred to 2.1

### Status

**Phase 2.0 design**: LOCKED.
**Phase 2.0 implementation**: Ready to begin (Session 13, Claude Code).
**v2.1 production**: Live with construction overlay; will be replaced when 2.0-alpha ships.
**Tooling**: design conversations stay in Cowork; coding moves to Claude Code per the workflow rule.

### Next Session

**Session 13 (Claude Code) — Phase 2.0 Implementation.** Reads `docs/SESSION_12_DESIGN_LOCK.md` + `SESSION_13_KICKOFF.md`, executes Stages A–H per the kickoff, deploys alpha, updates CLAUDE.md at close.

**Pre-Session 13 task:** add `docs/floor-plan.png` to the repo. Stage B is blocked without it.

### Post-Closeout Revision Pass (28 April 2026)

After the initial Session 12 closeout, an audit pass surfaced operational detail and refinements that fold back into the Design Lock and Kickoff. Highlights:

- **Perimeter loop correction** — single continuous walkway with maintenance-state segments (not multiple discrete corridors); colored borders demarcate the loop's edge
- **Universal color convention scoped to every entity** — green/orange/red base for rooms, tanks, corridors, stock, workers; state decorators (pulse, hatch, icons, color drift) layer on top; replaces the per-domain palette logic
- **Tank vocabulary expanded** — Plating Tank, Staging Tank (capacity-state), Passivation Tank, Passivation Rinse Dip, Pickling Tank, Pickling Dip Tank (capacity-state), Barrel, Dryer, Inspection Station — each with appropriate state semantics
- **VAT Room 1 interior layout supplied** — 4 plating tanks (T2 dysfunctional), 3 staging tanks, 2 passivation tanks, 1 rinse dip, internal pathways, doors. Other rooms similar; layouts to be supplied
- **Process timings table** — average cycle times per machine type (Pickling 15 min, VAT plating 20 min, Barrel 90 min, etc.)
- **Multi-location bottleneck pile-ups** — pathway/warehouse, dip tanks, staging tanks, FG strips
- **Per-station loitering indicator** — micro-clock on badge surfaces parking before SLA timer fires
- **Animation lane staggering** — concurrent badges visually offset on the single-lane loop
- **Material flow direction** — counterclockwise (workers move freely both ways; *material* has direction)
- **Mood / health signal layer** — schema-ready for Workers, Machines, Customers; rendering deferred to 2.1
- **Notes as generic primitive** — every entity type can carry `Note` records; quick-action affordance + popover UI
- **Sep-invoicing integration contract** — async best-effort via shared storage; resilience principle locked (invoicing failure must not break dispatch and vice versa); §6.1 in Design Lock spells out the flow
- **Workforce model per room** — VAT Room 1 = 5 (3 plating + 2 passivation); other rooms TBD when layouts arrive
- **Two clocks per job** — strict SLA clock (customer-facing) + process clock (internal) with the gap surfacing offloading inefficiency

The audit-pass revision is committed to the same Design Lock + Kickoff files. New backlog and open-items entries reflect the additions.

*Revision pass documented 28 April 2026 by Aurelius (Session 12 closeout, audit-pass).*

---

## Cowork Session 12+ — Phase 2 Architecture Lock (7 May 2026)

### What Happened

Single-session deep architecture lock for the notebook handler app, conducted in eight phases with adversarial probes + multiple-choice ratification at each high-stakes decision point. Completes the "Notebook handler app architecture" item banked in Session 12 §11. Also reframes Phase 2.0 alpha scope.

This session produces the architecture decision corpus now living in `docs/architecture/`. CLAUDE.md remains the project meta-history; `docs/architecture/INDEX.md` is the routing surface for per-decision detail; `docs/architecture/DECISION_LOG.md` is the chronological journal.

### Major Reframes (Supersedes Earlier Where Conflicting)

1. **Data capture first; floor view deferred to 2.1.** Phase 2.0 alpha ships the comprehensive data capture handler app + a minimal data viewer dashboard. Konva floor view, HUD, overlays, hotkeys, and the full interaction model move to 2.1+. Rationale: *"this whole thing relies on excellent data capture, that's the unit."* Without real data flowing in, the floor view is theater. Building data capture first means: when floor view ships, it has accumulated real data to render.

2. **N-PWA monorepo (generalizing Session 12's two-PWA lock).** Each role gets its own role-app (handler, future Inspector, Dispatch, etc.); shared Layer-4 component library + role-specific Layer-5+ screens (middle path). Notebook handler ships first as comprehensive data capture, absorbing all role-data until specialized apps ship. Inspector then Dispatch are the next two role-apps in priority order.

3. **Bifurcated read/write surfaces.** Firestore is the live write/sync layer (real-time + offline-first). Per-topic markdown digests (`docs/topics/*.md`) are the agent-consumable / forensic / portable layer, regenerated hourly by Cloud Function from Firestore. Operationally consumed by Aurelius across sessions, Claude Code, future contractors, and any agent reading repo state.

4. **Notes as structured memory.** Notes are first-class typed records with open `kind` discriminator, agent-readable summary field, append-only `revisions[]`, typed links, status (active/resolved/archived), priority (normal/urgent), and expiry. Pattern derived from Pocock skills convention + Karpathy "context is the program." Generalizes — `topics/jobs/J-1042.md` aggregates not just notes but route history, DFT measurements, current status, all compiled from Firestore. Per-entity wiki page emerges naturally.

5. **Documentation as first-class architecture.** Each architectural decision lives in its own file under `docs/architecture/` with bar / criteria / rationale / acceptance embedded. CLAUDE.md becomes the index pointing to these files. Per user principle: *"Having the principles exactly where they should be is exactly why we have till 10th May."* Files for principles, not buried in code.

### Key Locks (Pointers to Detail)

- **Deploy topology** — Subpath dual-PWA monorepo, generalizing to N-PWA. → [`docs/architecture/DEPLOY_TOPOLOGY.md`](docs/architecture/DEPLOY_TOPOLOGY.md)
- **Data hierarchy** — Hybrid Firestore (top-level + subcollections); compartments by user-identity + role-app + 24h handler edit window. → [`docs/architecture/DATA_HIERARCHY.md`](docs/architecture/DATA_HIERARCHY.md), [`docs/architecture/STRUCTURED_NOTES.md`](docs/architecture/STRUCTURED_NOTES.md), [`docs/architecture/TOPIC_DIGESTS.md`](docs/architecture/TOPIC_DIGESTS.md)
- **Auth** — Firebase custom tokens, custom claims (`roles[]`, `is_steward`, `is_admin`); QR-in-person provisioning (supersedes URL-via-WhatsApp). → [`docs/architecture/AUTH_MODEL.md`](docs/architecture/AUTH_MODEL.md), [`docs/architecture/HANDLER_PROVISIONING.md`](docs/architecture/HANDLER_PROVISIONING.md)
- **Firestore security rules** — Five helpers, default-deny, min-bar validation, hybrid revocation, App Check, staging project + emulator CI. → [`docs/architecture/FIRESTORE_RULES.md`](docs/architecture/FIRESTORE_RULES.md), [`docs/architecture/CLOUD_FUNCTION_HOOKS.md`](docs/architecture/CLOUD_FUNCTION_HOOKS.md)
- **Conflict resolution** — Online: Firestore transactions; Offline: LWW + audit-log surface; pending-conflicts inbox in dashboard; aggressive event-sourcing. → [`docs/architecture/CONFLICT_RESOLUTION.md`](docs/architecture/CONFLICT_RESOLUTION.md), [`docs/architecture/EVENT_SOURCING.md`](docs/architecture/EVENT_SOURCING.md)
- **Schema migration** — Full 5-layer machinery as routine + safety nets (TTL backup + daily export + Zod + stale-build rejection + content-hash versioning + 3-stage bulk + DAG ordering). → [`docs/architecture/SCHEMA_MIGRATION.md`](docs/architecture/SCHEMA_MIGRATION.md)
- **Handler UI** — Three-layer screen hierarchy; Devanagari + icons + audio TTS; 64px touch targets; full pre-fill defenses; Android-only. → [`docs/architecture/HANDLER_UI_SHELL.md`](docs/architecture/HANDLER_UI_SHELL.md), [`docs/architecture/HANDLER_FORMS.md`](docs/architecture/HANDLER_FORMS.md)
- **Adoption** — 4-week phased rollout with parallel paper run. → [`docs/architecture/ADOPTION_PLAN.md`](docs/architecture/ADOPTION_PLAN.md)
- **Steward affordances** — Anomaly inbox + edit-with-reason + four-metric KPI weekly card + bulk disposition + quick-correct + steward-exclusive disposition. → [`docs/architecture/STEWARD_AFFORDANCES.md`](docs/architecture/STEWARD_AFFORDANCES.md), [`docs/architecture/ANOMALY_INBOX.md`](docs/architecture/ANOMALY_INBOX.md)

### Adversarial Pattern (New Workflow Convention)

For every load-bearing decision phase, an adversarial reviewer agent was spun up after the initial proposal. Same prompt template each time: stress-test, find what's wrong, severity-tag findings (BLOCKER / HIGH / MEDIUM / LOW / DEFENDABLE), predict the most likely first-month failure mode. Findings then folded into multi-choice ratification questions surfaced to the user.

Across 5 probes (Phases 4, 5, 6, 7, 8): 16 BLOCKERs + ~50 HIGH/MEDIUM findings absorbed; 50+ decisions locked; 23 must-adds documented; 3 deliberate divergences from adversary recommendations. Worth keeping as a pattern for future high-stakes architecture work.

### Session 13 (Claude Code) Refresh

`SESSION_13_KICKOFF.md` rewritten to reflect:
- Data-capture-first reordering (handler app + minimal data viewer ship in alpha; floor view deferred)
- Comprehensive handler scope (9 forms covering all role-data)
- Phase 4-8 locks (security rules, conflict resolution, schema migration, UI shell, steward affordances)
- Must-add inventory (23 items integrated into stage acceptance criteria)
- Adversary-driven safety nets (CF idempotency, replay tool, TTL backup, Zod, stale-build rejection, etc.)

Reads `docs/SESSION_HANDLER_ARCH.md` (synthesis) + per-decision files in `docs/architecture/` as needed during Stage F.

### Status

**Phase 2 architecture:** LOCKED across 8 phases.
**Phase 2.0 alpha (data capture):** Ready for Session 13 implementation.
**Phase 2.0 floor view:** Reframed to 2.1 (was alpha-required per Session 12 §9).
**Implementation handoff:** `docs/SESSION_HANDLER_ARCH.md` + refreshed `SESSION_13_KICKOFF.md`.
**Tooling:** design conversations stay in Cowork; coding moves to Claude Code per workflow rule.

### Banked Items Update

Session 12 §11 banked items, status post-this-session:

| Item | Status |
|---|---|
| **Notebook handler app architecture** | ✅ COMPLETED this session — see `docs/architecture/` |
| **Camera placement & type** | Still banked (post-2.0) |
| **Quality cert sample review** | Still banked (when 2.1 cert generation begins) |
| **Letterhead/branding artwork** | Still banked (when supplied) |
| **Floor plan PNG** | ✅ Present at `docs/floor-plan.png` (duplicate at repo root flagged for cleanup) |
| **Per-room interior layouts (Barrel Room, Pickling Area 4)** | Still banked; addressed in 2.0.x patches per Session 12 plan |
| **Workforce complement totals (Barrel + Pickling)** | Still banked; 9 of 20 unallocated |

*Architecture lock documented 7 May 2026 by Aurelius (Cowork Session 12+).*
