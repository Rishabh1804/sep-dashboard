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
