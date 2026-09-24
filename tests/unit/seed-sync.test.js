import { DEF_PERM, DEF_CW } from '../../src/shared/config/workers.js';
import { DEF_CFG, RATE_CFG_FIELDS } from '../../src/shared/config/wage.js';
import { DEF_AREAS } from '../../src/shared/config/areas.js';
import {
  reconcileSeed, reconcileWorkers, applyRosterImport, ROSTER_FORMAT, RATE_WORKER_FIELDS,
} from '../../src/shared/storage/seed-sync.js';
import { MAIN_ERA } from './fixtures/main-era-seed.js';
import {
  permOtRate, monthlyOtRate, cwHourRate, calcPermMonthlyPay, getAttKey,
} from '../../src/shared/utils/payroll.js';

// Two authorities (seed-sync.js): STRUCTURE ships and wins on every boot; PAY
// DATA never ships and arrives only through the roster import. Every figure in
// this file is invented — see tests/unit/fixtures/main-era-seed.js.

const reconciled = () => reconcileSeed({
  savedPerm: MAIN_ERA.perm, savedCW: MAIN_ERA.cw, savedCfg: MAIN_ERA.cfg,
  defPerm: DEF_PERM, defCW: DEF_CW, defCfg: DEF_CFG, defAreas: DEF_AREAS,
});
const byId = (list, id) => list.find((w) => w.id === id);
const strip = (list) => list.map((w) => {
  const o = { ...w };
  for (const f of RATE_WORKER_FIELDS) delete o[f];
  return o;
});

// A synthetic import file, in the format soma-internal emits.
const IMPORT = {
  format: ROSTER_FORMAT, version: 1, asOf: '2026-09-24',
  cfg: { hourRate: 50, permOtBaseRate: 484, snackRate: 25 },
  workers: [
    { id: 'shambhu', dailyRate: 410 },
    { id: 'shyam_bera', dailyRate: 600 },
    { id: 'uday', monthlyWage: 7200 },
  ],
};

describe('no pay data ships', () => {
  test('no shipped worker carries a rate', () => {
    for (const w of [...DEF_PERM, ...DEF_CW]) {
      for (const f of RATE_WORKER_FIELDS) expect(`${w.id}.${f}=${w[f]}`).toBe(`${w.id}.${f}=undefined`);
    }
  });

  test('every rate-card field in DEF_CFG is null; the rules (multiplier, shifts) still ship', () => {
    for (const f of RATE_CFG_FIELDS) expect(DEF_CFG[f]).toBeNull();
    expect(DEF_CFG.permOtMultiplier).toBe(1.1);
    expect(DEF_CFG.standardShift.hours).toBe(8);
  });

  test('a fresh install prices at zero, never NaN, until the roster is imported', () => {
    const { perm, cfg } = reconcileSeed({
      savedPerm: null, savedCW: null, savedCfg: null,
      defPerm: DEF_PERM, defCW: DEF_CW, defCfg: DEF_CFG, defAreas: DEF_AREAS,
    });
    expect(cwHourRate(cfg, 'vijay')).toBe(0);
    expect(permOtRate(cfg, byId(perm, 'suklal'))).toBe(0);
    expect(monthlyOtRate(cfg, byId(perm, 'uday'), '2026-09-07')).toBe(0);
  });
});

describe('the fixture really is the stale state (so the tests below mean something)', () => {
  test('main-era seed carries rates and the pre-September tiers', () => {
    expect(typeof MAIN_ERA.cfg.hourRate).toBe('number');
    expect(typeof byId(MAIN_ERA.perm, 'lal').dailyRate).toBe('number');
    expect(MAIN_ERA.cw.some((w) => w.id === 'shambhu')).toBe(true);
    expect(MAIN_ERA.perm.some((w) => w.id === 'shambhu')).toBe(false);
  });
});

describe('a main-era device after reconcile: structure is today\'s, rates are its own', () => {
  const { perm, cw, cfg } = reconciled();

  test('structure matches a fresh install exactly, rates aside', () => {
    expect(strip(perm)).toEqual(strip(DEF_PERM));
    expect(strip(cw)).toEqual(strip(DEF_CW));
  });

  test('the rates it held are kept — a transfer is a copy, never a wipe', () => {
    expect(cfg.hourRate).toBe(MAIN_ERA.cfg.hourRate);
    expect(cfg.permOtBaseRate).toBe(MAIN_ERA.cfg.permOtBaseRate);
    expect(byId(perm, 'lal').dailyRate).toBe(byId(MAIN_ERA.perm, 'lal').dailyRate);
  });

  test('Sambhu is on the permanent list and OFF the contract list (never paid twice)', () => {
    expect(byId(perm, 'shambhu')).toBeTruthy();
    expect(byId(cw, 'shambhu')).toBeUndefined();
    // He held no permanent rate before, so he has none until an import gives one.
    expect(byId(perm, 'shambhu').dailyRate).toBeUndefined();
  });

  test('Uday carries the plain model and his 12-hour shift from the shipped structure', () => {
    expect(byId(perm, 'uday')).toMatchObject({ payModel: 'monthly-plain', shiftHours: 12 });
  });
});

describe('the roster import door', () => {
  const imported = () => {
    const r = reconciled();
    return applyRosterImport(r, IMPORT);
  };

  test('applies the rate-card fields and each worker\'s rate, across both tiers', () => {
    const { perm, cfg, stats } = imported();
    expect(cfg).toMatchObject({ hourRate: 50, permOtBaseRate: 484, snackRate: 25 });
    expect(byId(perm, 'shambhu').dailyRate).toBe(410);
    expect(byId(perm, 'uday').monthlyWage).toBe(7200);
    expect(stats).toMatchObject({ workers: 3, cfg: 3, unknown: [], rejected: [] });
  });

  test('the imported figures price through the rules', () => {
    const { perm, cfg } = imported();
    expect(cwHourRate(cfg, 'vijay')).toBe(50);
    expect(permOtRate(cfg, byId(perm, 'shambhu'))).toBeCloseTo(56.375, 10);
    expect(permOtRate(cfg, byId(perm, 'shyam_bera'))).toBeCloseTo(66.55, 10);
    expect(monthlyOtRate(cfg, byId(perm, 'uday'), '2026-09-07')).toBeCloseTo(20, 10);
    const date = '2026-09-07';
    const { workers } = calcPermMonthlyPay({
      date, today: date, cfg, peAdv: {},
      peAtt: { [getAttKey('perm', 'shambhu', date)]: { status: 'P', otHours: 4 } },
      activePermProd: perm.filter((w) => w.id === 'shambhu'), guards: [],
    });
    expect(workers[0].otPay).toBe(225);   // floor(4 × 56.375)
  });

  test('an id this device does not hold is skipped and counted, never created', () => {
    const r = reconciled();
    const { perm, cw, stats } = applyRosterImport(r, { ...IMPORT, workers: [{ id: 'nobody', dailyRate: 1 }] });
    expect(stats.unknown).toEqual(['nobody']);
    expect(perm.length + cw.length).toBe(r.perm.length + r.cw.length);
  });

  test('a junk figure is rejected and named; the saved value stands', () => {
    const r = reconciled();
    const { perm, cfg, stats } = applyRosterImport(r, {
      ...IMPORT, cfg: { hourRate: 'x' }, workers: [{ id: 'lal', dailyRate: -5 }],
    });
    expect(stats.rejected).toEqual(['cfg.hourRate', 'lal.dailyRate']);
    expect(cfg.hourRate).toBe(r.cfg.hourRate);
    expect(byId(perm, 'lal').dailyRate).toBe(byId(r.perm, 'lal').dailyRate);
  });

  test('only rate fields move — a name, tier or role in the file is ignored', () => {
    const r = reconciled();
    const { perm } = applyRosterImport(r, {
      ...IMPORT, workers: [{ id: 'lal', dailyRate: 400, name: 'X', role: 'Y', payModel: 'monthly-plain' }],
    });
    expect(byId(perm, 'lal')).toEqual({ ...byId(r.perm, 'lal'), dailyRate: 400 });
  });

  test('refuses a file that is not a roster export', () => {
    const r = reconciled();
    expect(() => applyRosterImport(r, { format: 'sep-invoicing', version: 1 })).toThrow();
    expect(() => applyRosterImport(r, { ...IMPORT, version: 2 })).toThrow();
    expect(() => applyRosterImport(r, null)).toThrow();
  });

  test('an imported device survives the next boot\'s reconcile with its rates intact', () => {
    const once = imported();
    const again = reconcileSeed({
      savedPerm: once.perm, savedCW: once.cw, savedCfg: once.cfg,
      defPerm: DEF_PERM, defCW: DEF_CW, defCfg: DEF_CFG, defAreas: DEF_AREAS,
    });
    expect(again.perm).toEqual(once.perm);
    expect(again.cw).toEqual(once.cw);
    expect(again.cfg.hourRate).toBe(50);
  });
});

describe('what the reconcile must NOT touch', () => {
  test('an operator-added worker survives, rate and all', () => {
    const added = { id: 'ramesh_ab12', name: 'Ramesh', role: 'Worker', dailyRate: 123, inactive: false };
    const perm = reconcileWorkers([...MAIN_ERA.perm, added], DEF_PERM, DEF_CW);
    expect(perm.find((w) => w.id === 'ramesh_ab12')).toEqual(added);
  });

  test('an operator deactivation (stamped) survives; an unstamped stale flag does not', () => {
    const saved = DEF_CW.map((w) => ({ ...w }));
    const vijay = saved.find((w) => w.id === 'vijay');
    Object.assign(vijay, { inactive: true, deactivatedOn: '2026-09-20', deactivateReason: 'left' });
    const tuklu = saved.find((w) => w.id === 'tuklu');
    tuklu.inactive = false; // stale, no operator stamp
    const cw = reconcileWorkers(saved, DEF_CW, DEF_PERM);
    expect(cw.find((w) => w.id === 'vijay')).toMatchObject({ inactive: true, deactivatedOn: '2026-09-20' });
    expect(cw.find((w) => w.id === 'tuklu').inactive).toBe(true);
  });

  test('unknown legacy config keys are kept; shipped rule keys win', () => {
    const { cfg } = reconcileSeed({
      savedPerm: [], savedCW: [], savedCfg: { ...MAIN_ERA.cfg, legacyFlag: 'x', permOtMultiplier: 9 },
      defPerm: DEF_PERM, defCW: DEF_CW, defCfg: DEF_CFG, defAreas: DEF_AREAS,
    });
    expect(cfg.legacyFlag).toBe('x');
    expect(cfg.permOtMultiplier).toBe(DEF_CFG.permOtMultiplier);
  });

  test('idempotent: reconciling its own output changes nothing', () => {
    const once = reconciled();
    const twice = reconcileSeed({
      savedPerm: once.perm, savedCW: once.cw, savedCfg: once.cfg,
      defPerm: DEF_PERM, defCW: DEF_CW, defCfg: DEF_CFG, defAreas: DEF_AREAS,
    });
    expect(twice).toEqual(once);
  });

  test('garbage in storage does not throw', () => {
    expect(() => reconcileSeed({
      savedPerm: null, savedCW: 'x', savedCfg: [1],
      defPerm: DEF_PERM, defCW: DEF_CW, defCfg: DEF_CFG, defAreas: DEF_AREAS,
    })).not.toThrow();
  });
});
