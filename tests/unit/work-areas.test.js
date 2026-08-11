// Coupling tests for the canonical area / station / establishment definition.
// Source of truth: soma-internal `operations/work-areas.md` (ratified 11 Aug 2026).
// These pin the contract so a config edit cannot silently drift from the codex.

import { DEF_AREAS, DEF_FLOOR_AREAS, FLOOR_ESTABLISHMENT } from '../../src/shared/config/areas.js';
import { DEF_PERM, DEF_CW } from '../../src/shared/config/workers.js';
import { getReq, initProdDay, recalcExtra } from '../../src/shared/utils/calc-prod.js';

// The ratified establishment, confirmed against the register: Fri 7 / Sat 8 Aug
// 2026 are the only zero-EXTRA days of W32 and the only two with every station
// at these numbers.
const ESTABLISHMENT = {
  vat_a1: 4, vat_a2: 4, barrel: 3, pickle_barrel: 2, pickle_vat: 3,
};

describe('station establishment', () => {
  it('matches the canonical numbers', () => {
    const got = Object.fromEntries(DEF_AREAS.map((a) => [a.id, a.establishment]));
    expect(got).toEqual(ESTABLISHMENT);
  });

  it('sums to 16 floor hands', () => {
    expect(FLOOR_ESTABLISHMENT).toBe(16);
  });

  it("every independent area's top capacity rung equals its establishment", () => {
    // The rung the EXTRA deficit is computed against at full capacity. A top
    // rung above establishment credits a phantom body-block of EXTRA every
    // full day — exactly the vat_a1 r:5 defect fixed on 11 Aug.
    DEF_AREAS.filter((a) => !a.dep).forEach((a) => {
      const top = a.caps.find((c) => c.l === 100);
      expect([a.id, top.r]).toEqual([a.id, a.establishment]);
    });
  });

  it('dependent pickling areas reach establishment at full upstream capacity', () => {
    const prod = initProdDay();
    prod.periods.standard.areas = {
      vat_a1: { cap: 100 }, vat_a2: { cap: 100 }, barrel: { cap: 100 },
      pickle_vat: { cap: 0 }, pickle_barrel: { cap: 0 },
    };
    expect(getReq('pickle_vat', 'standard', prod, DEF_AREAS)).toBe(ESTABLISHMENT.pickle_vat);
    expect(getReq('pickle_barrel', 'standard', prod, DEF_AREAS)).toBe(ESTABLISHMENT.pickle_barrel);
  });
});

describe('EXTRA = (establishment - present) x block hours', () => {
  // BM, 11 Aug 2026. `recalcExtra` already implemented the shape; these pin it
  // to the ratified numbers using the two register days that confirmed them.
  const cfg = { hourRate: 47.5, snackRate: 20 };

  function standardDay(assigned) {
    const prod = initProdDay();
    prod.periods.standard.areas = {
      vat_a1:        { cap: 100, assigned: assigned.vat_a1 },
      vat_a2:        { cap: 100, assigned: assigned.vat_a2 },
      barrel:        { cap: 100, assigned: assigned.barrel },
      pickle_vat:    { cap: 100, assigned: assigned.pickle_vat },
      pickle_barrel: { cap: 100, assigned: assigned.pickle_barrel },
    };
    recalcExtra(prod, DEF_AREAS, cfg);
    return prod.totals;
  }

  const n = (k) => Array.from({ length: k }, (_, i) => `w${i}`);

  it('a fully manned floor books zero EXTRA (the Fri 7 / Sat 8 case)', () => {
    const t = standardDay({
      vat_a1: n(4), vat_a2: n(4), barrel: n(3), pickle_vat: n(3), pickle_barrel: n(2),
    });
    expect(t.extraHours).toBe(0);
    expect(t.extraCost).toBe(0);
  });

  it('the Mon 3 Aug shape: 11 present against 16 books 7 x 8 = 56 hours', () => {
    // A1 3 of 4 -> 1 · A2 4 of 4 -> 0 · barrel+barrel-pickling 2 of 5 -> 3 ·
    // VAT pickling 0 of 3 -> 3.  Total deficit 7 bodies.
    const t = standardDay({
      vat_a1: n(3), vat_a2: n(4), barrel: n(2), pickle_vat: [], pickle_barrel: [],
    });
    expect(t.extraHours).toBe(56);
    expect(t.extraCost).toBeCloseTo(56 * 47.5, 2);
  });

  it('an over-filled station never books negative EXTRA', () => {
    const t = standardDay({
      vat_a1: n(6), vat_a2: n(4), barrel: n(3), pickle_vat: n(3), pickle_barrel: n(2),
    });
    expect(t.extraHours).toBe(0);
  });
});

describe('area <-> station mapping', () => {
  it('every station names a floor area that exists', () => {
    const ids = new Set(DEF_FLOOR_AREAS.map((f) => f.id));
    DEF_AREAS.forEach((a) => expect(ids.has(a.area)).toBe(true));
  });

  it('is bidirectional — every floor area lists exactly the stations that name it', () => {
    DEF_FLOOR_AREAS.forEach((f) => {
      const back = DEF_AREAS.filter((a) => a.area === f.id).map((a) => a.id).sort();
      expect([f.id, back]).toEqual([f.id, [...f.stations].sort()]);
    });
  });

  it('Area 4 holds two stations — pickling is one place and two crews', () => {
    const a4 = DEF_FLOOR_AREAS.find((f) => f.id === 'area_4');
    expect(a4.stations).toHaveLength(2);
  });
});

describe('area rosters resolve against the worker registry', () => {
  const active = new Set(
    [...DEF_PERM, ...DEF_CW].filter((w) => !w.inactive).map((w) => w.id),
  );

  it('every rostered id is an active worker', () => {
    DEF_AREAS.forEach((a) => {
      a.roster.forEach((id) => expect([a.id, id, active.has(id)]).toEqual([a.id, id, true]));
    });
  });

  it('every station can actually be manned to establishment', () => {
    DEF_AREAS.forEach((a) => {
      expect([a.id, a.roster.length >= a.establishment]).toEqual([a.id, true]);
    });
  });

  it('the two workers the config had lost are back and assignable', () => {
    expect(active.has('rakesh')).toBe(true);
    expect(active.has('vijay')).toBe(true);
  });

  it('the two AWOL workers are retained as ids but never offered', () => {
    const all = new Set([...DEF_PERM, ...DEF_CW].map((w) => w.id));
    ['kusu', 'tuklu'].forEach((id) => {
      expect(all.has(id)).toBe(true);      // historical attendance still resolves
      expect(active.has(id)).toBe(false);  // not assignable
    });
  });
});
