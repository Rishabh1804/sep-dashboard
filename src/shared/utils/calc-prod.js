// Production-day pure calculations. These were inlined in v2.1
// inside tabs/production.js; per audit, promoted to Layer 1 by
// taking `areas` as a parameter (no internal storage reads).

import { sepRound } from './currency.js';

// Block hours, per soma-internal `operations/work-areas.md` (BM 11 Aug 2026,
// and the 6 AM convention BM-ratified 11 Jun 2026 in attendance/2026-W24.md).
// The trio is additive to the clock spans the payout actually books:
//   3 + 8      = 11  = the 6 AM -> 5 PM span
//   3 + 8 + 7  = 18  = the 6 AM -> 12 AM span
// The 0.5 h by which 3 overstates the 2.5 h morning block is exactly the 0.5 h
// by which 8 understates the 8.5 h general span — they cancel, which is why
// block-booking and span-booking agree on a combined day. Do not "correct"
// either in isolation.
export const BLOCK_HOURS = { morningOT: 3, standard: 8, eveningOT: 7 };

// Initial empty production-day shape used when a date has no log.
export function initProdDay() {
  return {
    periods: {
      morningOT: { active: false, hours: BLOCK_HOURS.morningOT, areas: {}, workers: [] },
      standard:  { active: true,  hours: BLOCK_HOURS.standard,  areas: {}, workers: null },
      // 11 Aug 2026: was 3. The evening block runs 5 PM -> 12 AM = 7 hours.
      // At 3 the dashboard understated Thu 6 Aug's evening EXTRA by 20 h
      // (15 booked against the register's 35). Stored production days keep
      // whatever `hours` they were saved with — this changes the default only.
      eveningOT: { active: false, hours: BLOCK_HOURS.eveningOT, areas: {}, workers: [] },
    },
    totals: { pieces: 0, weight: 0, extraHours: 0, extraCost: 0, snackCost: 0 },
    confirmed: false,
    timeline: [],
  };
}

// THE assignment rule. `roster` means ELIGIBLE HERE, not assigned here — the
// registry lists everyone the register has ever placed at a station, so the VAT
// rosters run 9 names against an establishment of 4. Filtering `present`
// against that directly (what tabs/production.js did before 11 Aug 2026) lets
// one hand satisfy three stations at once and monotonically SUPPRESSES the
// EXTRA deficit: simulated against the register, Mon 3 Aug booked 16 h where
// the register wrote 56.
//
// Tie-break is ROSTER ORDER (BM, 11 Aug 2026) — when more eligible hands are
// present than the station needs, the first `req` names in the roster array are
// credited. That allocation is real money under the 11-Jun pro-rata ruling, so
// the order is a deliberate default and NOT a fact about who stood where. The
// operator overrides it per period; an operator-set assignment is not re-derived.
//
// Lives in Layer 1 rather than in the tab so it is directly testable — the
// previous test re-implemented this rule and therefore could not fail.
export function selectAssigned(area, periodKey, prod, areas, present, claimed) {
  const eligible = area.roster.filter((id) => present.includes(id) && !claimed.has(id));
  const req = getReq(area.id, periodKey, prod, areas);
  return req > 0 ? eligible.slice(0, req) : eligible;
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
    const hours = period.hours || BLOCK_HOURS[pk] || 0;
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
