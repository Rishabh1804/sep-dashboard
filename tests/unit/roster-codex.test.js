import { DEF_PERM, DEF_CW } from '../../src/shared/config/workers.js';
import { DEF_AREAS } from '../../src/shared/config/areas.js';
import { DEF_CFG } from '../../src/shared/config/wage.js';
import { getActivePermProd, getGuards } from '../../src/shared/storage/workers.js';
import {
  cwHourRate, permOtRate, calcDayWages, calcPermMonthlyPay, getAttKey,
  guardDayRate, guardHourRate, monthlyOtRate,
} from '../../src/shared/utils/payroll.js';

// These figures are PINNED to the soma-internal codex, which owns the roster
// and the rate card. They are restated here rather than imported because that
// repo is private and may not be checked out beside this one — so the test's
// job is to fail loudly when someone edits the config without going back to
// the source, not to derive the truth itself.
//
//   roster + tiers → operations/staff-aliases.md
//   rate card      → decisions/2026-06-10.md §1, effective 1 Apr 2026
//   tier rules     → frameworks/roles-responsibilities-v1.1.md
const CODEX_RATE_CARD = {
  shyam_bera: 576, sharat_mahato: 500, rupa_bera: 500, sunil_mahato: 470,
  suklal: 440, uday: 300, lk_das: 420, bp_sharma: 410, lal: 360, rounak: 0,
  // Moved to permanent effective September 2026 (BM, 21 Sep) at his existing
  // contract day rate — Rs 380 = Rs 47.50 x 8, so the tier changed and the
  // rate did not.
  shambhu: 380,
};
// Canonical floor/attendance spellings. "Lucky", "Shambhu" and "Mantu" are the
// variants this config used to carry; the codex canon is Lakhi / Sambhu / Montu.
const CODEX_NAMES = {
  shyam_bera: 'Shyam', sharat_mahato: 'Sarat', rupa_bera: 'Rupa',
  sunil_mahato: 'Sunil', suklal: 'Suklal', uday: 'Uday',
  lk_das: 'Lakhi', bp_sharma: 'Bhanu', lal: 'Lal', rounak: 'Rounak',
  shambhu: 'Sambhu', sripati: 'Sripati', budheswar: 'Budheswer', birsa: 'Birsa',
  rocky: 'Rocky', champai: 'Champai', sai: 'Sai', naren: 'Naren',
  mantu: 'Montu', rakesh: 'Rakesh', vijay: 'Vijay', kusu: 'Kusu', tuklu: 'Tuklu',
};
// Off the active pool, kept for historical attendance (staff-aliases.md
// § "Workers off active pool") — inactive, never deleted.
const OFF_POOL = ['kusu', 'tuklu', 'rounak'];
// "Job Work only, can flex VAT/Barrel areas, NOT Pickling."
const JOB_WORK_TIER = ['lk_das', 'bp_sharma', 'lal'];

const ALL = [...DEF_PERM, ...DEF_CW];
const active = ALL.filter((w) => !w.inactive);
const byId = Object.fromEntries(ALL.map((w) => [w.id, w]));

describe('roster matches the codex', () => {
  test('twenty active workers — the /20 denominator every file since W29 uses', () => {
    expect(active).toHaveLength(20);
  });

  test('the split is 10 monthly + 10 daily after Sambhu\'s September move', () => {
    expect(DEF_PERM.filter((w) => !w.inactive)).toHaveLength(10);
    expect(DEF_CW.filter((w) => !w.inactive)).toHaveLength(10);
  });

  test('Sambhu is on the monthly tier at his existing day rate', () => {
    expect(DEF_PERM.some((w) => w.id === 'shambhu')).toBe(true);
    expect(DEF_CW.some((w) => w.id === 'shambhu')).toBe(false);
    // Rs 380/day is exactly the contract day rate, so the move is a change of
    // instrument (rest credit, Sundays, OT x1.1), not of pay.
    expect(byId.shambhu.dailyRate).toBe(DEF_CFG.hourRate * DEF_CFG.standardShift.hours);
  });

  test('Rakesh and Vijay are present — both joined after the original seed', () => {
    expect(byId.rakesh).toBeDefined();
    expect(byId.vijay).toBeDefined();
    expect(byId.rakesh.inactive).toBe(false);
    expect(byId.vijay.inactive).toBe(false);
  });

  test('off-pool workers are inactive, not deleted', () => {
    for (const id of OFF_POOL) {
      expect(byId[id]).toBeDefined();          // deleting orphans their attendance
      expect(byId[id].inactive).toBe(true);
    }
  });

  test('canonical names, not Shyam-relay spellings', () => {
    for (const [id, name] of Object.entries(CODEX_NAMES)) {
      expect(byId[id]).toBeDefined();
      expect(byId[id].name).toBe(name);
    }
  });

  test('no duplicate ids across the two pools', () => {
    const ids = ALL.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// A worker id is a Firestore doc path segment (workers/{id}/shifts) and the
// prefix of every localStorage attendance key. Renaming one orphans staging
// data and every device's history, so the id set is pinned deliberately: this
// test failing means someone attempted a migration, not a config tweak.
describe('worker ids are stable', () => {
  test('exact id set', () => {
    expect(ALL.map((w) => w.id).sort()).toEqual([
      'birsa', 'bp_sharma', 'budheswar', 'champai', 'kusu', 'lal', 'lk_das',
      'mantu', 'naren', 'rakesh', 'rocky', 'rounak', 'rupa_bera', 'sai',
      'shambhu', 'sharat_mahato', 'shyam_bera', 'sripati', 'suklal',
      'sunil_mahato', 'tuklu', 'uday', 'vijay',
    ]);
  });
});

describe('rate card — ratified 1 Apr 2026', () => {
  test('every permanent daily rate matches the codex', () => {
    for (const [id, rate] of Object.entries(CODEX_RATE_CARD)) {
      expect(byId[id]).toBeDefined();
      expect(`${id}=${byId[id].dailyRate}`).toBe(`${id}=${rate}`);
    }
  });

  test('the flat 496 placeholder is gone from individual rates', () => {
    // 496 stays legitimate as permOtBaseRate — since 23 Sep it is the OT CAP
    // (min(daily, 496) ÷ 8 × 1.1) — but no worker's OWN daily rate is 496 on
    // the ratified card.
    expect(DEF_PERM.filter((w) => w.dailyRate === 496)).toEqual([]);
    expect(DEF_CFG.permOtBaseRate).toBe(496);
  });

  test('contract hands are ₹47.50/hr = ₹380/day at 1.0×', () => {
    expect(DEF_CFG.hourRate).toBe(47.5);
    expect(DEF_CFG.hourRate * DEF_CFG.standardShift.hours).toBe(380);
  });
});

describe('per-worker rate overrides', () => {
  test('none today — Champai was ruled onto the contract rate on 21 Sep', () => {
    expect(DEF_CFG.hourRateOverrides).toEqual({});
    expect(cwHourRate(DEF_CFG, 'champai')).toBe(47.5);
  });

  test('every daily hand resolves to the one contract rate', () => {
    for (const w of DEF_CW.filter((x) => !x.inactive)) {
      expect(`${w.id}=${cwHourRate(DEF_CFG, w.id)}`).toBe(`${w.id}=47.5`);
    }
  });

  test('the mechanism still works, and tolerates a junk or missing map', () => {
    expect(cwHourRate({ hourRate: 47.5, hourRateOverrides: { champai: 41.25 } }, 'champai')).toBe(41.25);
    expect(cwHourRate({ hourRate: 47.5 }, 'champai')).toBe(47.5);
    expect(cwHourRate({ hourRate: 47.5, hourRateOverrides: { champai: 'oops' } }, 'champai')).toBe(47.5);
  });
});

describe('area rosters honour the tier rules', () => {
  test('the job-work tier never appears on a pickling area', () => {
    const offences = [];
    for (const a of DEF_AREAS.filter((x) => x.id.startsWith('pickle'))) {
      for (const id of a.roster) {
        if (JOB_WORK_TIER.includes(id)) offences.push(`${a.id}:${id}`);
      }
    }
    expect(offences).toEqual([]);
  });

  test('every roster id exists and is active', () => {
    const offences = [];
    for (const a of DEF_AREAS) {
      for (const id of a.roster) {
        if (!byId[id]) offences.push(`${a.id}: unknown ${id}`);
        else if (byId[id].inactive) offences.push(`${a.id}: inactive ${id}`);
      }
    }
    expect(offences).toEqual([]);
  });

  test('no area is left uncrewable', () => {
    // production.js assigns every PRESENT roster member, so an empty roster
    // means that area can never be crewed.
    for (const a of DEF_AREAS) expect(a.roster.length).toBeGreaterThan(0);
  });
});

describe('handler picker sees the live floor', () => {
  test('inactive workers are filtered out of the 20', () => {
    const names = active.map((w) => w.name);
    expect(names).toContain('Vijay');
    expect(names).toContain('Rakesh');
    expect(names).not.toContain('Kusu');
    expect(names).not.toContain('Tuklu');
    expect(names).not.toContain('Rounak');
  });
});


// ── Perm OT per man, from the SHIPPED config — BM ruling, 23 Sep 2026 ──────
// OT/hr = min(dailyRate, 496) ÷ 8 × 1.1 (soma-internal `decisions/2026-09-23.md`
// §4). Pinned per worker so that a change to anyone's daily rate that moves his
// OT fails here, by name, rather than surfacing on a slip.
describe('perm OT rate per worker (ruled 23 Sep 2026)', () => {
  const expected = {
    shyam_bera: 68.2,   // 576 → capped (79.20 uncapped)
    sharat_mahato: 68.2, // 500 → capped (68.75 uncapped)
    rupa_bera: 68.2,    // 500 → capped (68.75 uncapped)
    sunil_mahato: 64.625, // 470
    suklal: 60.5,       // 440
    shambhu: 52.25,     // 380 — the ruling names this figure explicitly
    lk_das: 57.75,      // 420 (Lakhi)
    bp_sharma: 56.375,  // 410 (Bhanu)
    lal: 49.5,          // 360
  };

  test('every active non-guard perm man is pinned, and none is left unpinned', () => {
    const active = DEF_PERM
      .filter((w) => !w.inactive && !DEF_CFG.guardIds.includes(w.id))
      .map((w) => w.id).sort();
    expect(active).toEqual(Object.keys(expected).sort());
  });

  test.each(Object.entries(expected))('%s → ₹%s/hr', (id, rate) => {
    const w = DEF_PERM.find((x) => x.id === id);
    expect(permOtRate(DEF_CFG, w)).toBeCloseTo(rate, 10);
  });

  test('exactly three men sit on the cap, and they are the three above ₹496', () => {
    const capped = DEF_PERM.filter((w) => !w.inactive && w.dailyRate >= DEF_CFG.permOtBaseRate)
      .map((w) => w.id).sort();
    expect(capped).toEqual(['rupa_bera', 'sharat_mahato', 'shyam_bera']);
  });
});


// ── The guard: 7–7 is his day; hours beyond it at his plain, month-set rate ──
// BM rulings, pinned against the SHIPPED config:
//   14 Sep — ₹9,000/month; day rate = ₹9,000 ÷ days in THAT month. August was
//            ruled at ₹8,129.03 (28 days × 9000 ÷ 31).
//   23 Sep — "7-7 is his shift": the gate shift is never OT.
//   23 Sep — hours beyond the 12 are paid at his PLAIN hourly rate, no 1.1×,
//            and that rate follows the days in the month.
// ⚠ Hourly = day rate ÷ 12 (his shift) is this app's reading of "based on the
// days in that month"; the ruling does not state the divisor.
describe('the guard: month-set day rate, plain hourly rate beyond 12 h (ruled 14 + 23 Sep 2026)', () => {
  const uday = DEF_PERM.find((w) => w.id === 'uday');
  const sep = '2026-09-07';   // 30-day month
  const oct = '2026-10-07';   // 31-day month
  const keyOf = (ds) => getAttKey('perm', 'uday', ds);
  const dayWages = (ds, rec) => calcDayWages({
    date: ds, cfg: DEF_CFG, cwAtt: {}, activeCW: [], activePermProd: [], guards: [uday],
    peAtt: { [keyOf(ds)]: rec },
  });

  test('the production roster (getActivePermProd) leaves Uday out; he is the one guard', () => {
    localStorage.clear();
    expect(getActivePermProd().map((w) => w.id)).not.toContain('uday');
    expect(getGuards().map((w) => w.id)).toEqual(['uday']);
    expect(DEF_CFG.guardIds).toContain('uday');
    expect(uday && !uday.inactive).toBe(true);
  });

  test('his rates follow the month: ₹300/day + ₹25/hr in September, ₹290.32 + ₹24.19 in October', () => {
    expect(guardDayRate(uday, sep)).toBeCloseTo(300, 10);
    expect(guardHourRate(uday, sep)).toBeCloseTo(25, 10);
    expect(guardDayRate(uday, oct)).toBeCloseTo(9000 / 31, 10);
    expect(guardHourRate(uday, oct)).toBeCloseTo(9000 / 31 / 12, 10);
    expect(guardHourRate(uday, '2027-02-10')).toBeCloseTo(9000 / 28 / 12, 10);
  });

  test('no multiplier: his OT rate is exactly his hourly rate, never the permanent 1.1× rule', () => {
    expect(monthlyOtRate(DEF_CFG, uday, sep)).toBe(guardHourRate(uday, sep));
    expect(monthlyOtRate(DEF_CFG, uday, sep)).not.toBeCloseTo(permOtRate(DEF_CFG, uday), 2);
    expect(monthlyOtRate(DEF_CFG, uday, sep)).not.toBeCloseTo(41.25, 2);
  });

  test('a plain 7–7 day (no OT recorded) pays the month\'s day rate and nothing more', () => {
    expect(dayWages(sep, { status: 'P' })).toBe(300);
    expect(dayWages(oct, { status: 'P' })).toBe(290);   // floor(290.32): a cost view
  });

  test('2 hr beyond the shift: day rate + floor(2 × hourly)', () => {
    expect(dayWages(sep, { status: 'P', otHours: 2 })).toBe(300 + 50);
    expect(dayWages(oct, { status: 'P', otHours: 2 })).toBe(290 + 48); // floor(48.39)
  });

  test('August reproduces the ruled ₹8,129.03 (28 days × 9000 ÷ 31), floored once to ₹8,129', () => {
    const peAtt = {};
    for (let d = 1; d <= 28; d++) peAtt[keyOf(`2026-08-${String(d).padStart(2, '0')}`)] = { status: 'P' };
    const { workers } = calcPermMonthlyPay({
      date: '2026-08-15', today: '2026-08-31', cfg: DEF_CFG, peAdv: {}, peAtt,
      activePermProd: [], guards: [uday],
    });
    const r = workers.find((x) => x.id === 'uday');
    expect(r.days).toBe(28);
    expect(r.basePay).toBe(8129);
  });

  test('calcPermMonthlyPay prices his extra hours per month at the month\'s plain rate', () => {
    const peAtt = {};
    for (let d = 1; d <= 10; d++) peAtt[keyOf(`2026-10-${String(d).padStart(2, '0')}`)] = { status: 'P', otHours: 3 };
    const { workers } = calcPermMonthlyPay({
      date: oct, today: '2026-10-31', cfg: DEF_CFG, peAdv: {}, peAtt,
      activePermProd: [], guards: [uday],
    });
    const r = workers.find((x) => x.id === 'uday');
    expect(r.otH).toBe(30);
    expect(r.otPay).toBe(725);             // floor(30 × 24.1935) — one month, one floor
    expect(r.basePay).toBe(2903);          // floor(10 × 290.32)
  });
});
