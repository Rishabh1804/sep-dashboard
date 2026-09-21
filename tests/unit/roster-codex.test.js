import { DEF_PERM, DEF_CW } from '../../src/shared/config/workers.js';
import { DEF_AREAS } from '../../src/shared/config/areas.js';
import { DEF_CFG } from '../../src/shared/config/wage.js';
import { cwHourRate } from '../../src/shared/utils/payroll.js';

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
    // 496 stays legitimate as permOtBaseRate (a standing convention), but no
    // worker's OWN daily rate is 496 on the ratified card.
    expect(DEF_PERM.filter((w) => w.dailyRate === 496)).toEqual([]);
    expect(DEF_CFG.permOtBaseRate).toBe(496);
  });

  test('contract hands are ₹47.50/hr = ₹380/day at 1.0×', () => {
    expect(DEF_CFG.hourRate).toBe(47.5);
    expect(DEF_CFG.hourRate * DEF_CFG.standardShift.hours).toBe(380);
  });
});

describe('Champai override — an open question, held open', () => {
  test('only Champai is overridden', () => {
    expect(Object.keys(DEF_CFG.hourRateOverrides)).toEqual(['champai']);
  });

  test('he stays on the framework office rate, not swept to the new global', () => {
    expect(cwHourRate(DEF_CFG, 'champai')).toBe(41.25);
    expect(cwHourRate(DEF_CFG, 'shambhu')).toBe(47.5);
  });

  test('a cfg with no overrides key still resolves (older persisted settings)', () => {
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
