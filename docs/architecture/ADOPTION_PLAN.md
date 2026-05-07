# Adoption Plan

**Phase:** 7
**Status:** LOCKED — 7 May 2026
**Note:** Adversary identified missing rollout strategy as silent BLOCKER. This is the closure.

---

## Problem

Workers come from paper notebooks. Without a rollout plan, the app launches and the notebook returns within 2 weeks. Worker non-adoption = data not flowing in = entire Phase 2 vision fails. Adoption is as load-bearing as any infrastructure decision.

## Adversarial Findings

**BLOCKER** — Proposal silent on rollout. Realistic path required: parallel paper + app, one form at a time (Production Entry first, highest ROI), daily 10-min huddle for first 2 weeks, escape hatch (laminated paper forms in every area), trainer role explicitly defined (handler steward), KPI = adoption not entries.

All folded into the locked plan.

## Locked Decision

### Four-week phased rollout

#### Week 0 — Setup (pre-launch)

- Procure cheap Android phones (~Rs 5000/each) for handlers without compatible device
- Print laminated paper backup forms for every form (matching field layout)
- Distribute to every area: VAT Room 1, VAT Room 2, Barrel Room, Pickling Area 4, Office
- Provision first handler (notebook handler / data steward) via QR-in-person flow
- Verify provisioning runbook works end-to-end with first handler
- Set up daily huddle: 10-min standup at start of shift, in office, with dashboard projected
- Define handler-as-trainer KPI: adoption rate (% of expected entries captured digitally), NOT entries-per-day

#### Week 1 — Production Entry only

Why this form first:
- Highest volume (~300/day) → biggest ROI on getting it digital
- Most-frequent → workers learn the form quickly through repetition
- Pre-fill defenses tested under real load (defends against the predicted Month-1 failure mode)
- Other forms continue on paper

Process:
- Handler enters Production Entry digitally on phone
- Workers continue logging on paper as before (parallel paper run)
- End of shift: handler reconciles paper log against dashboard activity stream
- Daily huddle: review reconciliation, identify divergences, fix process
- Handler shows dashboard activity stream to workers ("here's what your shift looks like digitally")

KPI:
- Day 1: 60% of expected production entries digital
- Day 5: 80%
- Day 7: 95%

#### Week 2 — Add Job Receipt + DFT + Dispatch

Why these next:
- Higher value than stock/notes (these drive the operational state of the floor)
- Handler is the natural entry point (workers verbally report, handler captures)
- DFT and Dispatch are CF-mediated (test the cross-doc validation under real load)

Process:
- Forms added one per day (Mon: Job Receipt; Wed: DFT; Fri: Dispatch)
- Continued parallel paper run
- Daily huddle continues; reconciliation expands
- Steward begins exercising anomaly inbox + edit-with-reason workflow

#### Week 3 — Add Stock + Machine State + Notes + Check-In

Why later:
- Stock and machine state are lower-volume → can absorb later
- Worker check-in is cultural change (workers must remember to clock in/out); needs supportive context
- Notes are structured; handler needs to feel comfortable with the data model first

Process:
- Forms added incrementally (one per day, similar to Week 2)
- Worker check-in introduced last; supplemented by handler reminding workers at shift start
- Steward begins generating KPI weekly card baseline

#### Week 4 — Sunset paper

Process:
- Paper forms removed from production areas (still kept in office for emergency fallback)
- Steward verifies dashboard data integrity via KPI weekly card metrics
- Adoption rate target: 95% across all 9 forms
- Daily huddle frequency reduced to 2x/week
- Anomaly inbox + edit-with-reason workflows now part of normal operations

### Handler-as-trainer KPI

Per Phase 7 ratification:
- Notebook handler's primary KPI during rollout = adoption rate, NOT entries-per-day
- Adoption rate = (digital entries / expected entries) × 100%, computed weekly from paper reconciliation
- Steward role transition (per Session 11 + Phase 8) begins after Week 4: handler shifts from data-recorder to data-steward + trainer

### Escape hatches (always available)

- **Laminated paper forms** in every area (4G + wifi both down → handler batch-enters from paper later)
- **Pre-flush confirmation** on PWA reopen (per Phase 5; catches reinstall data-loss surprises)
- **Steward edit-with-reason** workflow (per Phase 8; handler can correct entries beyond 24h window with documented reason)
- **Replay/rebuild admin tool** (per Phase 5; if CF logic ships with bug, rebuild parent state from event log)

### Failure modes + mitigations

| Symptom | Likely cause | Mitigation |
|---|---|---|
| Adoption rate <60% Day 5 of Week 1 | Workers reverting to paper because form is slow | Profile form speed; review pre-fill defenses; daily huddle to identify friction |
| Many anomalies in Week 1 | Sanity hard-blocks rejecting legitimate edge cases | Tune Zod ranges; document edge cases in SCHEMA_CHANGELOG |
| Handler entering for workers (not workers themselves) | Cultural — workers don't see PWA as their tool | Move to per-role-app pattern earlier (Pickler PWA could ship Phase 2.1 if needed) |
| Production Entry mis-attribution (the predicted failure) | Pre-fill defenses insufficient under load | Strengthen visual diff highlight; reduce time-decay window from 15min to 5min; consider mandatory job-confirm at every entry temporarily |
| Reconciliation divergence (paper vs digital) | Workers writing on paper, handler missing entries | Investigate which workers / which times; one-on-one training |
| Handler PWA crashes / freezes | Bug in PWA or storage limit | Check IndexedDB usage; reinstall PWA (queue should survive); escalate to Stage F engineering review |

## Rationale

- **Production Entry first** = biggest ROI on adoption; gets workers + handler used to the form fastest
- **Parallel paper run** = safety net; if PWA fails, paper is authoritative
- **One form per day in Weeks 2-3** = manageable cognitive load
- **4-week timeline** = not too rushed; not too leisurely; matches Session 13 implementation timeline
- **Handler-as-trainer KPI** = aligns incentives (adoption matters; entries-recorded does not)
- **Daily huddle** = continuous feedback loop; closes the silent-divergence failure mode
- **Steward role transition Week 4** = handler outgrows pure-recording role; data quality becomes their KPI

## Acceptance Criteria (the bar)

- [ ] Laminated paper backup forms designed and printed for all 9 forms; placed in every area
- [ ] First handler provisioned via QR-in-person flow before Week 1
- [ ] Daily huddle scheduled + projector + dashboard accessible from huddle location
- [ ] Adoption rate KPI computed weekly from paper reconciliation
- [ ] Production Entry adoption rate ≥95% by Day 7
- [ ] All 9 forms in production by Week 3 Day 7
- [ ] Paper forms sunset by Week 4 Day 7 (kept in office only for emergency)
- [ ] Steward weekly KPI card baseline established by Week 4 Day 7

## Implementation Notes

- Paper forms: A4 portrait, dot-matrix-printable, with field labels in Devanagari + English; field positions match PWA layout for easy visual reference
- Reconciliation: handler logs in to dashboard end-of-shift; uses "Today's activity stream" filtered to current handler; cross-checks against paper count
- Daily huddle agenda: (1) review previous day's adoption metrics, (2) discuss anomalies / divergences, (3) demo any new form, (4) Q&A
- Adoption rate computation: simple ratio; calculated by handler in dashboard "Adoption" view (steward-exclusive)
- Worker rewards (optional): small recognition for high-adoption workers (lunch coupon, etc.) — culturally appropriate at this scale

## Future Considerations

- **Worker self-entry** (Phase 2.1+) — once Pickler/Inspector/Dispatch role-apps ship, workers enter their own data; handler shifts to oversight
- **Multi-language support** beyond Devanagari (Phase 2.2+) — for workers who prefer regional languages
- **Gamification of adoption** (Phase 2.2+) — leaderboard / streaks; carefully designed to avoid gaming the metric
- **Onboarding video** (Phase 2.1+) — recorded walkthrough in Hindi for new hires

## Related

- [HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md) — what handlers learn during onboarding
- [HANDLER_FORMS.md](HANDLER_FORMS.md) — form-by-form spec
- [HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md) — provisioning runbook used Week 0
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — steward role transition Week 4+
- [EXCELLENT_DATA_CAPTURE.md](EXCELLENT_DATA_CAPTURE.md) — the bar adoption is measured against

---

*Authored 7 May 2026 by Aurelius.*
