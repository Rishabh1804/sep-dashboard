// The extraCost recompute (BM-authorised 11 Aug 2026).
//
// These exercise the pure planner against synthetic production days built from
// the real DEF_AREAS, so the establishment and the ladder are the ratified ones.

import { planExtraRateRecompute, planCfgRateFix, MIGRATION_ID } from '../../src/shared/storage/migrations.js';
import { DEF_AREAS } from '../../src/shared/config/areas.js';
import { DEF_CFG } from '../../src/shared/config/wage.js';
import { initProdDay, recalcExtra } from '../../src/shared/utils/calc-prod.js';

const OLD_RATE = 41.25;
const AT = '2026-08-11T00:00:00.000Z';

// Build a day the OLD code would have written: old rate, old vat_a1 ladder.
function storedDay({ a1 = [], a2 = [], barrel = [], pv = [], pb = [], a1cap = 100 } = {}) {
  const day = initProdDay();
  day.periods.standard.areas = {
    vat_a1:        { cap: a1cap, assigned: a1 },
    vat_a2:        { cap: 100, assigned: a2 },
    barrel:        { cap: 100, assigned: barrel },
    pickle_vat:    { cap: 100, assigned: pv },
    pickle_barrel: { cap: 100, assigned: pb },
  };
  const oldAreas = DEF_AREAS.map((a) => (a.id !== 'vat_a1' ? a : {
    ...a, caps: a.caps.map((c) => (c.l === 100 ? { ...c, r: 5 } : c)),
  }));
  recalcExtra(day, oldAreas, { ...DEF_CFG, hourRate: OLD_RATE });
  return day;
}

const n = (k) => Array.from({ length: k }, (_, i) => `w${i}`);
const plan = (logs) => planExtraRateRecompute(logs, DEF_AREAS, DEF_CFG, { at: AT });

describe('extraCost recompute', () => {
  it('corrects a day and records before/after on the day itself', () => {
    // A1 3 of 4 · A2 4 · barrel 2 of 3 · pickling 0 of 3 and 0 of 2.
    const logs = { '2026-08-03': storedDay({ a1: n(3), a2: n(4), barrel: n(2) }) };
    const before = logs['2026-08-03'].totals.extraCost;

    const { logs: out, report } = plan(logs);
    const day = out['2026-08-03'];

    expect(report.corrected).toBe(1);
    expect(day.totals.extraCost).toBeGreaterThan(before);
    expect(day.corrections).toHaveLength(1);
    expect(day.corrections[0].migration).toBe(MIGRATION_ID);
    expect(day.corrections[0].before.extraCost).toBe(before);
    expect(day.corrections[0].after.extraCost).toBe(day.totals.extraCost);
  });

  it('leaves operator-entered data untouched — only derived totals move', () => {
    const logs = { '2026-08-03': storedDay({ a1: n(3), a2: n(4), barrel: n(2) }) };
    const src = JSON.parse(JSON.stringify(logs['2026-08-03'].periods));
    const { logs: out } = plan(logs);
    expect(out['2026-08-03'].periods).toEqual(src);
  });

  it('is idempotent — a second pass finds nothing to change', () => {
    const logs = { '2026-08-03': storedDay({ a1: n(3), barrel: n(2) }) };
    const first = plan(logs);
    expect(first.report.corrected).toBe(1);

    // Re-planning the already-corrected log: it no longer reproduces under the
    // OLD config, so the gate refuses it rather than double-applying. That is
    // the gate doing its job, and it is why the K.migrations guard exists.
    const second = plan(first.logs);
    expect(second.report.corrected).toBe(0);
    expect(second.logs['2026-08-03'].totals.extraCost)
      .toBe(first.logs['2026-08-03'].totals.extraCost);
  });

  it('REFUSES a hand-edited day instead of overwriting it', () => {
    const logs = { '2026-08-03': storedDay({ a1: n(3), barrel: n(2) }) };
    logs['2026-08-03'].totals.extraCost = 9999;      // someone typed over it

    const { logs: out, report } = plan(logs);
    expect(report.corrected).toBe(0);
    expect(report.skippedUnreproducible).toBe(1);
    expect(report.flagged[0].date).toBe('2026-08-03');
    expect(out['2026-08-03'].totals.extraCost).toBe(9999);   // untouched
    expect(out['2026-08-03'].corrections).toBeUndefined();
  });

  it('a day that booked zero under BOTH configs is left alone', () => {
    // Zero under the OLD ladder needs FIVE on A1, because r:5 was the defect.
    // Five is above the ratified establishment of 4, so it is also zero now.
    const logs = {
      '2026-08-07': storedDay({
        a1: n(5), a2: n(4), barrel: n(3), pv: n(3), pb: n(2),
      }),
    };
    expect(logs['2026-08-07'].totals.extraCost).toBe(0);
    const { logs: out, report } = plan(logs);
    expect(report.corrected).toBe(0);
    expect(report.unchanged).toBe(1);
    expect(out['2026-08-07'].corrections).toBeUndefined();
  });

  it('the register\'s own fully-manned day (A1 = 4) was NOT zero under the old ladder', () => {
    // Fri 7 / Sat 8 Aug: every station at establishment, and the register wrote
    // no EXTRA. The old config disagreed — it booked a phantom A1 body-block.
    // This is the defect stated as a test.
    const day = storedDay({ a1: n(4), a2: n(4), barrel: n(3), pv: n(3), pb: n(2) });
    expect(day.totals.extraHours).toBe(8);
    const { logs: out } = plan({ '2026-08-07': day });
    expect(out['2026-08-07'].totals.extraHours).toBe(0);   // now agrees with the register
  });

  it('the two corrections pull in OPPOSITE directions and the report says so', () => {
    // A1 at 100% with 4 assigned: under the old ladder (r:5) that was a
    // 1-body deficit; under the ratified establishment (4) it is zero. So the
    // establishment fix LOWERS this day while the rate fix raises it.
    const logs = { '2026-08-06': storedDay({ a1: n(4), a2: n(4), barrel: n(2) }) };
    const { report } = plan(logs);
    expect(report.corrected).toBe(1);
    expect(report.raisedByRate).toBeGreaterThan(0);
    expect(report.loweredByEstablishment).toBeLessThan(0);
  });

  it('drops the phantom A1 body-block entirely on a full-capacity A1 day', () => {
    const logs = { '2026-08-06': storedDay({ a1: n(4), a2: n(4), barrel: n(3), pv: n(3), pb: n(2) }) };
    expect(logs['2026-08-06'].totals.extraHours).toBe(8);   // the phantom hand
    const { logs: out } = plan(logs);
    expect(out['2026-08-06'].totals.extraHours).toBe(0);
    expect(out['2026-08-06'].totals.extraCost).toBe(0);
  });

  it('DEFERS a day whose evening block is still booked at 3 — no false corrections[]', () => {
    const logs = { '2026-08-04': storedDay({ a1: n(3), barrel: n(2) }) };
    logs['2026-08-04'].periods.eveningOT.active = true;
    logs['2026-08-04'].periods.eveningOT.hours = 3;   // block actually runs 7
    logs['2026-08-04'].periods.eveningOT.areas = {};

    const { logs: out, report } = plan(logs);
    expect(report.eveningHours3Days).toBe(1);
    expect(report.deferredEveningHours).toHaveLength(1);
    expect(report.deferredEveningHours[0].date).toBe('2026-08-04');
    // Not rewritten, and NOT stamped as corrected — a corrections[] entry on a
    // day whose evening is still 3 asserts an assurance that is false.
    expect(out['2026-08-04'].periods.eveningOT.hours).toBe(3);
    expect(out['2026-08-04'].corrections).toBeUndefined();
    expect(report.corrected).toBe(0);
  });

  it('tolerates malformed or empty day records', () => {
    const { report } = plan({ '2026-08-01': null, '2026-08-02': { totals: {} } });
    expect(report.skippedNoTotals).toBe(2);
    expect(report.corrected).toBe(0);
  });

  it('nets the delta across a mixed week and keeps a per-day trail', () => {
    const logs = {
      '2026-08-03': storedDay({ a1: n(3), a2: n(4), barrel: n(2) }),
      '2026-08-06': storedDay({ a1: n(4), a2: n(4), barrel: n(3), pv: n(3), pb: n(2) }),
      '2026-08-07': storedDay({ a1: n(5), a2: n(4), barrel: n(3), pv: n(3), pb: n(2) }),
    };
    const { report } = plan(logs);
    expect(report.scanned).toBe(3);
    expect(report.changes.map((c) => c.date)).toEqual(['2026-08-03', '2026-08-06']);
    expect(report.corrected).toBe(2);
    expect(report.unchanged).toBe(1);
    expect(report.corrected + report.unchanged).toBe(3);
  });
});

describe('the stored-config shadow — the same trap as getAreas(), one file over', () => {
  // initData() seeded K.prodCfg with the WHOLE DEF_CFG in May, freezing
  // hourRate 41.25 into storage; getCfg() spreads saved OVER defaults, so the
  // corrected 47.50 never reaches an existing install. Unhandled, the recompute
  // would read 41.25 as the "new" rate, find nothing changed, and mark itself
  // applied — permanently recording that there was nothing to correct.
  it('replaces a stored 41.25 with the ruled rate', () => {
    const { cfg, changed } = planCfgRateFix({ hourRate: 41.25, snackRate: 20 });
    expect(changed).toBe(true);
    expect(cfg.hourRate).toBe(47.5);
    expect(cfg.snackRate).toBe(20);          // nothing else touched
  });

  it('leaves an already-correct stored rate alone', () => {
    const { changed, unexpected } = planCfgRateFix({ hourRate: 47.5 });
    expect(changed).toBe(false);
    expect(unexpected).toBe(false);
  });

  it('refuses to touch a rate nobody ruled on, and flags it', () => {
    // Only the exact ruled-against value is corrected. Anything else means
    // something set it deliberately, so it is reported rather than overwritten.
    const { cfg, changed, unexpected } = planCfgRateFix({ hourRate: 52 });
    expect(changed).toBe(false);
    expect(unexpected).toBe(true);
    expect(cfg.hourRate).toBe(52);
  });

  it('is a no-op on a config that carries no rate at all', () => {
    expect(planCfgRateFix({}).changed).toBe(false);
    expect(planCfgRateFix(null).changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The MECHANISM. Janus HIGH-4 mutation-verified that none of the above catches
// a broken runPendingMigrations: reversing STEP 1 and STEP 2 — the headline fix
// of the commit that introduced it — left 317/317 green, and so did deleting
// every durable write. The pure planner was tested; the thing that runs was not.
// ---------------------------------------------------------------------------

import { runPendingMigrations, getMigrationRecords } from '../../src/shared/storage/migrations.js';
import { K } from '../../src/shared/storage/keys.js';

function seedInstall({ rate = 41.25, quotaOn = null } = {}) {
  localStorage.clear();
  // A day the OLD app wrote: A1 3 of 4 under the old ladder, at the old rate.
  const day = storedDay({ a1: n(3), a2: n(4), barrel: n(2) });
  localStorage.setItem(K.prodLog, JSON.stringify({ '2026-08-03': day }));
  localStorage.setItem(K.prodCfg, JSON.stringify({ ...DEF_CFG, hourRate: rate }));
  localStorage.setItem(K.prodAreas, JSON.stringify(DEF_AREAS));
  if (quotaOn) failWritesTo(quotaOn);
  return day.totals.extraCost;
}

// Plain stub — this suite runs in ESM mode, where the `jest` global is absent.
let realSetItem = null;
function failWritesTo(key) {
  realSetItem = realSetItem || Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === key) throw new Error('QuotaExceededError');
    return realSetItem.call(this, k, v);
  };
}
function restoreWrites() {
  if (realSetItem) { Storage.prototype.setItem = realSetItem; realSetItem = null; }
}

describe('runPendingMigrations — the mechanism', () => {
  afterEach(() => { restoreWrites(); localStorage.clear(); });

  it('ORDER: un-shadows the stored rate BEFORE recomputing', () => {
    // The mutation Janus proved undetectable. If STEP 2 ran first it would read
    // the stored 41.25 as the "new" rate, find nothing changed, and record that
    // there was nothing to correct.
    const before = seedInstall({ rate: 41.25 });
    const report = runPendingMigrations({ at: AT });

    expect(report.storedRateUnshadowed).toBe(true);
    expect(JSON.parse(localStorage.getItem(K.prodCfg)).hourRate).toBe(47.5);
    expect(report.corrected).toBe(1);
    const after = JSON.parse(localStorage.getItem(K.prodLog))['2026-08-03'].totals.extraCost;
    expect(after).toBeGreaterThan(before);
  });

  it('QUOTA: a failed data write is NOT recorded as applied, and retries', () => {
    seedInstall({ rate: 41.25, quotaOn: K.prodLog });
    expect(runPendingMigrations({ at: AT })).toBeNull();
    expect(getMigrationRecords()[MIGRATION_ID]).toBeUndefined();

    restoreWrites();                              // quota clears
    const retry = runPendingMigrations({ at: AT });
    expect(retry.corrected).toBe(1);              // the retry lands
  });

  it('RESTORE: a merged backup reverts the data, and the next boot re-corrects', () => {
    // importData() merges without clearing, so a pre-today backup restores the
    // old log and rate while the applied-record survives. Idempotence is the
    // gate's job, not a flag's — so this must still correct.
    const before = seedInstall({ rate: 41.25 });
    expect(runPendingMigrations({ at: AT }).corrected).toBe(1);

    seedInstall({ rate: 41.25 });                 // the restore, record retained
    localStorage.setItem(K.migrations, JSON.stringify({ [MIGRATION_ID]: { corrected: 1 } }));

    const after = runPendingMigrations({ at: AT });
    expect(after.corrected).toBe(1);
    expect(JSON.parse(localStorage.getItem(K.prodLog))['2026-08-03'].totals.extraCost)
      .toBeGreaterThan(before);
  });

  it('DOUBLE BOOT: the second run corrects nothing and rewrites nothing', () => {
    seedInstall({ rate: 41.25 });
    const first = runPendingMigrations({ at: AT });
    const afterFirst = localStorage.getItem(K.prodLog);

    const second = runPendingMigrations({ at: AT });
    expect(second.corrected).toBe(0);
    expect(localStorage.getItem(K.prodLog)).toBe(afterFirst);
    expect(first.corrected).toBe(1);
  });

  it('DISCLOSES the wage-side repricing it does not audit', () => {
    seedInstall({ rate: 41.25 });
    const report = runPendingMigrations({ at: AT });
    expect(report.wageSideDisclosure).not.toBeNull();
    expect(report.wageSideDisclosure.consumers).toHaveLength(4);
  });
});

describe('the report reconciles with itself', () => {
  it('the two legs telescope to deltaCost', () => {
    // Measured against `stored` they were one-factor-at-a-time marginals and
    // double-counted the interaction — Rs 200 unexplained on four days.
    // BM signs a payroll restatement against this report.
    const logs = {
      '2026-08-03': storedDay({ a1: n(3), a2: n(4), barrel: n(2) }),
      '2026-08-06': storedDay({ a1: n(4), a2: n(4), barrel: n(3), pv: n(3), pb: n(2) }),
      '2026-08-04': storedDay({ a1: n(2), barrel: n(1) }),
    };
    const { report } = plan(logs);
    expect(report.raisedByRate + report.loweredByEstablishment).toBe(report.deltaCost);
  });
});
