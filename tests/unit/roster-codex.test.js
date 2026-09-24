import { DEF_PERM, DEF_CW } from '../../src/shared/config/workers.js';
import { DEF_AREAS } from '../../src/shared/config/areas.js';
import { DEF_CFG } from '../../src/shared/config/wage.js';
import { getActivePermProd, getGuards } from '../../src/shared/storage/workers.js';

// The roster STRUCTURE is pinned to the soma-internal codex, which owns the
// roster: who is on it, which tier each worker sits in, canonical names, the
// area tier rules. It is restated here rather than imported because that repo is
// private — so this test's job is to fail loudly when someone edits the config
// without going back to the source.
//
// The rate card is NOT here, and not anywhere in this repo (Director's
// sensitive-data rule, 24 Sep 2026). Its pins live beside the file that carries
// it: soma-internal `scripts/build-dashboard-roster.py`, whose self-checks fail
// the build when a rate drifts from the ruling.
//
//   roster + tiers → operations/staff-aliases.md
//   tier rules     → frameworks/roles-responsibilities-v1.1.md

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

  test('Sambhu is on the monthly tier from September 2026', () => {
    expect(DEF_PERM.some((w) => w.id === 'shambhu')).toBe(true);
    expect(DEF_CW.some((w) => w.id === 'shambhu')).toBe(false);
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


// ── Non-floor staff on the plain monthly model (BM, 23 + 24 Sep 2026) ───────
// The guard's 7–7 shift is his standard day; he is off the production roster
// and is priced on the plain model. Any non-floor worker may carry the option.
describe('non-floor staff: the plain monthly model', () => {
  const uday = byId.uday;

  test('Uday carries the plain monthly model and a 12-hour shift explicitly', () => {
    expect(uday.payModel).toBe('monthly-plain');
    expect(uday.shiftHours).toBe(12);
  });

  test('the production roster (getActivePermProd) leaves Uday out; he is the one guard', () => {
    localStorage.clear();
    expect(getActivePermProd().map((w) => w.id)).not.toContain('uday');
    expect(getGuards().map((w) => w.id)).toEqual(['uday']);
    expect(DEF_CFG.guardIds).toContain('uday');
    expect(uday && !uday.inactive).toBe(true);
  });

  test('a saved non-floor worker on the option leaves the production roster and joins the non-floor list', () => {
    localStorage.clear();
    localStorage.setItem('sep_pe_emp_v1', JSON.stringify([
      ...DEF_PERM,
      { id: 'office_x', name: 'Office', monthlyWage: 12000, shiftHours: 8, payModel: 'monthly-plain', inactive: false },
    ]));
    expect(getActivePermProd().map((w) => w.id)).not.toContain('office_x');
    expect(getGuards().map((w) => w.id)).toEqual(['uday', 'office_x']);
    localStorage.clear();
  });
});
