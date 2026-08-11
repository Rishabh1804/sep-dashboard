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
    // 4, not 5, since 11 Aug 2026: the top rung must equal the ratified
    // establishment (soma-internal operations/work-areas.md), or every
    // full-capacity A1 day credits a phantom body-block of EXTRA.
    expect(getReq('vat_a1', 'standard', prod, DEF_AREAS)).toBe(4);
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
      vat_a1: { cap: 100, assigned: ['a', 'b', 'c', 'd'] },  // establishment 4
    };
    recalcExtra(prod, DEF_AREAS, DEF_CFG);
    expect(prod.totals.extraHours).toBe(0);
    expect(prod.totals.extraCost).toBe(0);
  });

  test('shortfall produces extraCost = floor(shortfall * hours * hourRate)', () => {
    const prod = initProdDay();
    prod.periods.standard.areas = {
      vat_a1: { cap: 100, assigned: ['a', 'b'] },  // 2 of the establishment of 4
    };
    recalcExtra(prod, DEF_AREAS, DEF_CFG);
    expect(prod.totals.extraHours).toBe(2 * 8); // 2 short × 8 hours
    expect(prod.totals.extraCost).toBe(Math.floor(2 * 8 * DEF_CFG.hourRate));
  });
});
