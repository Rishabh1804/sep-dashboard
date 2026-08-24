# Week 0 Runbook — SEP Handler rollout

**Phase:** 7 (execution of [`ADOPTION_PLAN.md`](ADOPTION_PLAN.md) Week 0)
**Status:** ready to execute
**Owner:** Rishabh (setup) → notebook handler / data steward (from Week 1)

`ADOPTION_PLAN.md` locks *what* Week 0 must produce and *why*. This is the
executable version: what to do, in what order, and how to tell it worked.

> **The one thing to keep in view.** The KPI is **adoption rate**, not entries
> per day. A handler who records 300 entries out of an expected 700 is failing
> the rollout while looking productive. The whole apparatus below exists to make
> the denominator visible.

---

## 1. Print and laminate the paper backup forms

The forms are generated from the live handler registry, so they cannot drift
from the app:

```bash
pnpm paper:forms          # → dist/paper-forms.html
```

Open that file in a browser and print: **A4 portrait, 100% scale, single-sided,
black & white**. Nine sheets, one per handler form. Regenerate and reprint
whenever a form gains or loses a field.

| Sheet | Layout | Per sheet | Why |
|---|---|---|---|
| Production | row grid | 24 entries | ~300/day — a block layout would burn a sheet an hour |
| Check in/out | row grid | 24 entries | 20 workers × in + out |
| Job receipt · DFT · Stock refill · Stock used | blocks | 3 entries | lower volume, legibility wins |
| Dispatch · Machine state · Note | blocks | 4 entries | short forms |

**Distribute:** one laminated set per area — VAT Room 1, VAT Room 2, Barrel
Room, Pickling Area 4, Office. Beside each laminated set, a **loose pad of
Production and Check-in**; those two fill up and get counted, so they must be
disposable.

**Check before the bulk print:** Devanagari renders through Noto Sans
Devanagari (loaded from Google Fonts) and falls back to the system Hindi font
offline. Print one sheet and read it before printing forty.

### The `☐ In app` tick is the mechanism, not decoration

Every row and every block carries one. It is what makes the parallel-paper run
measurable instead of merely reassuring:

1. Worker or handler writes the entry on paper, as today.
2. Handler enters it in SEP Handler.
3. Handler ticks the box.
4. End of shift: **count the ticks per form** — that count is the denominator.

An untick­ed row at end of shift is either an entry that never reached the app
(adoption gap) or one nobody transcribed (data gap). Both are findings. Neither
is visible without the tick.

---

## 2. Provision the first handler

Per [`HANDLER_PROVISIONING.md`](HANDLER_PROVISIONING.md) — QR in person, never a
URL over WhatsApp.

- Run the `firebase-admin` workflow → `mint-token`, uid = the handler's id,
  roles `handler`. **Tokens are valid one hour**, so mint it when you are
  standing next to the device.
- Install the PWA at `/sep-dashboard/entry/handler/`, open with the printed
  `#token=…` fragment appended.
- **Acceptance:** sync chip goes green · pickers hydrate from the seed ·
  one real entry round-trips and appears in the dashboard's Live tab.

Do a dry run on your own Android first. The failure modes are physical
(keyboard, glare, glove) and only show up on a device.

---

## 3. Set up the daily huddle

- 10 minutes, start of shift, in the office, dashboard on screen.
- Agenda: yesterday's adoption numbers → divergences → any new form → questions.
- Runs daily through Weeks 1–3, then twice weekly.

---

## 4. Set up the reconciliation ritual

End of every shift, on the dashboard machine:

1. **Edit tab → Adoption.**
2. Press **Refresh** — this counts the week's digital entries from Firestore.
3. For each form, count the `☐ In app` ticks on that day's paper sheets and
   type the number into that day's column.
4. Read the **Week** column: that is the adoption rate per form.

What the view will and will not tell you:

- **A blank rate (`—`) is not zero.** Before Refresh, digital is *unknown*.
  With no paper count entered, the denominator is *missing*. Neither is 0%,
  and the view refuses to render one.
- **A rate above 100% is a finding**, not a win: more digital entries than
  paper means a sheet went uncounted or an entry was submitted twice.
- **"measured on N of 9 forms"** is on the card for a reason. A 95% drawn from
  one form is not the same number as one drawn from nine.
- **`denied`** on a row means the rules refused that collection-group read —
  a *missing measurement*, not a zero. It clears when `deploy-rules` is green.
- **Paper counts live in this device's localStorage.** There is no Firestore
  write rule for an adoption count, and inventing one would need the IAM-gated
  rules deploy. Reconcile from the same machine every day, and note that
  clearing site data loses the history.

### Targets ([`ADOPTION_PLAN.md`](ADOPTION_PLAN.md) Week 1 ramp)

| Rollout day | Target |
|---|---|
| Day 1 | 60% |
| Day 5 | 80% |
| Day 7 | 95% |

The view measures against 95% (the steady-state bar). During Week 1, read
Day 1–4 against 60% and Day 5–6 against 80% by eye — the ramp is in
`adoption-model.js` as `WEEK1_TARGETS` for when the view surfaces it directly.

---

## 5. Escape hatches (must exist before Week 1 opens)

| Hatch | State |
|---|---|
| Laminated paper forms in every area | §1 above |
| Pre-flush confirmation on PWA reopen | shipped (Stage C) |
| Steward edit-with-reason beyond the 24h window | shipped (Edit tab) |
| Replay / rebuild admin tool | **not shipped** — Stage E aggregators are live and idempotent, but there is no replay CLI. If a CF ships with a bug, the fix is a corrected redeploy plus manual edits, not a rebuild. |

---

## Week 0 acceptance

- [ ] Paper forms printed, laminated, and placed in all five areas
- [ ] Loose Production + Check-in pads beside each laminated set
- [ ] First handler provisioned by QR, in person, with one entry round-tripped
- [ ] Daily huddle scheduled; dashboard reachable from the huddle location
- [ ] Adoption view opened once, Refresh pressed, a paper count typed in and read back
- [ ] Handler briefed that their KPI is **adoption rate**, not entries per day

## What Week 0 does *not* cover

- **Prod.** Everything above runs against **staging**. See
  [`PROD_STANDUP.md`](PROD_STANDUP.md) — the prod project does not exist yet, and
  Week 1 data written to staging is Week 1 data that will need re-seeding or
  migrating if prod is stood up mid-rollout. **Decide before Week 1 opens.**
- **`deploy-rules` via Actions** is still IAM-gated on staging. Until the two
  roles are granted, collection-group reads (check-ins, stock depletions) stay
  denied, and those two rows of the Adoption view read `denied` rather than a
  number.
