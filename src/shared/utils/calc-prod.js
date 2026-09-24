// Production-day pure calculations. These were inlined in v2.1
// inside tabs/production.js; per audit, promoted to Layer 1 by
// taking `areas` as a parameter (no internal storage reads).

import { sepRound } from './currency.js';

// Initial empty production-day shape used when a date has no log.
export function initProdDay() {
  return {
    periods: {
      morningOT: { active: false, hours: 3, areas: {}, workers: [] },
      standard:  { active: true,  hours: 8, areas: {}, workers: null },
      eveningOT: { active: false, hours: 3, areas: {}, workers: [] },
    },
    totals: { pieces: 0, weight: 0, extraHours: 0, extraCost: 0, snackCost: 0 },
    confirmed: false,
    timeline: [],
  };
}

// Required headcount for a single area in a single period.
// `areas` is the area registry; `prod` carries the current period state.
export function getReq(areaId, periodKey, prod, areas) {
  const a = areas.find((x) => x.id === areaId);
  if (!a) return 0;
  const pa = prod.periods[periodKey]?.areas?.[areaId];
  if (!pa) return 0;

  if (!a.dep) {
    if (pa.cap === 0) return 0;
    const cl = a.caps.find((c) => c.l === pa.cap);
    return cl ? cl.r : 0;
  }
  // Pickling VAT: scales with VAT A1+A2 occupancy.
  if (areaId === 'pickle_vat') {
    const a1c = prod.periods[periodKey].areas.vat_a1?.cap || 0;
    const a2c = prod.periods[periodKey].areas.vat_a2?.cap || 0;
    if (a1c === 0 && a2c === 0) return 0;
    if (a1c === 100 && a2c === 100) return 3;
    return 2;
  }
  // Pickling Barrel: scales with Barrel occupancy.
  if (areaId === 'pickle_barrel') {
    const bc = prod.periods[periodKey].areas.barrel?.cap || 0;
    if (bc === 0) return 0;
    if (bc <= 50) return 1;
    return 2;
  }
  return 0;
}

// Recompute total extra (shortfall) hours/cost and snack cost on the
// production-day record. Mutates `prod.totals.extraHours/extraCost/snackCost`.
export function recalcExtra(prod, areas, cfg) {
  let totalExtraH = 0;
  let totalExtraCost = 0;

  ['morningOT', 'standard', 'eveningOT'].forEach((pk) => {
    const period = prod.periods[pk];
    if (!period || (pk !== 'standard' && !period.active)) return;
    const hours = period.hours || (pk === 'standard' ? 8 : 3);
    let shortfall = 0;
    areas.forEach((area) => {
      const pa = period.areas?.[area.id];
      if (!pa) return;
      const req = getReq(area.id, pk, prod, areas);
      const assigned = pa.assigned?.length || 0;
      if (req > assigned) shortfall += (req - assigned);
    });
    const periodExtra = sepRound(shortfall * hours * (Number(cfg.hourRate) || 0));
    totalExtraH += shortfall * hours;
    totalExtraCost += periodExtra;
  });

  let snackCost = 0;
  const eveningOT = prod.periods.eveningOT;
  if (eveningOT?.active) {
    const snackWorkers = eveningOT.workers?.length || 0;
    snackCost = snackWorkers * (Number(cfg.snackRate) || 0);
  }

  prod.totals = prod.totals || {};
  prod.totals.extraHours = totalExtraH;
  prod.totals.extraCost = totalExtraCost;
  prod.totals.snackCost = snackCost;
}

// After a roster import: reprice the production days and perm snack entries that
// were recorded while no rate was loaded, so a fresh install's first days do not
// keep a ₹0 extra or snack cost for good (Janus J-H2). Only UNPRICED figures are
// touched — a day whose extra or snack already carries a cost keeps it, so priced
// (and possibly paid) history is never rewritten — and nothing in a locked month
// moves. `isLocked(month)` takes 'YYYY-MM'. Mutates the logs and snack entries it
// is given; returns how many of each it repriced, and the dates of priced days
// whose extra cost today's card would not give.
export function repriceUnpriced({ logs, snacks, areas, cfg, isLocked = () => false }) {
  const rate = Number(cfg.hourRate) || 0;
  const snackRate = Number(cfg.snackRate) || 0;
  let days = 0; let snackEntries = 0;
  const olderRateDates = []; const otherMismatchDates = [];
  for (const [date, prod] of Object.entries(logs || {})) {
    if (!prod || !prod.periods || isLocked(date.slice(0, 7))) continue;
    const t = prod.totals || {};
    // A day already PRICED is kept as recorded. If its cost differs from what
    // today's card gives for the SAME extra hours, it was priced at an older
    // rate; if the hours differ too, something else changed (area settings, a
    // legacy or hand-edited log) and it is reported separately, not blamed on
    // the rate (Janus J-M1 / Cipher L-A). Dates are returned so the pay
    // documents covering them can say so (Janus J-H1).
    if (t.extraCost && rate > 0) {
      const probe = JSON.parse(JSON.stringify(prod));
      recalcExtra(probe, areas, cfg);
      if (probe.totals.extraCost !== t.extraCost) {
        (probe.totals.extraHours === t.extraHours ? olderRateDates : otherMismatchDates).push(date);
      }
    }
    const extraUnpriced = (t.extraHours || 0) > 0 && !t.extraCost && rate > 0;
    const snackUnpriced = prod.periods.eveningOT?.active
      && (prod.periods.eveningOT.workers?.length || 0) > 0 && !t.snackCost && snackRate > 0;
    if (!extraUnpriced && !snackUnpriced) continue;
    const keep = { extraCost: t.extraCost, snackCost: t.snackCost };
    recalcExtra(prod, areas, cfg);
    if (!extraUnpriced) prod.totals.extraCost = keep.extraCost;
    if (!snackUnpriced) prod.totals.snackCost = keep.snackCost;
    days++;
  }
  for (const s of snacks || []) {
    if (!s || s.snack || snackRate <= 0 || isLocked(String(s.date || '').slice(0, 7))) continue;
    s.snack = snackRate;
    snackEntries++;
  }
  return { days, snackEntries, olderRateDates, otherMismatchDates };
}

// Of `dates`, those in [from, to] whose stored extra cost STILL differs from what
// the current card and areas give — so a day re-touched after the import (which
// reprices it) drops out on its own.
export function stillPrePriced({ logs, areas, cfg, dates, from, to }) {
  return (dates || []).filter((d) => {
    if (d < from || d > to) return false;
    const prod = logs && logs[d];
    if (!prod || !prod.periods || !prod.totals?.extraCost) return false;
    const probe = JSON.parse(JSON.stringify(prod));
    recalcExtra(probe, areas, cfg);
    return probe.totals.extraCost !== prod.totals.extraCost;
  });
}
