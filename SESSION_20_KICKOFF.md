# Session 20 Kickoff — a personal floor tracker (Session C of four)

**Set by the owner, 24 Sep 2026. This is a change of direction, not the next stage of the old plan.**

This repo is worked in its **own session**. A separate **compile session** (Session D) attaches
all three SEP repos and reconciles their data. The model is described once, canonically, in
`soma-internal/docs/CROSS_REPO_SESSIONS.md`. This file carries **this repo's side** of it.

> **Supersedes as the starting point:** `NEXT_SESSION_SPEC.md` (Session 8 options, v2.1, stale)
> and the multi-device roadmap in `CLAUDE.md` Sessions 12–19. Those records stay as history. Read
> the list below for what carries over.

---

## The direction, in the owner's words and order

1. **Roll out a personal PWA for desktop and Android.** It should be user-friendly, built on
   modern design, and, more importantly, **buildable on free services plus Claude.**
2. **Disregard the multiple-device route for now.** It will be looked at later. Handler
   provisioning, QR onboarding, custom tokens and per-role apps are all set aside; none of it is
   deleted.
3. **Scope: an attendance and production tracker, and nothing else.**
4. **The backend is linked to a WhatsApp group.** Data updates from it, and **unreadable data is
   flagged for action.**

---

## Settle these first. Each one decides the architecture.

### ⚠ A — "Free services" against the stack that is already live

The staging backend built in Sessions 14–19 runs on Firebase. **Firestore has a free tier;
Cloud Functions did not.** Session 17's deploy needed **Blaze billing** before the first function
would go out (see the runbook header in `scripts/deploy-functions.mjs`). A free-services rule
therefore means deciding what replaces the aggregator functions, or accepting Blaze with a
spending cap. Options to lay side by side:

- Firestore on the free plan, with the aggregation moved into the client;
- a static site on GitHub Pages, with GitHub Actions doing the scheduled work and the repo (or a
  private sibling) holding the data;
- stay on Blaze with a hard spending cap, and say so explicitly.

### ⚠ B — Reading a WhatsApp group: verify the route before building on it

**Establish what an official, free route actually allows before designing the backend.** Neither
this session nor this file verified it. Two things are known:

- **Automating a personal WhatsApp account with unofficial libraries can get the number
  banned.** That number is the shop's daily-update channel.
- **A route that works today exists and is manual:** `soma-internal` ingests an exported chat
  (`data/raw/relays/`). A backend could start from uploaded exports and move to live reading only
  once a sanctioned route is confirmed.

### ⚠ C — The data cannot live in this repo, and it has a destination

**This repo is public.** Business data has never been committed here; the `seed-staging`
workflow in private `soma-internal` exists for exactly that reason. Whatever the backend becomes,
attendance and production data stay out of this repo's history. **Its destination is ruled** (owner, 24 Sep 2026): **all sensitive data is copied to `soma-internal`, the private repo, at every compile**, and `soma-internal` holds the record. **It is a copy, not a move: the data stays on the device and readable in this app.** This app captures and shows. It is not the ledger.

---

## "Claude" in the stack: reuse the parsing rules, don't re-derive them

Turning the daily relay into attendance and production, and flagging what can't be read, is the
job `soma-internal` sessions already do by hand. The rules are written down. Start from them:

- **Attendance:** in and out times; `EXTRA n HOURS` tags against an area's shortfall; morning,
  evening and midnight OT blocks, each with its own crew; the "HOLD NIGHT" tag; holidays and worked
  Sundays. The owner's rulings and the parser's known failure shapes are recorded in
  `sep-invoicing/CLAUDE.md` § *The floor, by area* and § *What the seeded history actually says
  about the extra*. The worked weeks are in `soma-internal/attendance/`.
- **Production and stock:** the shop's own arithmetic lines (`add … use … available …`) can be
  checked for footing. The 22 Sep take had one line that didn't foot (nitric acid). **Checks like
  that are exactly what "flag for action" should mean.**
- **Unreadable is a state, not a failure.** A relay line the parser cannot place should be stored
  with a reason and shown for action, never silently dropped. The same "warn, never block, and
  say why" rule already runs through `sep-invoicing` (duplicate receipts, number audit).

---

## What carries over from Sessions 13–19

| Carries over | Set aside (not deleted) |
|---|---|
| Modular esbuild build, CSS tokens, the layer rule | Handler provisioning, QR onboarding, custom tokens |
| Zod schemas at the write boundary; the σ-sanity net | N-PWA topology, per-role apps |
| The form engine and big-button pickers (useful for manual correction) | Steward inboxes, the edit-with-reason surface |
| Offline-first IndexedDB queue | Firestore security rules for multi-user compartments |
| | Cloud Functions aggregators (see ⚠ A) |

---

## What PR #33 carries into this session (read on re-orient)

PR #33 was opened before this kickoff and lands after it. Three things in it bear on the new
direction.

1. **The Week-0 pack is history for the route this kickoff sets aside.** The paper forms
   (`pnpm paper:forms`), the Adoption view on the Edit tab, `WEEK_0_RUNBOOK.md` and
   `PROD_STANDUP.md` were built to roll out the multi-device handler route. They are **set aside,
   not deleted**, like the rest of that route in the table above. Nothing in the personal tracker
   depends on them. The paper-form generator may still be useful for a manual backup sheet.
2. **Pay rules are current; pay data is not in this repo.** The Finance tab prices wages from
   attendance, and PR #33 brought its rules up to the owner's rulings to 24 Sep: per-worker
   permanent OT with a cap, OT floored once per month, and a plain monthly model for guards and
   any non-floor worker (`payModel: 'monthly-plain'`). **The rates left the shipped code** under
   the sensitive-data rule (`bm-role.html`, a May mock with business figures, is still in the repo
   pending the owner's word). Rates now reach a device through **Settings → Import roster**, from
   `soma-internal/analysis/sep-dashboard-roster-<date>.json` (generated by
   `scripts/build-dashboard-roster.py`): get the file onto the device privately — from the private
   repo in a signed-in browser, or sent to yourself — and import it. **Do this on every device's
   first boot of this build**: a device upgraded from `main` still holds main's old seed rates, and
   until an import stamps them, Home, Finance, the pay prints and the CSVs all say the rates are
   *held, not imported*. A fresh install prices at zero and says so. **Whether the personal tracker keeps any pay views is this session's to
   settle with the owner.** The new scope names attendance and production only; the rules and the
   import door work either way.
3. **Session numbering.** This branch's `CLAUDE.md` had written its last two entries as
   "Session 20" (the Week-0 pack) and "Session 21" (payroll). They are renumbered **19a** and
   **19b**, so **this kickoff is Session 20** and the next entry after it is Session 21.

---

## This repo's side of each interface

Session D checks these against the other repos' descriptions. **If one changes, say so in the PR.**

| Flow | This repo's side |
|---|---|
| **Consumes** the WhatsApp group | **Planned.** Route to be settled (⚠ B). ⚖ **`soma-internal` owns the record** (owner's ruling, 24 Sep: it is the private repo, and all sensitive data is transferred there at every compile). **This backend captures and shows; what it captures is **copied** to `soma-internal`, which holds the record, and **stays readable here**.** Design the capture so it can be exported whole, including the flagged-unreadable lines and their reasons. |
| **Consumes** the private seed ← `soma-internal` | Live for the old Firestore architecture through `soma-internal`'s `seed-staging` workflow. **Under review** with ⚠ A. |
| **Consumes** the roster import ← `soma-internal` | **In PR #33 (alpha.16–17); not yet deployed.** Settings → Import roster reads a `sep-dashboard-roster` v1 file: `{format, version, asOf, cfg: {hourRate, permOtBaseRate, snackRate}, workers: [{id, dailyRate} or {id, monthlyWage}]}`. Workers are matched **by id**; unknown ids are skipped and counted, never created; only rate fields apply, and only the field the worker is paid by; unpriced active workers are listed. The import stamps `cfg.rosterAsOf` from `asOf`. ⚖ **`soma-internal` owns the rate card** (the private repo). This repo ships structure only. |
| **Stock** | **Owned by `soma-internal`.** v2.1 had a stock tab (`src/dashboard/tabs/stock.js`), and the new scope is attendance and production only. A PR that retires the tab should say so. |
