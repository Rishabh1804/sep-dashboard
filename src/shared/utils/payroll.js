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
// per-worker rule would have paid Sambhu ₹52 against a ruled ₹52.25. Only the
// paid AMOUNT is floored, at the call site — PER DAY, which on these
// fractional rates under-pays a month by up to ₹1 per man per OT day against
// the payout files' month-total method. Granularity is an open BM question
// (soma-internal decisions/2026-09-23.md §5); not changed until ruled.
//
// Guards get NO OT (BM, 23 Sep: "Uday gets no OT. 7-7 is his shift."), so a
// guard id returns 0 here as well as being excluded upstream — the rate
// function itself must not price a guard's hours if a caller ever routes him in.
//
// A missing or non-numeric dailyRate, cap or multiplier yields 0 — a visible
// zero on the slip, not NaN pay or a silently capped payment.
export function permOtRate(cfg, worker) {
  if (worker && Array.isArray(cfg.guardIds) && cfg.guardIds.includes(worker.id)) return 0;
  const daily = Math.max(Number(worker && worker.dailyRate) || 0, 0);
  const cap = Number(cfg.permOtBaseRate);
  const mult = Number(cfg.permOtMultiplier);
  if (!Number.isFinite(cap) || !Number.isFinite(mult)) return 0;
  return (Math.min(daily, cap) / 8) * mult;
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
    total += w.dailyRate;
    if (rec.otHours && rec.otHours > 0) {
      const otRate = permOtRate(cfg, w);
      total += sepRound(rec.otHours * otRate);
    }
  }

  for (const w of guards) {
    const k = getAttKey('perm', w.id, date);
    const rec = peAtt[k];
    if (rec && rec.status !== 'A') total += w.dailyRate;
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
  date, today, cfg, peAtt, peAdv, activePermProd, guards, guardIds,
}) {
  const d = new Date(date + 'T00:00:00');
  const y = d.getFullYear(); const m = d.getMonth();
  const todayDay = new Date(today + 'T00:00:00').getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const all = [...activePermProd, ...guards];

  const workers = all.map((w) => {
    let days = 0; let otH = 0; let basePay = 0; let otPay = 0;
    for (let i = 1; i <= Math.min(todayDay, daysInMonth); i++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const k = getAttKey('perm', w.id, ds);
      const rec = peAtt[k];
      if (!rec || rec.status === 'A') continue;
      days++;
      basePay += w.dailyRate;
      if (rec.otHours && rec.otHours > 0 && !guardIds.includes(w.id)) {
        const rate = permOtRate(cfg, w);
        otPay += sepRound(rec.otHours * rate);
        otH += rec.otHours;
      }
    }
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
