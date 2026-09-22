// Wage and shift defaults. CW are paid hourly (`hourRate`); Perm OT is
// pro-rated on `permOtBaseRate` × `permOtMultiplier` regardless of the
// worker's normal daily rate, by Sovereign convention.
//
// ── hourRate: 41.25 → 47.50 (corrected) ─────────────────────────────────────
// ₹47.50/hr is the ratified CONTRACT DAILY-HAND rate and has been since
// **Mon 4 May 2026** — it is ₹380/day ÷ 8 at exactly 1.0×, and Shyam was
// informed of it from W20 (soma-internal `tasks.md` T-F; `operations/roster.md`
// "Contract OT rate: ₹47.50/hr — aligns with new ₹380 base at 1.0×";
// `frameworks/roles-responsibilities-v1.1.md` §"Four workers").
//
// 🔧 CORRECTED 22 Sep (Iuno, cross-jurisdiction): an earlier version of this
// comment said "₹41.25/hr was never the floor rate." That is FALSE for the
// pre-W20 period and this file is where a reader looks for the rate's
// provenance. ₹41.25 WAS the floor rate through W19 — `attendance/2026-W19.md`
// records "Rate applied by Shyam: ₹41.25/hr flat, all hours" over a
// nine-worker table with every man at ₹41.25; `decisions/2026-05-16.md`
// ratified it as the base rate, "formally replacing the ₹47.50/hr from W20
// aspirational rate with the operating rate ₹41.25/hr"; and it was announced
// to the workforce in `frameworks/performance-pool-announcement-2026-W21.md`.
//
// The accurate statement: ₹41.25 was the floor rate THROUGH W19, moved to
// ₹47.50 FROM W20 (`attendance/2026-W20.md`), and survived thereafter only on
// Champai's R&R v1.1 office line — *"Office (Champai) | 1 | Weekly hourly
// ₹41.25/hr (special status — not factory worker for license purposes)"*.
// So the CONCLUSION stands unchanged — a global ₹41.25 is wrong for every
// FY27-post-W20 week, and seeding it applied a superseded rate to eleven
// hands, running every contract wage this app computed ~13% under the ratified
// card. What was wrong was the history, not the fix.
//
// ✅ CHAMPAI IS ON ₹47.50 TOO — ruled by BM, 21 Sep 2026. This closes the F-1
// divergence that had sat live on `staff-aliases.md` since 13 Jun. 🔧 But it
// was a REGRESSION, not a fresh ruling (Iuno H-2, 22 Sep): T-CJ's Champai row
// was already closed on 22 Jun 2026 on the W25 payout instrument
// (`tasks.md`, `decisions/2026-06-22.md`) and simply never folded into
// `staff-aliases.md`. And there is NO W24 weekly payout — the checkable
// instruments are W25 (40 hr = ₹1,900 = ₹380×5) and W33 (16 hr = ₹760.00).
// 🔴 RETRACTED (Cipher B-1, 22 Sep): an earlier version of this comment drew
// the lesson "the instrument that moves money beats the document that describes
// it". That principle is real and it is NOT this case's. What disagreed was not
// a framework page against a payout slip — it was `tasks.md` and
// `decisions/2026-06-22.md`, which both closed this on 22 June, against
// `staff-aliases.md`, which was never folded. The lesson is the FOLD RULE: name
// every surface that carries a claim before amending any one of them.
// His override is DELETED rather than updated — he is simply on the contract
// rate.
export const DEF_CFG = {
  hourRate: 47.50,
  // worker id → an hourly rate that is NOT the contract-hand rate.
  // EMPTY TODAY. Kept because the codex has a history of per-worker rate
  // exceptions (Champai's own, ruled out on 21 Sep, was the last one) and
  // because the alternative — a second flat global — is what produced the
  // 41.25 bug in the first place.
  hourRateOverrides: {},
  snackRate: 20,
  permOtMultiplier: 1.1,
  permOtBaseRate: 496,
  guardIds: ['uday'],
  excludedIds: ['rounak'],
  standardShift:      { start: '08:30', end: '17:00', hours: 8 },
  sundayHolidayShift: { start: '06:00', end: '14:00', hours: 8 },
  morningOT:          { start: '06:00', end: '08:30', hours: 3 },
  eveningOT:          { start: '17:00', end: '20:00', hours: 3 },
};
