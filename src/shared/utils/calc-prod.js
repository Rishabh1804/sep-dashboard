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
    const periodExtra = sepRound(shortfall * hours * cfg.hourRate);
    totalExtraH += shortfall * hours;
    totalExtraCost += periodExtra;
  });

  let snackCost = 0;
  const eveningOT = prod.periods.eveningOT;
  if (eveningOT?.active) {
    const snackWorkers = eveningOT.workers?.length || 0;
    snackCost = snackWorkers * cfg.snackRate;
  }

  prod.totals = prod.totals || {};
  prod.totals.extraHours = totalExtraH;
  prod.totals.extraCost = totalExtraCost;
  prod.totals.snackCost = snackCost;
}
