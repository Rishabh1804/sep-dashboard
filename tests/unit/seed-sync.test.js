import { DEF_PERM, DEF_CW } from '../../src/shared/config/workers.js';
import { DEF_CFG } from '../../src/shared/config/wage.js';
import { DEF_AREAS } from '../../src/shared/config/areas.js';
import { reconcileSeed, reconcileWorkers } from '../../src/shared/storage/seed-sync.js';
import { MAIN_ERA } from './fixtures/main-era-seed.js';
import {
  permOtRate, cwHourRate, calcPermMonthlyPay, getAttKey,
} from '../../src/shared/utils/payroll.js';

// The state a pre-alpha.9 device holds (Janus B-1 / Castor C-H6, 23 Sep 2026).

const reconciled = () => reconcileSeed({
  savedPerm: MAIN_ERA.perm, savedCW: MAIN_ERA.cw, savedCfg: MAIN_ERA.cfg,
  defPerm: DEF_PERM, defCW: DEF_CW, defCfg: DEF_CFG, defAreas: DEF_AREAS,
});

describe('the fixture really is the stale state (so the tests below mean something)', () => {
  test('main-era seed carries the superseded rates', () => {
    expect(MAIN_ERA.cfg.hourRate).toBe(41.25);
    expect(MAIN_ERA.perm.find((w) => w.id === 'lal').dailyRate).toBe(496);
    expect(MAIN_ERA.cw.some((w) => w.id === 'shambhu')).toBe(true);
    expect(MAIN_ERA.perm.some((w) => w.id === 'shambhu')).toBe(false);
  });
});

describe('a main-era device reaches the September figures after reconcile', () => {
  const { perm, cw, cfg } = reconciled();
  const byId = (list, id) => list.find((w) => w.id === id);

  test('contract rate is ₹47.50 for every hand', () => {
    expect(cwHourRate(cfg, 'vijay')).toBe(47.5);
    expect(cwHourRate(cfg, 'champai')).toBe(47.5);
  });

  test.each([
    ['shyam_bera', 68.2], ['sharat_mahato', 68.2], ['rupa_bera', 68.2],
    ['sunil_mahato', 64.625], ['suklal', 60.5], ['lk_das', 57.75],
    ['bp_sharma', 56.375], ['shambhu', 52.25], ['lal', 49.5],
  ])('%s OT → ₹%s/hr', (id, rate) => {
    expect(permOtRate(cfg, byId(perm, id))).toBeCloseTo(rate, 10);
  });

  test('Uday is at ₹300/day and gets no OT', () => {
    expect(byId(perm, 'uday').dailyRate).toBe(300);
    expect(permOtRate(cfg, byId(perm, 'uday'))).toBe(0);
  });

  test('Sambhu is on the permanent list and OFF the contract list (never paid twice)', () => {
    expect(byId(perm, 'shambhu')).toBeTruthy();
    expect(byId(cw, 'shambhu')).toBeUndefined();
  });

  test('Rakesh and Vijay exist; the result matches a fresh install exactly', () => {
    expect(byId(cw, 'rakesh')).toBeTruthy();
    expect(byId(cw, 'vijay')).toBeTruthy();
    expect(perm).toEqual(DEF_PERM);
    expect(cw).toEqual(DEF_CW);
  });

  test('a September month computes on the ruled rate, by name', () => {
    const date = '2026-09-07';
    const { workers } = calcPermMonthlyPay({
      date, today: date, cfg, peAdv: {},
      peAtt: { [getAttKey('perm', 'shambhu', date)]: { status: 'P', otHours: 4 } },
      activePermProd: perm.filter((w) => w.id === 'shambhu'), guards: [], guardIds: cfg.guardIds,
    });
    expect(workers[0].otPay).toBe(209); // floor(4 × 52.25)
  });
});

describe('what the reconcile must NOT touch', () => {
  test('an operator-added worker survives, rate and all', () => {
    const added = { id: 'ramesh_ab12', name: 'Ramesh', role: 'Worker', dailyRate: 410, inactive: false };
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

  test('unknown legacy config keys are kept; shipped keys win', () => {
    const { cfg } = reconcileSeed({
      savedPerm: [], savedCW: [], savedCfg: { ...MAIN_ERA.cfg, legacyFlag: 'x' },
      defPerm: DEF_PERM, defCW: DEF_CW, defCfg: DEF_CFG, defAreas: DEF_AREAS,
    });
    expect(cfg.legacyFlag).toBe('x');
    expect(cfg.hourRate).toBe(DEF_CFG.hourRate);
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
