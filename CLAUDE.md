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

---

## Session 13: Stage A — Modular Bundle Lands (7 May 2026)

### What Shipped

The Phase 2.0 foundation — Stage A of the Session 13 kickoff. v2.1 single-file `index.html` (4,972 lines) is decomposed into a 7-layer modular tree built by esbuild into two PWA bundles. Functional parity with v2.1 is verified by the existing Playwright e2e suite (31/31 passing, including @smoke). 38 new Jest unit tests cover the Layer-1 pure utilities. Stages B–H (Firebase, handler PWA forms, dashboard viewer, Cloud Functions, adoption rollout) remain pending; this session was scoped to Stage A only after the user opted to ship a clean, smaller MVP rather than a sprawling partial scaffold.

### Deliverables

| Area | Detail |
|---|---|
| **Build pipeline** | `esbuild.config.mjs` with multi-entry support (`dashboard` + `handler`); npm scripts `build` / `build:watch` / `dev` / `test:unit` / `test:e2e` / `test:smoke` |
| **CSS split** | `src/css/{tokens,base,components,responsive}.css` per Charter Decision 4. Construction-overlay CSS (~370 lines) deleted entirely |
| **JS layers (per Charter Decision 5)** | `src/shared/utils/` (Layer 1, 7 modules), `src/shared/storage/` (Layer 2, 8 modules), `src/shared/config/` (Layer 3, 6 modules), `src/components/` (Layer 4, 9 modules), `src/dashboard/tabs/` (Layer 5, 8 modules), `src/dashboard/main.js` (Layer 7) |
| **N-PWA topology** | Two esbuild entries land `dist/dashboard.js` (125.8 kB unminified, sourcemapped) + `dist/handler.js` (placeholder stub at `entry/handler/`). `public/manifest-handler.json` provisioned per `DEPLOY_TOPOLOGY.md` |
| **State accessors** | `getState()` / `setState()` singleton in Layer 2 per audit cross-cutting finding 4 (option C — Architect-locked) |
| **Pubsub** | 18-line `pubsub.js` breaks the storage→UI dependency edge for the save-dot indicator |
| **Tests** | Jest unit tests for `currency`, `date`, `month`, `csv`, `payroll`, `calc-prod` (38 cases, all green, run-time <1s); existing Playwright suite still passes (31 cases) |
| **Construction overlay** | Removed entirely (CSS + HTML + JS) per audit Blocker 3 ruling |
| **Service worker** | Cache name bumped to `sep-v2.1.0-alpha.1`; new asset list covers split CSS + bundle |

### Architectural Choices Made During Implementation

These extend or refine the Session 8 charter and the Session 11 / Cowork-12+ architecture lock:

1. **Test-compatibility shim on `window`.** Existing Playwright tests call `window.openInvoiceModal()`, `window.markAtt()`, `window.setProdCap2()`, `window.confirmProduction()`, `window.submitInvoiceForm()`, etc. Modular `dashboard/main.js` deliberately re-exports these onto `window` so the tests still pass. The architectural goal of the 7-layer rule is met by the import graph (every module imports only from below); the `window.*` surface is presentation-layer shimming, not a layer violation. Same shim resolves template-emitted inline `onclick` handlers without converting all ~70 emit sites in this session — see "Deferred" below.

2. **Static-markup `data-action` delegation.** The static HTML in `index.html` (header buttons, FAB toggle, primary-CTA buttons, export buttons) uses `data-action="fnName"` resolved by a single document-level click handler in `dashboard/main.js`. Template-emitted inline `onclick`s in JS-string literals (~70 sites across tab renderers, picker, confirm, settings panel, invoice modal/detail) **were not converted** — the volume is large and tests script through them anyway. Mechanical conversion is queued as a follow-up cleanup.

3. **Layer-1 calc promotions.** Per audit recommendation 4: `payroll.js` (calcDayWages, calcMonthWages, calcCWWeeklyPay, calcPermMonthlyPay, getAttKey) and `calc-prod.js` (initProdDay, getReq, recalcExtra) live in Layer 1, refactored to take all dependencies as arguments. They are the highest-leverage Jest test targets — confirmed by the new unit tests covering the load-bearing financial math.

4. **`recordCWAdvance` + `recordAdvance` rely on `window.saveProdDay` / `window.initProdDay`.** Avoids a Layer-5↔Layer-5 dependency edge for the production-timeline write that happens as a side effect of advance recording. Documented inline.

5. **TypeScript + Zod deferred.** Stage A acceptance lists "TypeScript + Zod added to dependency tree" as item 8. Not added — these belong with Stage B's Firebase + schema validation, where Zod earns its keep at the storage write boundary. Adding TS tooling to the empty bundle just to satisfy the checklist would have been ceremony for ceremony's sake.

### Stage A Acceptance Criteria — Status

| Criterion | Status |
|---|---|
| Extract CSS into `src/css/` (tokens / base / components / responsive) | ✅ |
| Split JS into 7-layer `src/` structure with shared/dashboard/handler entry points | ✅ |
| Replace ~80 inline `onclick` handlers with `addEventListener` / delegated `data-action` | 🔶 Partial — static markup converted (~10 sites); template-emitted onclicks (~70 sites) deferred |
| Delete construction overlay (~370 lines) | ✅ |
| esbuild config with multi-entry support | ✅ |
| npm scripts: `build`, `dev`, `test` | ✅ |
| Jest setup for `utils/` + `migrations/` + `derivations/` | ✅ utils only — migrations / derivations live in Stage B |
| TypeScript + Zod added to dependency tree | ⏭ Deferred to Stage B |
| v2.1 functionality preserved end-to-end | ✅ — 31/31 e2e tests pass |
| Layer rule enforced via lint or build check | ⏭ Soft enforcement via import graph; no lint check yet |
| CSS uses tokens | ✅ |
| Multi-entry esbuild builds dashboard + handler bundles | ✅ |

### Deferred (Beyond Stage A)

- **Stages B–H of Session 13** — Firebase project + Firestore schema + security rules + Cloud Functions + handler PWA forms + dashboard viewer + adoption rollout + alpha deploy. The kickoff scoped these as ~35 additional hours of work on top of Stage A's ~6h. Not started this session per user's MVP-scope decision.
- **Template-emitted inline `onclick` refactor** (~70 sites). Mechanical work; safe to do incrementally as each tab is touched in subsequent sessions.
- **TypeScript adoption.** Recommended once Zod schemas land at the storage boundary in Stage B.
- **Layer-rule lint check.** Could be enforced via a custom esbuild plugin or `eslint-plugin-import` resolver. Not blocking for alpha.

### Known Risks / Watch-fors

- **`window` shim is the only seam keeping inline-onclick templates working.** Any future build setup that drops the shim breaks the production tab, finance pay-cards, settings panel, etc. Documented loudly in `dashboard/main.js`. The cleanup path is the deferred onclick refactor (item 2 above).
- **`sw.js` cache name bumped.** First time a v2.1 user loads the alpha, the SW will discard the old cache and re-cache from network. Expected behavior; documented in `sw.js`.
- **Bundle size: 126 kB unminified.** Well under the 800 kB budget from Session 12 §3. `pnpm build` could add minification later for production.

### Test Results (Session 13 close)

- **Unit (Jest, jsdom):** 6 suites · 38 tests · 0.93s · all green
- **E2E (Playwright @smoke):** 31 tests · 8.4s · all green
- **Build (esbuild):** dashboard.js 125.8 kB · handler.js 0.9 kB · 24 ms

### Files Touched / Created

```
package.json, esbuild.config.mjs, jest.config.cjs           — build tooling
sw.js, manifest.json (kept), public/manifest-handler.json   — PWA + N-PWA
index.html, entry/handler/index.html                         — entry HTML
src/css/{tokens,base,components,responsive}.css              — Charter Decision 4
src/shared/pubsub.js                                         — 18-line bus
src/shared/utils/{currency,date,format,month,csv,calc-prod,payroll}.js   — Layer 1
src/shared/storage/{storage,keys,state,workers,attendance,production,stock,invoice,settings,lock}.js — Layer 2
src/shared/config/{workers,areas,wage,stock,invoice,app}.js  — Layer 3
src/components/{save-dot,dark-mode,fab,worker-picker,settings-panel,invoice-form,invoice-detail,print-pay,alerts}.js — Layer 4
src/dashboard/tabs/{home,attendance,production,finance,finance-export,invoice,stock,history}.js — Layer 5
src/dashboard/main.js                                        — Layer 7 (orchestrator + window shim)
src/handler/main.js                                          — Phase 2.0 handler stub
tests/unit/{currency,date,month,csv,payroll,calc-prod}.test.js — 38 unit cases
tests/e2e/sw_install.spec.ts                                 — cache-name lookup updated
```

### Next Session

Stage B: Firebase project setup, Firestore schema deployment, security rules, storage layer Zod validation, Cloud Functions skeleton, audit log, App Check. Expects ~8h active work; needs Firebase project access + GitHub PAT (currently deferred per Session 11 charter "GitHub PAT: deferred until Phase 2.0 code is complete" — that condition is now met).

The handler PWA forms (Stage C–D) and dashboard viewer (Stage F) follow.

*Stage A documented 7 May 2026 by Aurelius (Claude Code Session 13).*

---

## Session 13: Stage C — Handler PWA Shell Lands (9 June 2026)

### What Shipped

The notebook-handler app's UI shell — Stage C of the Session 13 kickoff and the first build on top of Stage A's modular foundation. The handler bundle graduates from a navigable stub to a working data-capture surface: three-layer screen hierarchy, the universal form template engine driving all 9 forms, big-button pickers, an offline write queue with an explicit-copy sync chip, Devanagari-primary i18n with long-press TTS, and multi-modal submit confirmation. Built **frontend-only** — the Firestore transport is a documented seam (`setTransport()` in `sync.js`) that Stage B fills; until then writes queue locally and the chip reads "Saved on phone, not yet sent (N)", which is honest rather than fake.

Per the kickoff's "ship a smaller MVP that works" guidance, Stage D's heavy machinery (Zod schemas, full pre-fill defense bundle, CF-mediated cross-doc validation, custom Devanagari numpad) is deliberately deferred — the shell is the substrate those plug into, and it's complete and tested.

### Deliverables

| Area | Detail |
|---|---|
| **CSS** | `src/css/handler.css` — handler-only shell styles + the `--tap-target-min: 64px` / `--numpad-key: 80px` gloved-hand tokens (Phase 7 BLOCKER). Consumes `tokens.css`; does not touch the dashboard's component classes |
| **IndexedDB** | `src/handler/idb.js` — zero-dependency key-value wrapper (no idb-keyval dep added to the offline bundle); prefix-scan for drafts + queue |
| **i18n** | `src/handler/i18n.js` — Devanagari-primary / English dictionary (every key carries both; unit test fails CI on a gap), `setLang` persistence, long-press TTS via Web Speech API with Hindi-voice preference + silent fallback |
| **Feedback** | `src/handler/feedback.js` — multi-modal submit confirmation: toast + 50ms haptic + 880Hz Web Audio tone (mutable); each channel feature-detected, degrades silently |
| **Sync** | `src/handler/sync.js` — IndexedDB write queue, transport seam, `flush()`, chip state machine (synced/syncing/offline/rejected), pre-flush confirmation modal, sync-status sheet, shared modal primitive |
| **Recent log** | `src/handler/recent.js` — last-10 submitted entries with queued/synced status, IndexedDB-backed |
| **Form engine** | `src/handler/form.js` — universal template: field kinds (picker/select/number/text/notes), 200ms-debounce draft auto-save, resume-draft dialog, idempotency key on open, inline validation, last-value pre-fill entry point, queue-on-submit |
| **Picker** | `src/handler/picker.js` — big-button grid sheet (≥120×80px cards, recent-first, tier/method tags, typeahead fallback) |
| **Forms registry** | `src/handler/forms-registry.js` — all 9 forms (Production, Job Receipt, DFT, Dispatch, Stock Refill, Stock Depletion, Machine State, Check-In, Note) with icons, modes, fields, picker sources seeded from config + static job/customer/supplier lists |
| **Shell** | `src/handler/main.js` — rewrite of the stub: top bar (clock/shift/name/chip/gear), home (tile grid + recent log), per-form routing, settings sheet (language + sound + name), boot with pre-flush check + SW registration |
| **Service worker** | `entry/handler/sw-handler.js` — handler-scoped SW (`/sep-dashboard/entry/handler/`), best-effort install, separate cache from dashboard |
| **Entry HTML** | `entry/handler/index.html` — links `handler.css`, `lang="hi"`, `.h-app` root |
| **Tests** | +13 unit (`i18n` dictionary completeness + `t`/`setLang`; `handler-sync` pure `summarizeQueue` + `chipState`) → 51 unit total. +6 e2e (`handler_shell.spec.ts`: 9 tiles, 64px floor, chip copy, language toggle, submit→toast→recent log, required-field block) → 37 e2e total. All green |

### Architectural Choices Made During Implementation

1. **Sync transport is an injectable seam, not a stub-that-lies.** `sync.js` exposes `setTransport(fn)`; the default rejects, so records stay queued and the chip honestly reports them as unsent. Stage B injects a Firestore writer and the whole queue/flush/recent-mark pipeline lights up unchanged. No fake "success" states in the alpha shell.

2. **64px floor applies to data-entry targets, not the status chip.** The kickoff's CSS lists `button, .tile, .field-action, .picker-row` at 64px. The top-bar sync chip is a compact glanceable status pill (~30px) — making it 64px would bloat the bar. The e2e test enforces the floor on tiles + gear + form buttons, and separately asserts the chip carries explicit text (never colour-only). Documented in the test.

3. **Pure logic split out for testability.** `summarizeQueue` and `chipState` are dependency-free pure functions in `sync.js` so they unit-test in jsdom without IndexedDB; the IndexedDB-touching paths are exercised by the e2e browser run. Same discipline as the Layer-1 calc promotions in Stage A.

4. **Zero new runtime dependencies.** HANDLER_UI_SHELL.md suggested idb-keyval; the offline-first bundle stays dependency-free with a ~70-line `idb.js`. Keeps the handler bundle small (39.7 kB unminified) and the offline story self-contained.

### Stage C Acceptance — Status

| Criterion (HANDLER_UI_SHELL.md) | Status |
|---|---|
| PWA installable on Android at `/sep-dashboard/entry/handler/` | ✅ manifest + scoped SW; on-device Chrome/Firefox install unverified (no device in CI) |
| All 9 form screens implement universal template | ✅ |
| 64px touch target enforced via CSS tokens; verified via automated UI test | ✅ |
| Devanagari labels primary; English toggle; long-press TTS | ✅ (TTS feature-detected; best-effort on devices without Hindi voice) |
| Multi-modal submit confirmation (toast + haptic + audio) | ✅ (toast e2e-verified; haptic/audio feature-detected, on-device unverified) |
| Form draft auto-save: recovers on screen-wake / tab close | ✅ (200ms debounce → IndexedDB; resume dialog) |
| Big-button picker grid: 64px+ cards, recent-first, typeahead fallback | ✅ (recent-first cache hydration from Firestore is Stage B/D) |
| Sync chip + queued counter + pre-flush confirmation | ✅ |
| Explicit offline copy; no colour-only chips | ✅ |
| Recent Entries log on home (last 10, ⏳ for queued) | ✅ |
| iOS Safari officially unsupported | ✅ documented (Android-only; per Phase 7) |

### Deferred (Stage D and beyond)

- **The 9 forms' field-level specs** (HANDLER_FORMS.md) — Zod schemas, full pre-fill defense bundle (visual diff + 15-min decay + job-completion clear + first-of-session confirm step), sanity hard-blocks beyond the basic positive/DFT-range checks here, CF-mediated cross-doc validation for Production/DFT/Dispatch. The engine + registry are ready for them.
- **Picker cache hydration from Firestore** — currently seeds from config + static job/customer/supplier lists. Real recent-first cache lands with Stage B sync.
- **Custom Devanagari numpad** — numeric fields use `inputmode="numeric"` + extra-large mono display for now.
- **Recorded-MP3 TTS fallback** for older Android without Hindi voice.

### Test Results (Stage C close)

- **Unit (Jest, jsdom):** 8 suites · 51 tests · ~1.4s · all green
- **E2E (Playwright):** 37 tests (31 prior + 6 handler) · ~10.6s · all green
- **Build (esbuild):** dashboard.js 123.3 kB · handler.js 39.7 kB · shared chunk 3.7 kB · ~31 ms

### Next Session

Stage B: Firebase project + Firestore schema + security rules + Zod at the storage boundary + Cloud Functions skeleton + audit log + App Check. The handler's `setTransport()` seam is the first integration point — wiring it drains the local queue to Firestore. Needs Firebase project access + GitHub PAT (Stage A's "code complete" precondition is now met).

*Stage C documented 9 June 2026 by Aurelius (Claude Code Session 13).*


---

## Session 14: Stage B Lands + Track 2 Ignition (10-12 June 2026)

### What Shipped

The backend went from design to **live**. Three arcs across PRs #16-#20, all merged:

**Arc 1 — Stage B Track 1 (PR #16, 10 Jun):** sep-internal ground truth wired into the Phase 2 data model. Schema v2 ratified (challan = 1 Job + `job_lines[]` subcollection — v1's one-job-one-item didn't survive multi-line challans); pure idempotent sep-invoicing→Firestore importer with challan-collision stats; Zod v2 schemas at the write boundary; pure cross-doc validators; CF skeletons; picker-cache seam replacing Stage C's placeholder lists.

**Arc 2 — Rules harness (PR #17, 10 Jun):** Firestore rules emulator test package (`tests/rules/`, standalone npm pkg), isolated path-filtered CI, v2 alignment + hardening — caught a spoofable job author, a bypassable DFT re-validation, and a lexicographic version compare silently defeating stale-build rejection.

**Arc 3 — Track 2 ignition (PRs #18-#20, 11-12 Jun, this session):** staging project created by Rishabh (`sep-dashboard-staging`, asia-south1, production-mode); client wiring (env-keyed config, dynamic-import `firebase-boot.js`, `transport.js` pure record→doc mapper, `setTransport()` injection, picker hydration via listeners, queue hardening with a rejected-record store); admin plane as a `workflow_dispatch` GitHub Actions workflow consuming the `FIREBASE_SERVICE_ACCOUNT_STAGING` repo secret (deploy-rules / mint-token / seed-dry-run / seed-fixture / verify-e2e); hardened rules published; fixture seeded; Authentication initialized; **live end-to-end verification green** — self-mint → sign-in → real transport write accepted by the deployed rules → read-back → idempotent replay correctly denied by rules and resolved by the transport.

### The Review Pass (workflow convention upheld)

7-angle `/code-review` (3 correctness + reuse/simplification/efficiency/altitude) before merge: ~36 candidates → 16 findings folded. Highest-severity: server `permission-denied` wrongly classified permanent (data-loss path — rules read mutable state, so a token rotation would have swept a day's queue into a discard-only store); dead challan-collision guard in the seed (`jobIdCollisions` is a count, not an array); dashboard `sw.js` cache not bumped while chunk hashes changed (would have bricked installed dashboards on deploy); GitHub Actions script injection via `${{ inputs }}` in a secret-bearing job. Full detail in `docs/architecture/DECISION_LOG.md` §10-12 June.

### Test Results (Session 14 close)

- **Unit (Jest):** 114 · **E2E (Playwright):** 37 · **Rules (emulator):** 27 (incl. importer-parity + transport-parity) — all green
- **Live:** `verify-e2e` workflow run green against staging (run 27410465556)

### Operational State

| Item | Status |
|---|---|
| Staging Firestore + hardened rules + Auth | ✅ LIVE |
| Seed/mint/verify one-click via Actions | ✅ |
| `deploy-rules` via Actions | 🔶 needs IAM roles on the SA (Rules Admin + Service Usage Consumer); console-publish used this round |
| Real 508-challan seed | ✅ **LIVE (12 Jun)** — 2,494 docs (21 customers · 729 items · 508 jobs · 1,236 job lines) via soma-internal's `seed-staging` workflow (private-data/public-code split); dry run caught 107 challan collisions → job-id ruling `sep-{IM source id}` (PR #22, SCHEMA_CHANGELOG v2.1) |
| Prod project | ⏳ not created (same runbook as staging) |
| First provisioning (Champai, T-CH in soma-internal) | 🔶 device IN HAND (12 Jun); dry-run on Rishabh's own device first — `mint-token` → QR → install → chip green → seeded pickers → one round-trip entry |

### Addendum (12 Jun, late session): the real seed landed

PRs #21-#22 + soma-internal #52-#53 closed the day: the **full FY27 seed is live in staging** (2,494 docs, counts reconcile exactly; `min_supported_build` untouched by the create-only guard — fleet-safe re-seeds proven). The dry-run-first discipline paid twice: the collision guard (dead code before the review pass) caught **107 customer-challan collisions** → `Job.id` = `sep-{IM source id}` ruling; one blank form row skipped + counted. Seed infra: the export lives in private soma-internal, whose `seed-staging` workflow checks out this public repo for code — business data never enters this repo.

### Next Session (targets set by Rishabh, 12 Jun — in order)

1. **IAM roles** on the staging service account (Firebase Rules Admin + Service Usage Consumer) → re-run `deploy-rules` → the admin plane's last console-manual gap closes.
2. **Provisioning dry-run on Rishabh's own Android first** (Champai's device already in hand): `mint-token` → `#token=` URL on-device → install SEP Handler → sync chip green → pickers hydrate from the seed → one entry round-trips.
3. **Build:** Stage D form completion in the soma-internal evidence order (OT/check-in → production rounds → pickling/IM → chemistry → power-cut; Vesta's cadence brief, 11 Jun) + Stage F minimal viewer (activity stream + `reports/daily/*` KPI strip + NIL/overdue warnings). Known Stage D skews: stock-refill cost/supplier requiredness; `passivation` station modelling. App names locked: **SEP Dashboard / SEP Handler** (Rishabh, 11 Jun).

*Session 14 documented 12 June 2026 by Aurelius (Claude Code); addendum same day at close.*

---

## Session 15: Stage D Forms + Stage F Live Viewer (12 June 2026)

### What Shipped

The build leg of the 12 Jun next-session targets (T-CN ③ in soma-internal).
**Stage D**: all five evidence-order form completions landed — check-in OT
slot (T-CH), production rounds × round-size, job-receipt challan/NOS,
stock-depletion reason + NIL level-after, power-cut/incident notes with
priority. **Stage F**: a new **Live tab** on the dashboard — activity
stream + today's KPI strip + NIL/overdue warnings, reading staging
Firestore through the same #token sign-in path the handler uses.
Both Stage D skews ruled and documented (SCHEMA_CHANGELOG v2.2): stock
receipt cost/supplier now optional rules-side (zinc-PO evidence);
passivation stays folded into plating.

### Key Decisions

- **Rules relax over form tighten** for stock receipts — receipt-time cost
  is routinely unknown (unpriced challans); fake costs would corrupt the
  weighted-average rollup. Costless refills queue as transient denials
  until the relaxed rules deploy, then drain — no rejected-store sweep.
- **Collection-group read matches** (`shifts`, `depletions`) added for the
  Live viewer; writes stay path-scoped. No-orderBy CG queries avoid
  composite indexes.
- **`firebase-session.js` extracted to shared** — the handler's verified
  boot + #token sign-in now serves both PWAs; firebase-boot.js consumes it.
- **Form engine**: `required` may be state-dependent; fields may declare
  defaults (clock-inferred check-in slot).
- **`challan_no` on handler-entered jobs** (label, not key — 107-collision
  ruling stands); job picker reads it or the importer's legacy field.

### Test Results (Session 15 close)

- **Unit (Jest):** 124 · **E2E (Playwright):** 38 (Live smoke added) ·
  **Rules (emulator, run locally this session):** 30 — all green
- **Build:** BUILD=2, APP_VERSION 2.1.0-alpha.3, both SW caches bumped

### Operational State (delta from Session 14)

| Item | Status |
|---|---|
| `deploy-rules` via Actions | 🔴 still 403 — IAM grant NOT yet applied (re-verified this session, run 27414658171); v2.2 rules await it |
| Provisioning dry-run | ⏳ physical step — mint-token (1 h validity) when Rishabh is at the device; Live tab gives the dashboard-side proof surface |
| Stage D forms | ✅ field-complete per evidence order; Zod-at-form-boundary, 2σ prompts, CF cross-doc validation still deferred |
| Stage F viewer | ✅ minimal cut live in code (activity/KPI/alerts); full DASHBOARD_VIEWER.md surface remains 2.1 |

*Session 15 documented 12 June 2026 by Aurelius (Claude Code).*

---

## Session 16: Dashboard Edit UI + Steward Inboxes (13 June 2026)

### What Shipped

The dashboard-side **correction surface** — the answer to the on-device dry-run's
"edit/history missing". The SEP Handler is append-only by design (last-10 recent
log only); every correction beyond its rules-enforced 24h window lives on the
dashboard, performed by the admin/steward identity it signs in as. A new **Edit
tab** (sep-dashboard PR #26): records-by-category with an edit-with-reason modal,
per-record revision history, and the steward inboxes as honest read surfaces.
Scoped against `DASHBOARD_VIEWER.md` (recent-by-category + edit affordance) and
`STEWARD_AFFORDANCES.md` (edit-with-reason + inboxes).

### Deliverables

| Area | Detail |
|---|---|
| **Edit tab** | `src/dashboard/tabs/edit.js` — **Records** view (recent-by-category: Production / Jobs / DFT / Dispatch / Notes / Check-ins / Depletions, read from the same staging Firestore the Live tab uses via the shared memoised session); **Edit-with-reason modal** (structured reason enum + optional evidence ref); **History** view (per-record revision trail); **Inboxes** view (pending-conflicts / anomaly / steward KPI). |
| **Edit model** | `src/dashboard/edit-model.js` — pure `buildEditPayload` / `REASON_ENUM` / per-type `FIELD_SPECS` / `summarizeRevision`. The edit writes the changed fields **plus an append-only on-doc `revisions[]` entry** (STRUCTURED_NOTES pattern) — the forensic record that works **today, without the audit-event CF**, which mirrors the same change to `audit_events` server-side once deployed. |
| **Shared extraction** | `src/dashboard/stream-format.js` — per-collection activity formatters + `fmtTime`/`fmtAge`, now shared by Live + Edit (de-dups the Live tab). |
| **Session memoised** | `firebase-session.js` memoised so both tabs share one Firebase app (a second `initializeApp` would throw); a **rejected** boot is not cached, so "re-open to retry" stays real. |
| **Tests** | +39 unit (`edit-model`, `stream-format`) → **168**; +1 e2e honest-state (`edit_tab.spec`) → **39**; +3 rules-emulator edit-contract (admin-edit-past-24h-window · admin job-status-flip · steward-edits-notes-not-production) → **33**. Build `BUILD=2`, `APP_VERSION 2.1.0-alpha.5`, both SW caches bumped. |

### Key property: no rules deploy required

Admin updates are already permitted on every editable collection via the
`isAdmin() ||` short-circuit in the deployed v2.2 rules — so the Edit UI works
against staging **as-is**, independent of the IAM-gated `deploy-rules` path.
Steward edits are scoped to notes (rules-honest). The 3 new rules-emulator tests
lock this contract so a future rules change can't silently break the tab.

### Review (workflow convention upheld)

A 7-angle `/code-review` ran (3 correctness + reuse/simplification/efficiency/
altitude). Findings folded across two rounds:
- **edit-modal attribute XSS** — `__path` interpolated into an inline `onclick`
  JS-string; now `encodeURIComponent`/`decodeURIComponent` round-tripped (the
  same sink class the 12-Jun picker review caught).
- **out-of-enum `<select>`** — modal selects now carry an explicit empty option.
- **memoised-rejection trap** — a rejected boot was cached, killing retry; now
  the slot clears on rejection.
- **boot `'error'` dead-end** — `renderEdit`/`renderLive` only retried from
  `'idle'`, so the "re-open to retry" card was a lie and the memoisation reset
  never fired; both tabs now retry from `'error'` too.
- **token-refresh flicker** — claims now resolve *before* listeners are torn
  down/rebuilt, closing the window where an admin's Edit buttons flicker
  non-editable.

### Out of scope (honest deferrals, tracked)

- **Inbox disposition writes** (retry/discard/annotate, anomaly close) — need the
  steward-disposition + anomaly-detector CFs (`_rejected_writes` / `audit_events`
  / `kpi_snapshots` are all `allow write: if false`). Rendered as deferred seams,
  not faked.
- **Stock receipts editing** — no collection-group read rule for `receipts`
  (would need per-item listeners).
- **Shared `firestore-store`** — the Edit tab forks the Live tab's listener
  scaffold; a shared store to de-dup the two (and the boot state-machine) is the
  review's altitude recommendation, kept separate this round to avoid
  destabilising the on-hardware-proven Live surface. Tracked as a fast-follow.
- **Field-clearing** — the edit surface can set values but not clear them
  (blank = no-change, documented). The one scenario this blocks (correcting a
  wrong-*unit* production entry) is near-unreachable: the handler derives the qty
  unit from the machine and `machine_id` isn't editable. Tracked, not folded.

### Next build

**Stage E aggregator Cloud Function** — flip `Job.current_status` on dispatch
(handler writes `dispatch_events` but never flips status; until it ships,
dispatched jobs re-accumulate in the picker, and the Edit tab's manual status
edit is the stopgap). Then handler form hardening (Zod-at-boundary / 2σ / CF
cross-doc validation) and the shared `firestore-store` extraction.

*Session 16 documented 13 June 2026 by Aurelius (Claude Code).*

---

## Session 17: Stage E Aggregator CFs — Built, Deployed, Verified Live (14–16 June 2026)

### What Shipped

The **Stage E aggregator Cloud Functions** — the T-CU "next build" — went from a skeleton to **live on `sep-dashboard-staging`**, closing the named dispatch gap (handler writes `dispatch_events` but nothing flipped `Job.current_status`; the skeleton aggregator listened on the `route_history` subcollection the handler never writes, so dispatch reached no aggregator at all). PR #27 (merged `ceecbed`).

### Deliverables

| Area | Detail |
|---|---|
| **Aggregators** | Four idempotent v2 `onDocumentCreated` functions in `functions/src/index.js`: `dispatchStatusAggregator` (`dispatch_events/{id}` → `Job.current_status='dispatched'`, the load-bearing fix), `workerShiftAggregator` (`workers/{wid}/shifts` → `Worker.current_status`), `machineStateAggregator` (`machines/{mid}/state_transitions` → `Machine.current_status`), `routeHistoryAggregator` (kept; route lifecycle). `foldEvent` runs one transaction per parent; job parents required (never fabricated), worker/machine derived parents merge-create + `__derived`; missing-parent logged. |
| **Pure logic** | `src/shared/validation/cross-doc.js`: `applyDispatchEvent` / `applyShiftEvent` / `applyStateTransition` + `shouldApplyEvent` (server-primary + client tiebreaker ordering guard, documented `last_applied_event_id_<sub>` cursor) + `toMillis`. Unit-tested in root Jest (`tests/unit/derive.test.js`). |
| **Deploy plumbing** | `firebase.json` functions block + predeploy vendor (`functions/vendor.mjs` → gitignored `functions/vendor/cross-doc.js`, no source-copy drift); `scripts/deploy-functions.mjs` (installs `functions/` deps then `firebase deploy`) + `deploy-functions` workflow action + pinned `functions/package-lock.json`; shared credential-tempfile helper `withCredentialFile` in `scripts/lib/admin.mjs` (finally-cleanup; used by both deploy scripts). |
| **Behavioural verify** | `scripts/verify-aggregator-staging.mjs` + `verify-aggregator` workflow action: writes one `dispatch_event` for a seeded in-flight job, polls until the CF flips it, then restores the job + deletes the test doc (auto-cleanup, seed-safe). |
| **Tests** | Unit **168 → 181** (derivations + ordering guard incl. duplicate-trigger / out-of-order / `client_ts=0`). No web-bundle change (cross-doc is server/test-only) → no SW cache bump. |

### Live verification (16 Jun)

`verify-aggregator` ran green against staging: a `dispatch_event` flipped its seeded job to `dispatched` in **~4s**, cursor set, then cleanup restored the job to `in-flight/standard` and deleted the test doc. All 17 functions registered (`✔ Deploy complete!`). The deliverable is proven end-to-end, not just deployed.

### The deploy path (now a documented one-shot)

The first-ever v2 Functions deploy walked through a long chain of **one-time GCP project setup** gates, each surfaced as a clean 403/400 at the deploy (by design, not on the floor): **Blaze billing → 6 APIs + cloudbilling → deploy-SA roles (6) → `functions/` deps install (code fix) → vendored-import path (code fix) → service-agent bindings (3) → Eventarc first-time propagation retry.** The complete runbook is folded into `scripts/deploy-functions.mjs`'s header so **prod's first deploy is a one-shot**. Two code fixes were committed mid-deploy (the deps install + the `../vendor/` import path — `node --check` is syntax-only and couldn't catch the latter).

### Review

7-angle `/code-review` across rounds; folded findings include the documented-cursor field naming, a `client_ts=0` coercion bug, observable warning on a missing parent, `__derived` marker, gitignored vendor (drift), the functions lockfile, the shared credential helper, and (this session) an `AGG_MIN_INSTANCES` NaN clamp for the prod path. Tracked fast-follows (non-blocking): **audit-trail noise** on aggregator-derived writes (bookkeeping-heavy `field_changed`, `system`/`cf` attribution — filter before `audit_events` is consumed); **`functions lint`** can't catch broken vendor imports (`node --check` is syntax-only); reconciliation sweep for a dispatch landing before its job; worker/machine LWW client-clock tiebreak; enum guard on machine state/direction.

### Operational State (delta from Session 16)

| Item | Status |
|---|---|
| Stage E aggregators | ✅ **LIVE on staging**, behaviourally verified (T-CV in soma-internal) |
| `deploy-functions` via Actions | ✅ one-click; full first-deploy IAM/API runbook in `deploy-functions.mjs` |
| Prod project | ⏳ not created — same runbook (now documented) applies |
| Dispatched jobs re-accumulating in picker | ✅ resolved once a real dispatch flows (the Edit-tab manual flip retires as stopgap) |

### Next

Handler form hardening (Zod-at-boundary / 2σ / CF cross-doc validation) · the audit-noise + lint fast-follows above · shared `firestore-store` extraction (Live + Edit) · prod project stand-up when ready (runbook is one-shot).

*Session 17 documented 16 June 2026 by Aurelius (Claude Code).*

---

## Session 18: Handler Form Hardening — Zod Write-Boundary + σ-Sanity Net (16 July 2026)

### What Shipped

The first two legs of the long-standing **"handler form hardening"** next-build
(named at Session 16 close, carried through 17): the **Zod write-boundary gate**
and the **σ-outlier sanity net**. Both are 100% client-side, unit- + e2e-tested,
no IAM/deploy gate — the honest single-session unit. The third leg (**CF-mediated
cross-doc validation**) stays deploy-gated: the pure validators already live in
`cross-doc.js`; wiring them into a *deployed* callable is the same Architect GCP
handoff every prior CF was, so it's held as its own build rather than faked here.

### Deliverables

| Area | Detail |
|---|---|
| **Zod write-boundary** | `src/shared/types/handler-writes.js` — per-form schemas for the **mapped Firestore doc** (the exact shape that hits Firestore), one per record type. Each mirrors an `isValidX` predicate in `FIRESTORE_RULES.ref.txt`; the three the rules leave open (**dispatch** job_id, **check-in** direction/slot, **machine-state** state) get their *only* client-side content guard here. Enforced inside `transport.recordToWrite` → a schema miss is a `PermanentRejection`, so it parks in the reviewable rejected-store instead of retrying against the rules forever (rule denials are transient — they read mutable token/build state — so a malformed doc would otherwise wedge the queue). |
| **σ-sanity net** | `src/handler/sanity.js` — pure Welford rolling stats (`{n,mean,m2}`, no history stored) + declared per-field plausibility bounds. `checkRecord` returns `block` (impossible) / `confirm` (unusual) / `ok`; `form.js` surfaces a confirm-step modal echoing the odd values before the record queues. Two nets: declared soft/hard bounds work on the first-ever entry; the rolling σ net (default 3σ, per-field `z`, activates at `MIN_HISTORY=8`) sharpens as entries accumulate. `deriveSanityState` folds production's rounds × round_size into a derived total so a fat-finger round_size still prompts. |
| **i18n** | Four confirm-dialog keys (hi+en; completeness test green). |
| **Version/cache** | `BUILD 2→3`, `APP_VERSION → 2.1.0-alpha.6`, both SW caches bumped (app.js feeds both bundles). |
| **Tests** | Unit **181 → 251** (`handler-writes` 39 · `sanity` 25 · transport-gate 7). E2E **39 → 40** (unusual-quantity → confirm → proceed, on a config-seeded picker path). Build clean; handler bundle 28.4 → 33.6 kB (Zod + sanity). |

### The Review Pass (workflow convention upheld)

7-angle `/code-review` (xhigh) before leaving draft. Four findings, all folded:
- **BUG (correctness):** `hardMin:0` on `level_after`/`cost` made `fieldVerdict`
  block `v <= hardMin`, so **`level_after: 0` — Shyam's NIL stock-take, the
  reorder-alert signal — could never be submitted.** Dropped `hardMin` on the
  two zero-valid fields (negatives already caught by Zod `nonnegative` + the
  form validate). Regression tests added.
- **coverage:** production's *derived* total (rounds × round_size) went
  unchecked — closed via `deriveSanityState` (the most-frequent form's real
  fat-finger vector).
- **cleanup:** dead in-place mutation of the baselines object removed; the
  "2σ" label corrected to an honest "σ-outlier net, default 3σ" (matches the
  per-field `z`), since the code defaults to 3σ to hold prompt-fatigue down.

### Key properties

- **No rules deploy required.** The gate is a client pre-flight; it only ever
  *tightens* what the handler sends (rejecting garbage the rules would either
  bounce transiently or, for the silent enums, accept). Every transport-parity
  case in `tests/rules` stays schema-valid, so the rules suite can't regress.
- **Honest offline story preserved.** A schema miss is `PermanentRejection` →
  rejected-store (reviewable/requeue-able), never a silent drop; the σ net is
  advisory (confirm), never a silent drop either.

### Out of scope (honest deferral)

- **CF-mediated cross-doc validation** (Production / DFT / Dispatch — worker-on-
  shift, machine-not-down, route-valid, no-double-dispatch). Pure validators
  exist in `cross-doc.js`; deploying them in a callable is the IAM-gated leg.
- **Rules emulator suite** not runnable in this container (no firebase CLI /
  emulator jar); unaffected by the diff (no `firestore.rules` change, parity
  confirmed). Run locally / in CI as usual.

### Review Round 2 (pre-merge, 8-angle + adversarial verify)

A second full review pass ran before the ready-flip (8 finder angles → 1-vote
adversarial verify per candidate). **Six CONFIRMED findings, all folded:**

- **TDZ crash (form.js):** the picker pre-fill loop invoked `scheduleDraft()`
  before its `const` declaration — **any reopen of the production form after
  one submit threw a ReferenceError mid-render** (job/part/machine/worker are
  `remember:true`). Undetected because no e2e reopened a form. Declaration
  hoisted above the loop; e2e TDZ-reopen regression added (seeds lastvals via
  IndexedDB).
- **σ-baseline fold gap (form.js):** `updateBaselines` folded raw state while
  `checkRecord` judged the derived state — in rounds-mode production (the
  register's native grain) the `quantity` baseline never accumulated, so the
  rolling net could never activate for the derived total. Now folds
  `deriveSanityState(...)`.
- **Outlier pollution (form.js):** a confirmed-unusual value was folded into
  the very baseline it was flagged against — one waved-through outlier
  inflated σ enough that the next identical fat-finger passed silently.
  Flagged fields now skip the fold.
- **Path-segment queue wedge (transport.js):** the Zod gate validated only
  `w.data`, never the path fields (`worker`/`item`/`machine`) — a stripped
  record passed the gate, then `fs.doc()` threw an SDK error the flush loop
  classifies TRANSIENT, wedging the queue forever. Path segments now asserted
  non-empty strings → `PermanentRejection` → rejected-store. Unit-tested ×3.
- **DFT 50 µm unenterable (sanity.js):** `hardMax: 50` blocked `v >= 50` while
  every other layer (rules `<= 50`, Zod `.max(50)`, form `> 50`) accepts
  exactly 50 — the one legal boundary reading forced falsification. hardMax
  dropped (form validator owns the `> 50` bound; softMax 30 keeps the confirm).
  N.B. a uniform `>`-for-`>=` operator change would have been WRONG: quantity's
  cap mirrors an exclusive rules bound (`< 100000`).
- **SW cross-cache wipe (sw.js, pre-existing since Stage A):** the dashboard
  SW's activate deleted EVERY origin cache ≠ its own name — including the
  handler PWA's (`sep-handler-*`), whose entry assets only repopulate on a
  handler SW re-install. **Every dashboard cache bump silently broke handler
  offline support on dual-install devices.** Cleanup now spares the
  `sep-handler-` namespace.

Also folded: whitespace-only quantity trap (trim-aware guards in
`fieldVerdict`/`checkRecord`/`deriveSanityState` — `Number(' ')===0` hit
hardMin blocks on a blank-looking field); raw-hex `--danger` fallback in
handler.css (mismatched the token, broke dark mode if ever hit); stale "2σ"
labels corrected to "σ (default 3σ)" across comments/test names.

**Post-fold tests:** unit **257** (+6 regressions) · e2e **41** (+1 TDZ reopen)
· build clean. dist chunk hashes rotated (handler-side only; verified no stale
references; both SW cache names already bumped this PR).

**Tracked fast-follows from this round (not folded — real but not blockers):**
- **Unit-blind σ baselines** — production `quantity` pools VAT pcs with barrel
  kg; stock forms pool all items into one distribution. Needs per-machine-group
  / per-item baseline keys before the rolling net is trustworthy at n≥8.
- **zod → zod/mini** — zod classic puts ~530 kB unminified (~80 kB gz) into the
  handler's boot-critical `firebase-boot` chunk (the tracked 34 kB handler.js
  number hides it); `zod/mini` measures ~19× smaller. Mechanical API rewrite.
- **Schema single-sourcing** — `JobReceiptWrite` re-declares `JobSchema`'s
  shape + hardcodes the status enum vs `JOB_STATUSES`; the station enum
  re-spells `RULE_STATIONS`; the DFT 50 cap lives in 3 files; the production
  qty derivation is mirrored in sanity.js vs transport.js. Hoist shared
  fragments/constants; add a coupling test.
- **Edit-tab writes bypass the gate** — admin edits skip both rules content
  validation (`isAdmin()` short-circuit) and `validateWrite`; route
  `buildEditPayload` output through the same schemas.
- **rules-CI installs all prod deps** — the parity import graph needs only
  zod; `--prod` drags the full Firebase SDK (~30-60 s/run).
- **Submit-path serial IDB writes** — 3 bookkeeping awaits before the toast;
  parallelize or fire feedback after enqueue.

### Next

CF cross-doc validation (deploy-gated) · the Round-2 fast-follows above
(σ-baseline unit keys + zod/mini first) · the Session-17 fast-follows
(audit-noise filter, `functions lint` gap) · shared `firestore-store`
extraction (Live + Edit) · prod project stand-up.

*Session 18 documented 16 July 2026 by Aurelius (Claude Code); Round-2 review
folded same day.*

---

## Session 19: The Four Fast-Follows — Single-Sourcing, zod/mini, Unit Keys, Edit Gate (20 July 2026)

### What Shipped

All four Round-2 fast-follows, built in dependency order in one session:

1. **Rule-bounds single-sourcing** — new `src/shared/types/rule-bounds.js`:
   dependency-free constants for every rules bound/enum the client encodes
   (QTY_MAX exclusive · PCS_MAX exclusive · **DFT_MICRON_MAX inclusive** —
   inclusivity documented per constant, per the Round-2 lesson) + the ONE
   production-quantity derivation `deriveTotalQty` (trim-aware), now consumed
   by BOTH transport's mapper and sanity's `deriveSanityState` — the judged
   number and the landed number come from one function. Consumers rewired:
   schemas.js, forms-registry (dftRange), sanity (caps), transport (stations +
   derivation), edit-model (select options). Also fixed en route: `buildRecord`
   + the transport mapper were still whitespace-blind (a `' '` quantity became
   an explicit `Number(' ')=0` total → PermanentRejection despite valid rounds).
2. **zod → zod/mini** in `handler-writes.js`, restructured as per-type
   **CONTENT field maps** (flat field→schema) + cross-field REFINES applied
   only on the full doc. **Measured: firebase-boot chunk 553.8 kB → 8.9 kB**,
   with zod/mini + schemas in a **36 kB shared chunk** used by both bundles
   (esbuild splitting; dashboard now imports the same schemas via the edit
   gate). ~15× cut on the boot-critical path.
3. **Unit-keyed σ baselines** — `statKey(type, field, state)` scopes rolling
   stats: production per **machine-group** (VAT pcs vs barrel kg), stock forms
   per **item**; declared bounds stay unscoped (physical impossibility doesn't
   depend on the machine). checkRecord reads and updateBaselines writes the
   same scoped key; old unscoped stats orphan harmlessly (no real floor data
   yet — the reason this shipped BEFORE rollout). Unit test pins: a mature VAT
   baseline never judges a barrel entry.
4. **Edit-tab schema gate** — `validateEditField(collection, key, value)`
   exported from handler-writes (CONTENT gives per-field schemas for free);
   `buildEditPayload` refuses out-of-bounds edits (micron 500, status typo)
   with the field named. Admin writes short-circuit the rules' content checks
   (`isAdmin() ||`), so this is the ONLY content guard on the edit path.
   Fields the rules don't judge (notes, challan_no) stay freely editable;
   cross-field refines deliberately don't apply to partial edits (documented).

### Tests / Versions

Unit **257 → 275** (rule-bounds derivation + coupling suite pinning registry
options ⊆ enums, edit options ⊆ enums, sanity caps = rules caps, the
inclusive/exclusive boundary semantics, statKey scoping, edit-gate accept/
refuse) · e2e **41** · build clean. `BUILD 3→4`, `APP_VERSION 2.1.0-alpha.7`,
both SW caches bumped.

### Still Open (unchanged queue)

CF cross-doc validation (deploy-gated) · Session-17 fast-follows (audit-noise
filter, `functions lint` gap) · shared `firestore-store` extraction · prod
stand-up · smaller Round-2 leftovers (rules-CI prod-deps trim, submit-path
IDB serialization) · stale PRs #13/#14 rebase-or-close.

### Review Pass (pre-ready-flip, 5-angle + fold)

3 correctness + combined-cleanup + conventions finders (the heavy cleanup
angles had their say in Round 2 — this PR is that cleanup). Folded:

- **Edit gate cross-field gap** (2 finders): per-field validation passed
  `qty_pcs: 0` even when it zeroed the doc's only quantity. Now: CROSS_CHECKS
  (plain predicates, single-sourced) feed both the write schema's refines AND
  `validateEditedDoc(merged, changedKeys)` — scoped to run only when the edit
  touches an involved field, so unrelated corrections on legacy docs aren't
  held hostage.
- **Factor-pollution skip gap** (2 finders): a flagged DERIVED quantity
  skipped the fold, but the causal rounds/round_size still folded — the
  Round-2 pollution fix one level down. Flag on `quantity` now also skips the
  factors; judged state hoisted to one local (`judged`) so check/fold can't
  diverge.
- **Scoping hardening** (2 finders): pickling areas now key their own
  distributions (`vat-pickling` / `barrel-pickling`, via DEF_AREAS dep);
  scoped forms never fall back to the legacy pooled key (unresolved scope →
  `@?` bucket, not the polluted pre-scoping stats).
- **dispatch.weight_kg upper bound** — rules are silent on dispatch, so the
  schema is the only guard; it now carries `lt(QTY_MAX)`.
- **undefined-value guard** in recordToWrite (setDoc throws on undefined →
  transient-classified → queue wedge; now PermanentRejection) — generalises
  the stock_refill refine's accidental old-shape protection.
- **cross-doc coupling test** — cross-doc.js stays dependency-free (CF
  vendoring), so a root Jest test tethers its DFT literals to rule-bounds;
  restructuring the vendor layout is deferred to a deploy-verifiable session.
- Smaller: `--font-mono` → `--ff-mono` (undefined token); stale sw.js size
  comment; checkRecord's duplicate absent-guard removed (fieldVerdict is the
  one owner); shared `issueReason` formatter.

**Not folded (tracked):** deriving registry OPTS from the enums (needs a
value→labelKey map; the coupling test pins ⊆ but not ⊇, so an enum ADDITION
still needs a manual registry touch) · rules-CI prod-deps trim · whitespace-
padded picker-id trim-vs-drop nuance.

**Post-fold:** unit **279** · e2e **41** · build clean.

*Session 19 documented 20 July 2026 by Aurelius (Claude Code); review pass
folded same day.*

---

## Session 20: Work Areas + EXTRA — the Establishment Contract (11 August 2026)

### What Shipped

Not a feature — a **definition**, and the config defects it exposed. soma-internal ratified a canonical area / station / establishment model on 11 Aug (`operations/work-areas.md`) and this repo was one of **seven** live area vocabularies that disagreed. `DEF_AREAS` is now the code-side carrier of that contract.

Ran the full canon-cc-008 QA chain (Castor · Vulcanus · Janus in parallel → Vesta synthesis). **All three returned AMEND.** Everything below is post-fold; several claims in the first cut did not survive and are marked as withdrawn rather than deleted.

### The ruling being carried

Two axes, because pickling is **one physical area** (Area 4, six tanks) and **two staffing slots** (split by whether it feeds VAT or barrel):

- **`area`** = physical place → new `DEF_FLOOR_AREAS` (Area 1–4, machine counts, station lists)
- **`station`** = crew-assignment slot → the existing `DEF_AREAS` ids, now carrying `area` + `establishment`

**Establishment**: `vat_a1` 4 · `vat_a2` 4 · `barrel` 3 · `pickle_barrel` 2 · `pickle_vat` 3 = **16 floor hands**.

⭐ **Origin: a BM ruling of 11 June 2026** (`soma-internal decisions/2026-06-11.md` §2), which set the five norms, the deficit formula **and** the pro-rata payee split with a worked example. The 11 Aug session rediscovered it independently and only found the June ruling at the Castor audit. **The codex had this, closed a task on it, and lost it inside eight weeks** — that is the finding, not the rediscovery.

**EXTRA** (BM, 11 Aug, matching the June ruling): `EXTRA hours = (establishment − present) × block hours`, when the station ran at 100%.

✅ **And BM ruled the same day that the deficit rule REACHES OT BLOCKS, not just the general shift** — which retroactively validates `recalcExtra`'s three-period loop (`['morningOT','standard','eveningOT']`), in place since Stage A, and makes the `eveningOT.hours` 3 → 7 correction below load-bearing rather than cosmetic. ⚠ **One thing the ruling opens that this repo does not yet model: an OT block's establishment is the sum of the stations that actually RAN in it, not all five.** `recalcExtra` sums the deficit across every area present in `period.areas`, so an OT period must be populated with only the stations that ran or it will over-book. Tracked in soma-internal — three of four unexplained register tags fit only by adding barrel-pickling, which the relay names in none of them.

### Three real defects in this repo, in order of what they cost

**1. `eveningOT.hours` was 3 where the block runs 7.** `calc-prod.js` seeded the evening period at 3 hours and `recalcExtra`'s fallback repeated it. The evening block is 5 PM → 12 AM. On Thu 6 Aug the dashboard would compute 15 EXTRA hours against the register's 35 — **₹950 understated in one day.** Found by Castor; larger than the defect this session set out to fix. Block hours now live in one exported `BLOCK_HOURS = {morningOT: 3, standard: 8, eveningOT: 7}`, with the additivity property recorded inline (3+8 = the 11 h 6 AM→5 PM span; 3+8+7 = the 18 h 6 AM→12 AM span — the 0.5 h by which 3 overstates the morning block is exactly the 0.5 h by which 8 understates the general one, which is why block-booking and the payout's span-booking agree).

**2. The roster rebuild suppressed EXTRA — a regression introduced by this session's own first cut.** `autoAssignRosters` did `assigned = roster.filter(present)` with no cap and no de-duplication, so **widening a roster monotonically reduces the booked deficit.** The first cut widened the VAT rosters 5→9 and 4→9 with nine ids on two or three stations at once; simulated against the register, **Mon 3 Aug booked 16 h where the register wrote 56.** Found by Janus.

Fixed by separating the axes: **`roster` means ELIGIBLE HERE** (wide, register-derived) and a new `selectAssigned` caps the assignment at the station's requirement and refuses to credit one hand at two stations in a period. **Tie-break is roster order (BM, 11 Aug), operator-overridable** — that allocation is real money under the June ruling's pro-rata split, so the default is deliberate and is not a claim about who actually stood where.

**3. `vat_a1`'s top capacity rung was 5 against an establishment of 4.** `recalcExtra` has implemented the deficit formula since Stage A, keyed on `caps[].r`; the top rung must equal the establishment. Four of five stations already agreed. A1 credited one phantom body-block on every full-capacity A1 day **staffed below five** — which, on the W32 register, is all six days. Worth 8 h = **₹380** at the ruled ₹47.50/hr — ₹330 under the 41.25 this app carried until today. Fixed to 4, giving A1 the same top-rung plateau `vat_a2` and `barrel` already have. The 66 rung stays meaningful: `getReq('pickle_vat')` returns 3 only when both VAT caps are 100.

🔧 **The ₹380/₹330 confusion, resolved in the right direction.** The first cut quoted ₹380 = 8 × ₹47.50, the register's contract rate, while `wage.js` ran **₹41.25/hr** — so the block really was ₹330, and the fold said the 13% gap was *"already tracked for Champai under T-CJ."*

🔴 **Cipher Edict V found that claim false in both directions.** soma-internal `tasks.md:27`: *"**T-CJ (Champai rate)** — **₹380/day** confirmed (= ₹47.50/hr; **NOT ₹41.25**) … **T-CJ resolved.**"* T-CJ is **closed**, and it closed **against** 41.25. So this was not an open divergence awaiting reconciliation — it was **a constant the codex had already ruled wrong**, and the fix had been deferred onto a task that could not receive it.

✅ **Corrected here rather than re-deferred**: `hourRate: 47.50`, pinned by a test asserting `47.50 × 8 = 380` — one body-block is one contract day-rate, which makes the ruling self-checking.

### The historical recompute (BM-authorised, 11 Aug)

Stored `extraCost` lives in `localStorage` on the devices, not in the repo, so correcting it is a **migration** — `src/shared/storage/migrations.js`, the first in this codebase, run once from `initData()` and recorded under `K.migrations`.

**It is not a flat 15.15% uplift, because two config values were wrong, not one:**

| | |
|---|---|
| `hourRate` 41.25 → 47.50 | **raises** every non-zero `extraCost` |
| `vat_a1` `caps[100].r` 5 → 4 | **lowers** the deficit on full-capacity A1 days — the phantom body-block |

A day carrying both moves in both directions, so the report decomposes `raisedByRate` and `loweredByEstablishment` separately rather than quoting a net.

**The safety property.** Before replacing a stored figure the migration **recomputes it under the OLD config and requires the result to match what is stored.** A day that does not reproduce was hand-edited, or written under a configuration this migration does not model — it is **flagged and skipped, never overwritten**. That is the difference between a migration and a bulk overwrite, and it is unit-tested against a day with a typed-over total.

**What it deliberately does not touch.** `assigned`, `cap`, `present` and `period.hours` are operator-entered and stay exactly as saved. In particular **`eveningOT.hours` is NOT corrected 3 → 7** even though the block runs seven hours — a stored 3 may be an operator recording a genuinely short evening, and overwriting it would be inventing data. Days carrying it are **counted and reported** so the call stays with BM.

**The month lock is bypassed, deliberately and on the record.** The lock guards operator edits against a finalised month; this corrects a figure the codex had already ruled wrong, and nearly every affected day sits inside a locked month — a migration that respected the lock would correct nothing. Each corrected day carries an append-only `corrections[]` entry (before / after / reason), same pattern as the dashboard's `revisions[]`, which is what makes the bypass auditable rather than silent.

→ soma-internal **T-EP**.

### The deployment gap — the fix does not reach an installed dashboard

`getAreas()` returns saved localStorage **wholesale, with no merge**, and `sep_prod_areas_v1` has been populated since Stage A in May. There is no areas-editing UI; the only reset path destroys payroll history. So a live install would have pulled the new bundle and kept `r:5` and the AWOL rosters — **every claim above true of the repo and false of the running app.**

`K.prodAreas` bumped to **`sep_prod_areas_v2`**, forcing a one-shot re-seed; v1 is left unread as a rollback. The `production.js` header comment claimed defaults are merged — true of `getCfg()`, **false of `getAreas()` directly below it**, which is why this was easy to miss. Corrected to say which accessor does what.

### Roster corrections — twenty on the floor, twenty-one config entries, the wrong twenty-one

`area.roster` drives assignment, so all four were live: **Tuklu** (AWOL confirmed 18 May) and **Kusu** (off pool) were being offered; **Rakesh** (joined W22, on every payout since W29) and **Vijay** (joined 14 Jul, the 19→20 event) were absent entirely. Kusu and Tuklu retained as ids so historical attendance resolves, flagged `inactive`. Rosters rebuilt from the W32 register — Janus verified them as strict *subsets* of the register's placements, under-inclusive and never over.

Display names to codex canonical per HR-4: Lucky → **Lakhi**, Shambhu → **Sambhu**, Mantu → **Montu**, Sharat → **Sarat**, and Budheswar → **Buddheswar** 🔧 *(the first cut wrote "Budheswer", which `staff-aliases.md` lists as a variant — HR-4 broken in the line citing HR-4, caught by Janus)*. Ids frozen; Janus verified no name-keyed lookup exists (`getAttKey` and `statKey` both key on id).

### Also: the e2e suite was unrunnable in a web session

Sandbox ships Chromium 1194; this Playwright expects a 1217 headless shell it cannot download, so **all 41 e2e tests failed to launch a browser** — which is how it was found. sep-invoicing has solved this since 30 Jul; pattern ported (`PW_CHROMIUM_PATH` in `playwright.config.ts`, ignored when unset, plus SessionStart hook detection).

### ⚠ Withdrawn at the QA chain

- **"Independent corroboration" of the Area 1 = `vat_a1` mapping.** BM confirmed it (*"A1 is the room with 4 tanks, only 3 are operational"*), and it is consistent with the Session-11 floor model — **but that model is also BM-sourced**, recorded in April from a Cowork Q&A where BM supplied the layouts. One source at two dates, not two sources. Worse, the identification was circular: converting *"A1 is the 4-tank room"* into *"Area 1 = A1"* needs the premise *"Area 1 is the 4-tank room"*, which exists only in that table — an **input** to the conclusion. The mapping stands; the strength claim does not. (Vulcanus BLOCKER-2.)
- **"`vat_a1`'s capacity reference was measured with one tank down."** A 30 May BM-corrected plan records **all four running**, nine days before the W24 measurement window, and no repair or failure event is logged anywhere between April and August. **The tank state during W24 is UNKNOWN.** (Vulcanus BLOCKER-1.)
- **"3,116 is the line's ceiling."** It is a **6-day mean the line beat on 3 of those 6 days**, peak 3,600 (115.5%). (Vulcanus HIGH-1.)
- **"A fourth A1 tank does not compete for A2's jigs."** All 8 A1 hands also work A2 — on three June days the register lists the identical names under both — and A1 ran **zero crew on two of six days in W26** while three working tanks stood idle. Crew is the binding constraint. Vulcanus's alternative number: A1 runs at **61.7% of its own demonstrated three-tank peak**, so the unrealised headroom (1,100–1,378 NOS/day) exceeds a fourth tank's naive value (1,039/day), at zero capex. (Vulcanus HIGH-2 / DEFENDABLE-2.)
- **"Area 3's 8 barrels / 4 functional is latent capacity."** Four dead barrels are being **sold, not repaired** (BM, 20 May) to free floor space for a new VAT line. Noted inline.

### Tests / Versions

Unit **279 → 300** · e2e **41** · build clean. `BUILD 4→5`, `APP_VERSION 2.1.0-alpha.8`, both SW caches bumped, `K.prodAreas` → v2.

New coupling cases pin what would have caught this session's own regressions: **no hand credited to two stations in one period** · **no station assigned above establishment** · **widening a roster cannot reduce the booked deficit** · **the roster-order tie-break** · **a hand claimed by an earlier station is not offered to a later one** · **block hours additive to the payout's clock spans** · **`DEF_FLOOR_AREAS` machine counts tethered to `work-areas.md`** · **`hourRate` = 47.50 and 47.50 × 8 = 380**.

🔧 **Those assignment tests were themselves rewritten at Cipher Edict V.** The first version **re-implemented the selection rule inline**, so it modelled a property the code did not have and **could not fail** — and its own disclosure that the wiring was "covered by e2e" was false: no e2e exercises `autoAssignRosters` / `selectAssigned` / `autoPickling`. **`selectAssigned` was therefore promoted to Layer 1** (`calc-prod.js`), where the tests call the real function; `tabs/production.js` imports it. The `recalcExtra` arithmetic test was also renamed — it hand-feeds assignments and stays green through the entire roster regression, which the old register-flavoured name concealed.

🔧 **And `autoPickling` was dropping the exclusion** it had just been given: it rebuilt `claimed` from non-dep areas only, so a dep-to-dep overlap would double-count. Zero impact today (Area 4's two rosters are disjoint) — but the register moves Naren, Sambhu, Birsa, Rakesh and Vijay across Area 4 constantly, and the first overlapping edit would have re-opened the exact defect. Now claims from every other area, dep included.

### Still Open (unchanged queue)

CF cross-doc validation (deploy-gated) · Session-17 fast-follows (audit-noise filter, `functions lint` gap) · shared `firestore-store` extraction · prod stand-up · rules-CI prod-deps trim · submit-path IDB serialization · stale PRs #13/#14 rebase-or-close.
**New**: the stored-`extraCost` reconciliation under soma-internal **T-EP** — the rate itself is fixed and the historical recompute has shipped; what remains is the `eveningOT.hours = 3` days the migration reports but will not touch, and whether any already-paid slip needs restating · `DEF_FLOOR_AREAS` / `FLOOR_ESTABLISHMENT` have no production consumer yet (forward-looking, for the floor view) · role labels in `DEF_PERM` are stale against the rosters beside them.

*Session 20 documented 11 August 2026 by Aurelius (Claude Code); QA chain folded same day.*
