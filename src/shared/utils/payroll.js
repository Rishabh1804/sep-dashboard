// Payroll-math primitives. Per Phase 2 audit (resolution 4), these
// are pure functions promoted from tabs/finance.js to Layer 1; they
// take all dependencies as arguments and have no storage side-effects.
// Highest-leverage Jest test target.

import { sepRound } from './currency.js';
import { localDateStr, getWeekEnd } from './date.js';

// Hourly rate for one contract hand. Flat `cfg.hourRate` for everyone except
// the ids in `cfg.hourRateOverrides`. The map is EMPTY since the 21 Sep BM
// ruling put Champai on the contract rate; the mechanism stays so a future
// exception never needs a second flat global (see config/wage.js). Tolerates a
// cfg with no overrides key so an older persisted settings blob keeps working.
export function cwHourRate(cfg, workerId) {
  const o = cfg.hourRateOverrides;
  const r = o && Object.prototype.hasOwnProperty.call(o, workerId) ? o[workerId] : cfg.hourRate;
  return Number.isFinite(Number(r)) ? Number(r) : cfg.hourRate;
}

// Permanent-tier OT rate — BM ruling, 23 Sep 2026 (soma-internal
// `decisions/2026-09-23.md` §4):
//
//   OT/hr = min(dailyRate, permOtBaseRate) ÷ 8 × permOtMultiplier
//
// Below ₹496/day a man's OT is 1.1× his own hourly rate (Sambhu ₹380 → ₹52.25).
// At or above ₹496 it is CAPPED at the P01 v3 contract term, ₹496 ÷ 8 × 1.1 =
// ₹68.20 (Shyam, Sarat, Rupa). The two are continuous at exactly ₹496.
//
// Deliberately NOT rounded. `sepRound` floors to whole RUPEES, and every caller
// used to floor the RATE: the app paid ₹68/hr against a stated ₹68.20, and the
// per-worker rule would have paid Sambhu ₹52 against a ruled ₹52.25.
//
// Where the paid amount is rounded is a separate rule — BM, 23 Sep: OT is
// computed PER MONTH. calcPermMonthlyPay totals the month's hours × rate and
// floors ONCE (the app's locked currency rule); a per-day floor on these
// fractional rates lost up to ₹1 per man per OT day. The daily cost views
// (calcDayWages, the Finance tab, the Costs CSV) still floor per day: they are
// cost estimates, not pay.
//
// Guards are NOT priced by this rule — see guardDayRate / guardHourRate below.
// A guard id returns 0 here, so a caller that reaches for permOtRate on a guard
// shows a visible zero rather than silently restoring the 1.1× the BM ruled out
// (Janus M-1, 23 Sep). Callers that price the whole monthly tier go through
// monthlyOtRate.
//
// A missing or non-numeric dailyRate, cap or multiplier yields 0 — a visible
// zero on the slip, not NaN pay or a silently capped payment.
export function permOtRate(cfg, worker) {
  if (usesPlainRate(cfg, worker)) return 0;
  const daily = Math.max(Number(worker && worker.dailyRate) || 0, 0);
  const cap = Number(cfg.permOtBaseRate);
  const mult = Number(cfg.permOtMultiplier);
  if (!Number.isFinite(cap) || !Number.isFinite(mult)) return 0;
  return (Math.min(daily, cap) / 8) * mult;
}


// --- Guard pay (Uday). Three BM rulings:
//   · 14 Sep 2026: ₹9,000/month; his day rate is ₹9,000 ÷ the days in THAT
//     month (₹290.32 in a 31-day month, ₹300 in a 30-day one). August was
//     ruled at ₹8,129.03 = 28 days × ₹9,000 ÷ 31.
//   · 23 Sep: "7-7 is his shift" — the 12-hour gate shift is his standard day
//     and is never recorded as OT.
//   · 23 Sep: hours ABOVE his 12-hour day are paid at his PLAIN hourly rate —
//     no 1.1×, no special OT rate — and that hourly rate follows the days in the
//     month. otHours on a guard means hours above 12 and nothing else: directed
//     non-gate work INSIDE the 12 is paid too, at a rate no ruling states.
//
//   · 24 Sep: the divisor is ÷ 12, confirmed — the hourly rate is day rate ÷
//     shiftHours (12): ₹25.00 in a 30-day month, ₹24.19 in a 31-day one.
//   · 24 Sep: "Have it as an option for non-floor staff." This pay model —
//     monthly wage ÷ days ÷ shift hours, no multiplier, pricing directed work
//     inside the shift as well as hours beyond it — is an OPTION any non-floor
//     worker can carry (`payModel: 'monthly-plain'`), not a guard-only rule.
//     Guards are on it by default. (This app's reading of a five-word ruling;
//     soma-internal decisions/2026-09-24.md §8 (payroll).)
//
// A worker with no monthlyWage falls back to the fixed dailyRate, so an
// operator-added guard still prices. Rates are exact; callers floor the paid
// amount (per month on the pay path, per day on the cost views).
export function daysInMonthOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function guardDayRate(worker, dateStr) {
  const monthly = Number(worker && worker.monthlyWage);
  if (Number.isFinite(monthly) && monthly > 0) return monthly / daysInMonthOf(dateStr);
  return Math.max(Number(worker && worker.dailyRate) || 0, 0);
}

export function guardHourRate(worker, dateStr) {
  const h = Number(worker && worker.shiftHours);
  return guardDayRate(worker, dateStr) / (Number.isFinite(h) && h > 0 ? h : 12);
}

export function isGuard(cfg, worker) {
  return !!worker && Array.isArray(cfg.guardIds) && cfg.guardIds.includes(worker.id);
}

// Non-floor staff on the plain monthly model: every guard, plus any worker who
// carries the option. They are off the production roster and are priced by
// guardDayRate / guardHourRate, never by permOtRate.
export const PLAIN_PAY_MODEL = 'monthly-plain';
export function usesPlainRate(cfg, worker) {
  return isGuard(cfg, worker) || (!!worker && worker.payModel === PLAIN_PAY_MODEL);
}

// OT rate for anyone on the monthly tier: the plain hourly rate for non-floor
// staff on the plain model, the permanent rule for everyone else.
export function monthlyOtRate(cfg, worker, dateStr) {
  return usesPlainRate(cfg, worker) ? guardHourRate(worker, dateStr) : permOtRate(cfg, worker);
}


// Build the storage-key suffix used by attendance subtables.
export function getAttKey(type, id, date) {
  return `${id}_${date.replace(/-/g, '_')}`;
}

// --- Day wages: sum of CW hourly + Perm daily + guard daily for one date.
//
// Inputs are the attendance stores + worker rosters, so this function is
// pure given its arguments.
export function calcDayWages({
  date, cfg, cwAtt, peAtt, activeCW, activePermProd, guards,
}) {
  let total = 0;

  for (const w of activeCW) {
    const k = getAttKey('cw', w.id, date);
    const rec = cwAtt[k];
    if (!rec || rec.status === 'A') continue;
    let hours = cfg.standardShift.hours;
    if (rec.otHours) hours += rec.otHours;
    total += sepRound(hours * cwHourRate(cfg, w.id));
  }

  for (const w of activePermProd) {
    const k = getAttKey('perm', w.id, date);
    const rec = peAtt[k];
    if (!rec || rec.status === 'A') continue;
    if (usesPlainRate(cfg, w)) {
      // A plain-model worker passed in the production list: price him as one.
      total += sepRound(guardDayRate(w, date));
      if (rec.otHours && rec.otHours > 0) total += sepRound(rec.otHours * guardHourRate(w, date));
      continue;
    }
    total += w.dailyRate;
    if (rec.otHours && rec.otHours > 0) {
      const otRate = permOtRate(cfg, w);
      total += sepRound(rec.otHours * otRate);
    }
  }

  for (const w of guards) {
    const k = getAttKey('perm', w.id, date);
    const rec = peAtt[k];
    if (!rec || rec.status === 'A') continue;
    // Day rate follows the month (₹9,000 ÷ days); hours beyond his 12-hour
    // shift at his plain hourly rate. Floored per day: a cost view, not pay.
    total += sepRound(guardDayRate(w, date));
    if (rec.otHours && rec.otHours > 0) total += sepRound(rec.otHours * guardHourRate(w, date));
  }

  return total;
}

// --- Month wages: sum calcDayWages over every day of the month up to today.
export function calcMonthWages({
  date, today, cfg, cwAtt, peAtt, activeCW, activePermProd, guards,
}) {
  const d = new Date(date + 'T00:00:00');
  const y = d.getFullYear(); const m = d.getMonth();
  const todayDay = new Date(today + 'T00:00:00').getDate();
  let total = 0;
  for (let i = 1; i <= todayDay; i++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    total += calcDayWages({
      date: ds, cfg, cwAtt, peAtt, activeCW, activePermProd, guards,
    });
  }
  return total;
}

// --- CW Weekly Pay: Mon–Sat aggregation for a given Saturday date.
export function calcCWWeeklyPay({
  satDate, cfg, cwAtt, cwAdv, prodLogs, permSnacks, activeCW,
}) {
  const sat = new Date(satDate + 'T00:00:00');
  const mon = new Date(sat); mon.setDate(mon.getDate() - 5);

  const workers = activeCW.map((w) => {
    let days = 0; let hours = 0; let otH = 0; let wage = 0;
    for (let d = new Date(mon); d <= sat; d.setDate(d.getDate() + 1)) {
      const ds = localDateStr(d);
      const k = getAttKey('cw', w.id, ds);
      const rec = cwAtt[k];
      if (!rec || rec.status === 'A') continue;
      days++;
      const dayH = cfg.standardShift.hours + (rec.otHours || 0);
      hours += dayH;
      otH += rec.otHours || 0;
      wage += sepRound(dayH * cwHourRate(cfg, w.id));
    }
    const advKey = `${w.id}_${satDate}`;
    const advance = cwAdv[advKey] || 0;
    return { id: w.id, name: w.name, days, hours, otH, wage, advance, net: wage - advance };
  });

  let extraTotal = 0; let snackTotal = 0;
  for (let d = new Date(mon); d <= sat; d.setDate(d.getDate() + 1)) {
    const ds = localDateStr(d);
    const prod = prodLogs[ds];
    extraTotal += prod?.totals?.extraCost || 0;
    snackTotal += prod?.totals?.snackCost || 0;
  }

  const weekSnacks = (permSnacks || []).filter((s) => s.week === satDate);
  const permSnackTotal = weekSnacks.reduce((sum, s) => sum + (s.snack || 0), 0);

  const cwWageTotal = workers.reduce((s, w) => s + w.wage, 0);
  const cwAdvTotal = workers.reduce((s, w) => s + w.advance, 0);
  const grandTotal = cwWageTotal - cwAdvTotal + extraTotal + snackTotal + permSnackTotal;

  return {
    workers, cwWageTotal, cwAdvTotal, extraTotal, snackTotal, permSnackTotal,
    grandTotal, satDate, monDate: localDateStr(mon),
  };
}

// --- Perm Monthly Pay: per-worker base+OT-advance for the month containing `date`,
// summed up to `today`.
export function calcPermMonthlyPay({
  date, today, cfg, peAtt, peAdv, activePermProd, guards,
}) {
  const d = new Date(date + 'T00:00:00');
  const y = d.getFullYear(); const m = d.getMonth();
  const todayDay = new Date(today + 'T00:00:00').getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const all = [...activePermProd, ...guards];
  const guardSet = new Set(guards.map((g) => g.id));

  const workers = all.map((w) => {
    // Day pay and OT are accumulated UNROUNDED and floored once for the month
    // (BM, 23 Sep). A guard's day and hour rates follow the month's length.
    // One definition of a guard: in the guards list passed in, or in
    // cfg.guardIds (Janus L-3).
    const guard = guardSet.has(w.id) || usesPlainRate(cfg, w);
    let days = 0; let otH = 0; let baseExact = 0; let otExact = 0;
    for (let i = 1; i <= Math.min(todayDay, daysInMonth); i++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const k = getAttKey('perm', w.id, ds);
      const rec = peAtt[k];
      if (!rec || rec.status === 'A') continue;
      days++;
      baseExact += guard ? guardDayRate(w, ds) : w.dailyRate;
      if (rec.otHours && rec.otHours > 0) {
        otExact += rec.otHours * (guard ? guardHourRate(w, ds) : permOtRate(cfg, w));
        otH += rec.otHours;
      }
    }
    const basePay = sepRound(baseExact);
    const otPay = sepRound(otExact);
    const advKey = `${w.id}_${y}_${m + 1}`;
    const advance = peAdv[advKey] || 0;
    return {
      id: w.id, name: w.name, role: w.role,
      days, otH, basePay, otPay, advance,
      total: basePay + otPay - advance,
    };
  });

  const grandTotal = workers.reduce((s, w) => s + w.total, 0);
  return {
    workers, grandTotal,
    month: `${y}-${String(m + 1).padStart(2, '0')}`,
    daysInMonth,
  };
}

// Re-export getWeekEnd for convenience to callers that already import from
// payroll.js (avoids an extra import statement at every call site).
export { getWeekEnd };
