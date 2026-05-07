// Payroll-math primitives. Per Phase 2 audit (resolution 4), these
// are pure functions promoted from tabs/finance.js to Layer 1; they
// take all dependencies as arguments and have no storage side-effects.
// Highest-leverage Jest test target.

import { sepRound } from './currency.js';
import { localDateStr, getWeekEnd } from './date.js';

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
    total += sepRound(hours * cfg.hourRate);
  }

  for (const w of activePermProd) {
    const k = getAttKey('perm', w.id, date);
    const rec = peAtt[k];
    if (!rec || rec.status === 'A') continue;
    total += w.dailyRate;
    if (rec.otHours && rec.otHours > 0) {
      const otRate = sepRound((cfg.permOtBaseRate / 8) * cfg.permOtMultiplier);
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
      wage += sepRound(dayH * cfg.hourRate);
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
        const rate = sepRound((cfg.permOtBaseRate / 8) * cfg.permOtMultiplier);
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
