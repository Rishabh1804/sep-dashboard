import { initProdDay, getReq, recalcExtra } from '../../src/shared/utils/calc-prod.js';
import { DEF_AREAS } from '../../src/shared/config/areas.js';
import { DEF_CFG } from '../../src/shared/config/wage.js';

describe('initProdDay', () => {
  test('produces a 3-period skeleton with standard active', () => {
    const d = initProdDay();
    expect(d.periods.standard.active).toBe(true);
    expect(d.periods.morningOT.active).toBe(false);
    expect(d.periods.eveningOT.active).toBe(false);
    expect(d.confirmed).toBe(false);
    expect(d.timeline).toEqual([]);
  });
});

describe('getReq', () => {
  test('returns 0 when area cap is 0', () => {
    const prod = initProdDay();
    prod.periods.standard.areas = { vat_a1: { cap: 0, assigned: [] } };
    expect(getReq('vat_a1', 'standard', prod, DEF_AREAS)).toBe(0);
  });

  test('returns rated headcount for VAT A1 at 100%', () => {
    const prod = initProdDay();
    prod.periods.standard.areas = { vat_a1: { cap: 100, assigned: [] } };
    expect(getReq('vat_a1', 'standard', prod, DEF_AREAS)).toBe(5);
  });

  test('pickle_vat needs 3 when both VATs at 100%', () => {
    const prod = initProdDay();
    prod.periods.standard.areas = {
      vat_a1: { cap: 100, assigned: [] },
      vat_a2: { cap: 100, assigned: [] },
      // pickle_vat entry must exist (autoPickling creates it in real flow).
      pickle_vat: { cap: 1, assigned: [] },
    };
    expect(getReq('pickle_vat', 'standard', prod, DEF_AREAS)).toBe(3);
  });

  test('pickle_vat needs 2 with one VAT below 100%', () => {
    const prod = initProdDay();
    prod.periods.standard.areas = {
      vat_a1: { cap: 100, assigned: [] },
      vat_a2: { cap: 75, assigned: [] },
      pickle_vat: { cap: 1, assigned: [] },
    };
    expect(getReq('pickle_vat', 'standard', prod, DEF_AREAS)).toBe(2);
  });
});

describe('recalcExtra', () => {
  test('extraCost = 0 when assigned meets requirement', () => {
    const prod = initProdDay();
    prod.periods.standard.areas = {
      vat_a1: { cap: 100, assigned: ['a', 'b', 'c', 'd', 'e'] },
    };
    recalcExtra(prod, DEF_AREAS, DEF_CFG);
    expect(prod.totals.extraHours).toBe(0);
    expect(prod.totals.extraCost).toBe(0);
  });

  test('shortfall produces extraCost = floor(shortfall * hours * hourRate)', () => {
    const prod = initProdDay();
    prod.periods.standard.areas = {
      vat_a1: { cap: 100, assigned: ['a', 'b'] },  // 2 of 5 required
    };
    recalcExtra(prod, DEF_AREAS, DEF_CFG);
    expect(prod.totals.extraHours).toBe(3 * 8); // 3 short × 8 hours
    expect(prod.totals.extraCost).toBe(Math.floor(3 * 8 * DEF_CFG.hourRate));
  });
});

// ── Repricing on roster import (Janus J-H2) ──────────────────────────────────
import { repriceUnpriced, stillPrePriced } from '../../src/shared/utils/calc-prod.js';

describe('repriceUnpriced', () => {
  const areas = [{ id: 'a1', roster: [], caps: [] }];
  const cfg = { hourRate: 50, snackRate: 25 };
  const day = (extraHours, extraCost, snackCost, evWorkers = 2) => ({
    periods: { standard: { active: true, areas: {} }, eveningOT: { active: evWorkers > 0, hours: 3, workers: Array(evWorkers).fill('x'), areas: {} } },
    totals: { extraHours, extraCost, snackCost },
  });

  test('a day recorded with no rates gets its snack priced; a priced day is left as it was', () => {
    const logs = { '2026-09-10': day(0, 0, 0), '2026-09-11': day(0, 0, 40) };
    const r = repriceUnpriced({ logs, snacks: [], areas, cfg });
    expect(r.days).toBe(1);
    expect(logs['2026-09-10'].totals.snackCost).toBe(50);   // 2 × 25
    expect(logs['2026-09-11'].totals.snackCost).toBe(40);   // untouched
  });

  test('locked months never move; zero-rate snack entries are priced, priced ones kept', () => {
    const logs = { '2026-08-10': day(0, 0, 0) };
    const snacks = [{ date: '2026-09-10', snack: 0 }, { date: '2026-09-11', snack: 20 }, { date: '2026-08-10', snack: 0 }];
    const r = repriceUnpriced({ logs, snacks, areas, cfg, isLocked: (m) => m === '2026-08' });
    expect(r).toEqual({ days: 0, snackEntries: 1, olderRateDates: [], otherMismatchDates: [] });
    expect(snacks.map((x) => x.snack)).toEqual([25, 20, 0]);
  });

  test('with no rate loaded there is nothing to price', () => {
    const logs = { '2026-09-10': day(0, 0, 0) };
    expect(repriceUnpriced({ logs, snacks: [{ date: '2026-09-10', snack: 0 }], areas, cfg: {} })).toEqual({ days: 0, snackEntries: 0, olderRateDates: [], otherMismatchDates: [] });
  });

  // An area whose requirement is 2 at cap 100, with nobody assigned: 2 short × 8 h = 16 extra hours.
  const shortArea = [{ id: 'a1', dep: false, caps: [{ l: 100, r: 2 }], roster: [] }];
  const shortDay = (extraHours, extraCost) => ({
    periods: { standard: { active: true, hours: 8, areas: { a1: { cap: 100, assigned: [] } } }, eveningOT: { active: false } },
    totals: { extraHours, extraCost, snackCost: 0 },
  });

  test('same extra hours at a different cost → an OLDER RATE; kept as recorded, date returned', () => {
    const logs = { '2026-09-12': shortDay(16, 660) };      // 16 h at 41.25, today's card gives 16 × 50 = 800
    const r = repriceUnpriced({ logs, snacks: [], areas: shortArea, cfg });
    expect(r.olderRateDates).toEqual(['2026-09-12']);
    expect(r.otherMismatchDates).toEqual([]);
    expect(logs['2026-09-12'].totals.extraCost).toBe(660);
  });

  test('different extra hours → reported separately, never blamed on the rate (Janus J-M1)', () => {
    const logs = { '2026-09-12': shortDay(8, 88) };
    const r = repriceUnpriced({ logs, snacks: [], areas: shortArea, cfg });
    expect(r.olderRateDates).toEqual([]);
    expect(r.otherMismatchDates).toEqual(['2026-09-12']);
  });

  test('stillPrePriced: in range and still differing; a day repriced since drops out', () => {
    const logs = { '2026-09-12': shortDay(16, 660), '2026-09-13': shortDay(16, 800), '2026-10-01': shortDay(16, 660) };
    const dates = ['2026-09-12', '2026-09-13', '2026-10-01'];
    expect(stillPrePriced({ logs, areas: shortArea, cfg, dates, from: '2026-09-01', to: '2026-09-30' })).toEqual(['2026-09-12']);
  });
});
