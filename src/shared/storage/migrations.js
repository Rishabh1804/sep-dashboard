// Versioned, idempotent, auditable data migrations.
//
// The first one exists because `wage.js` carried `hourRate: 41.25` — a rate
// soma-internal T-CJ had already RULED AGAINST and closed on ("Rs 380/day
// confirmed = Rs 47.50/hr; NOT Rs 41.25", superseded 4 May 2026). Every
// `extraCost` this app computed was therefore 13% low, and extraCost reaches
// finance.js, the month rollup and the CSV export — booked labour cost, not a
// display value. BM authorised the historical recompute on 11 Aug 2026.
//
// TWO config values were wrong, not one, so this is NOT a flat 15.15% uplift:
//   hourRate           41.25 -> 47.50   (raises every non-zero extraCost)
//   vat_a1 caps[100].r     5 -> 4       (LOWERS the deficit on full-capacity
//                                        A1 days — a phantom body-block)
// A day carrying both moves in both directions. The report decomposes it.
//
// WHAT THIS DOES NOT TOUCH — operator-entered data. `assigned`, `cap`,
// `present` and `period.hours` are left exactly as saved. In particular
// `eveningOT.hours` is NOT corrected 3 -> 7 even though the block runs seven
// hours (BM, 11 Aug): a stored 3 may be an operator recording a genuinely
// short evening, and overwriting that would be inventing data. Days carrying
// it are COUNTED and reported so the decision stays with BM.
//
// THE SAFETY PROPERTY. Before replacing a stored figure this recomputes it
// under the OLD config and requires the result to match what is stored. A day
// that does not reproduce was hand-edited, or written under a config this
// migration does not model — it is FLAGGED AND SKIPPED, never overwritten.
// That is the difference between a migration and a bulk overwrite.

import { loadJSON, saveJSON } from './storage.js';
import { K } from './keys.js';
import { getAreas, getCfg, getProdLogs } from './production.js';
import { recalcExtra } from '../utils/calc-prod.js';

export const MIGRATION_ID = '2026-08-11-extra-rate';

// The configuration these records were written under.
const OLD_HOUR_RATE = 41.25;
const OLD_VAT_A1_TOP_REQ = 5;

function oldConfigFrom(areas, cfg) {
  return {
    areas: areas.map((a) => (a.id !== 'vat_a1' ? a : {
      ...a,
      caps: a.caps.map((c) => (c.l === 100 ? { ...c, r: OLD_VAT_A1_TOP_REQ } : c)),
    })),
    cfg: { ...cfg, hourRate: OLD_HOUR_RATE },
  };
}

// Deep-enough clone: recalcExtra only writes prod.totals, but it reads
// periods[].areas[].assigned, so the input must not be shared with the caller.
const cloneDay = (day) => JSON.parse(JSON.stringify(day));

function totalsUnder(day, areas, cfg) {
  const copy = cloneDay(day);
  recalcExtra(copy, areas, cfg);
  return {
    extraHours: copy.totals.extraHours,
    extraCost: copy.totals.extraCost,
  };
}

const money = (n) => Math.round(n * 100) / 100;

/**
 * Pure core. Takes the stored production log and both configs; returns the
 * corrected log plus a report. Touches no storage, so it unit-tests directly.
 *
 * A day is corrected only if BOTH hold:
 *   - it reproduces exactly under the old config (so we know what wrote it)
 *   - recomputing under the new config actually changes something
 */
export function planExtraRateRecompute(logs, areas, cfg, { at } = {}) {
  const old = oldConfigFrom(areas, cfg);
  const out = {};
  const report = {
    migration: MIGRATION_ID,
    at: at || null,
    scanned: 0,
    corrected: 0,
    unchanged: 0,
    skippedUnreproducible: 0,
    skippedNoTotals: 0,
    deltaCost: 0,
    deltaHours: 0,
    raisedByRate: 0,
    loweredByEstablishment: 0,
    eveningHours3Days: 0,
    flagged: [],
    changes: [],
  };

  Object.keys(logs).sort().forEach((date) => {
    const day = logs[date];
    out[date] = day;
    report.scanned += 1;

    if (!day || !day.totals || !day.periods) { report.skippedNoTotals += 1; return; }

    if (day.periods.eveningOT?.active && day.periods.eveningOT.hours === 3) {
      report.eveningHours3Days += 1;
    }

    const stored = {
      extraHours: day.totals.extraHours || 0,
      extraCost: day.totals.extraCost || 0,
    };
    const underOld = totalsUnder(day, old.areas, old.cfg);

    // Reproducibility gate. Hours must match exactly; cost is compared in
    // paise because sepRound floors and the stored value may predate it.
    const reproduces = underOld.extraHours === stored.extraHours
      && Math.abs(underOld.extraCost - stored.extraCost) < 0.01;

    if (!reproduces) {
      report.skippedUnreproducible += 1;
      report.flagged.push({
        date,
        stored,
        expectedUnderOldConfig: underOld,
        why: 'does not reproduce under the old config — hand-edited, or written '
           + 'under a configuration this migration does not model. Left untouched.',
      });
      return;
    }

    const next = totalsUnder(day, areas, cfg);
    if (next.extraHours === stored.extraHours
        && Math.abs(next.extraCost - stored.extraCost) < 0.01) {
      report.unchanged += 1;
      return;
    }

    // Decompose: rate alone, then establishment alone.
    const rateOnly = totalsUnder(day, old.areas, cfg);
    const estOnly = totalsUnder(day, areas, old.cfg);
    report.raisedByRate += money(rateOnly.extraCost - stored.extraCost);
    report.loweredByEstablishment += money(estOnly.extraCost - stored.extraCost);

    const corrected = cloneDay(day);
    corrected.totals.extraHours = next.extraHours;
    corrected.totals.extraCost = next.extraCost;
    // Append-only forensic record, same pattern as the dashboard's revisions[].
    corrected.corrections = [...(day.corrections || []), {
      migration: MIGRATION_ID,
      at: at || null,
      field: 'totals.extraHours + totals.extraCost',
      before: stored,
      after: next,
      reason: 'hourRate 41.25 -> 47.50 (T-CJ ruled 47.50 and closed; 41.25 was '
            + 'superseded 4 May 2026) and vat_a1 top-rung requirement 5 -> 4 '
            + '(exceeded the ratified establishment). Authorised by BM 11 Aug 2026.',
    }];

    out[date] = corrected;
    report.corrected += 1;
    report.deltaHours += next.extraHours - stored.extraHours;
    report.deltaCost += next.extraCost - stored.extraCost;
    report.changes.push({ date, before: stored, after: next });
  });

  report.deltaCost = money(report.deltaCost);
  report.raisedByRate = money(report.raisedByRate);
  report.loweredByEstablishment = money(report.loweredByEstablishment);
  return { logs: out, report };
}

export function getMigrationRecords() { return loadJSON(K.migrations, {}); }
export function hasRun(id) { return Boolean(getMigrationRecords()[id]); }

/**
 * Storage-touching wrapper. Idempotent via K.migrations; safe to call on
 * every boot.
 *
 * Deliberately IGNORES the month lock. The lock guards operator edits against
 * a finalised month; this corrects a figure the codex had already ruled wrong,
 * and the affected days are almost all inside locked months — a migration that
 * respected the lock would correct nothing. The `corrections[]` entry on each
 * day and the stored report are what make that auditable rather than silent.
 */
export function runPendingMigrations({ at } = {}) {
  if (hasRun(MIGRATION_ID)) return null;

  const { logs, report } = planExtraRateRecompute(
    getProdLogs(), getAreas(), getCfg(), { at: at || new Date().toISOString() },
  );

  if (report.corrected > 0) saveJSON(K.prodLog, logs);
  saveJSON(K.migrations, { ...getMigrationRecords(), [MIGRATION_ID]: report });
  return report;
}
