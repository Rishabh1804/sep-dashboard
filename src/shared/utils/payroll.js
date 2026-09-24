// Payroll-math primitives. Per Phase 2 audit (resolution 4), these
// are pure functions promoted from tabs/finance.js to Layer 1; they
// take all dependencies as arguments and have no storage side-effects.
// Highest-leverage Jest test target.

import { sepRound } from './currency.js';
import { localDateStr, getWeekEnd } from './date.js';

// Hourly rate for one contract hand. Flat `cfg.hourRate` for everyone except
// the ids in `cfg.hourRateOverrides`. The map ships empty; the mechanism stays
// so a future exception never needs a second flat global (see config/wage.js).
// Tolerates a cfg with no overrides key so an older persisted settings blob
// keeps working. A rate not yet imported (null) is 0, never NaN.
export function cwHourRate(cfg, workerId) {
  const o = cfg.hourRateOverrides;
  const r = o && Object.prototype.hasOwnProperty.call(o, workerId) ? o[workerId] : cfg.hourRate;
  const n = Number(r);
  return r != null && Number.isFinite(n) ? n : 0;
}

// Permanent-tier OT rate (the rule; the figures arrive through the roster
// import — this repo is public and ships no pay data):
//
//   OT/hr = min(dailyRate, permOtBaseRate) ÷ 8 × permOtMultiplier
//
// Below the cap a man's OT is the multiplier × his own hourly rate; at or above
// it, the cap binds. The two are continuous at the cap.
//
// The RATE is deliberately not rounded (`sepRound` floors to whole rupees, and
// flooring a fractional rate underpays every hour). The paid AMOUNT is rounded
// by the caller: calcPermMonthlyPay totals a month's hours × rate and floors
// once; the daily cost views floor per day, as estimates rather than pay.
//
// Non-floor staff on the plain model are NOT priced by this rule: it returns 0
// for them, so a caller that reaches for it shows a visible zero instead of
// restoring a multiplier the plain model does not carry. Callers pricing the
// whole monthly tier go through monthlyOtRate.
//
// A missing or non-numeric dailyRate, cap or multiplier yields 0 — a visible
// zero, never NaN pay or a silently capped payment.
export function permOtRate(cfg, worker) {
  if (usesPlainRate(cfg, worker)) return 0;
  const daily = Math.max(Number(worker && worker.dailyRate) || 0, 0);
  const cap = Number(cfg.permOtBaseRate);
  const mult = Number(cfg.permOtMultiplier);
  if (!Number.isFinite(cap) || !Number.isFinite(mult)) return 0;
  return (Math.min(daily, cap) / 8) * mult;
}


// --- The plain monthly model: guards, and any non-floor worker carrying
// payModel 'monthly-plain' (the rulings are in soma-internal).
//   · Day rate  = monthlyWage ÷ the days in THAT month.
//   · Hourly    = day rate ÷ shiftHours (the shift is the standard day, and none
//     of it is overtime). No multiplier.
//   · Hours above the shift, and directed work inside it, are paid at the
//     hourly rate. otHours on such a worker means those hours.
// A worker with no monthlyWage falls back to dailyRate. Rates are exact;
// callers floor the paid amount (per month on the pay path, per day on the
// cost views).
// A worker's day rate, or 0 when none has been imported yet (pay data arrives
// through the roster import and never ships). Never NaN.
export function dayRateOf(worker) {
  const n = Number(worker && worker.dailyRate);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

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
    total += dayRateOf(w);
    if (rec.otHours && rec.otHours > 0) {
      const otRate = permOtRate(cfg, w);
      total += sepRound(rec.otHours * otRate);
    }
  }

  for (const w of guards) {
    const k = getAttKey('perm', w.id, date);
    const rec = peAtt[k];
    if (!rec || rec.status === 'A') continue;
    // Day rate follows the month (monthly wage ÷ days); hours beyond the shift
    // at the plain hourly rate. Floored per day: a cost view, not pay.
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
      baseExact += guard ? guardDayRate(w, ds) : dayRateOf(w);
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
