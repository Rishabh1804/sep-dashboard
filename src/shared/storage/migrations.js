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
import { DEF_CFG } from '../config/wage.js';
import { recalcExtra, BLOCK_HOURS } from '../utils/calc-prod.js';
import { sepRound } from '../utils/currency.js';

export const MIGRATION_ID = '2026-08-11-extra-rate';

// The configuration these records were written under.
const OLD_HOUR_RATE = 41.25;
const OLD_VAT_A1_TOP_REQ = 5;
// recalcExtra's own hours fallback changed in this PR (evening 3 -> 7), so the
// gate must model the old CODE as well as the old config — otherwise a day with
// an active evening period and no `hours` field is judged by a rule it was never
// written under, fails to reproduce, and gets flagged as hand-edited when it is
// nothing of the sort (Janus MEDIUM-6).
const OLD_BLOCK_HOURS = { ...BLOCK_HOURS, eveningOT: 3 };


// THE SAME TRAP AS getAreas(), ONE FILE OVER — and worth spelling out, because
// fixing the first instance did not stop me walking into the second.
//
// initData() seeds `K.prodCfg` with the WHOLE DEF_CFG object when the key is
// absent. On any install created before today that seed froze `hourRate: 41.25`
// into storage back in May — and getCfg() spreads SAVED OVER DEFAULTS, so the
// corrected 47.50 in wage.js is shadowed and never reaches the app.
//
// Left unhandled this would be worse than a no-op: the recompute below would
// read 41.25 as the "new" rate, find nothing changed, mark itself applied and
// permanently record that there was nothing to correct.
//
// Safe to overwrite because `hourRate` is NOT operator-editable — the settings
// panel renders it read-only, so a stored value can only be the seed. Only the
// exact ruled-against 41.25 is touched; any other value is left alone and
// reported, since that would mean something set it deliberately.
export function planCfgRateFix(savedCfg) {
  if (!savedCfg || savedCfg.hourRate === undefined) return { cfg: savedCfg, changed: false };
  if (savedCfg.hourRate === OLD_HOUR_RATE) {
    return { cfg: { ...savedCfg, hourRate: DEF_CFG.hourRate }, changed: true };
  }
  return { cfg: savedCfg, changed: false, unexpected: savedCfg.hourRate !== DEF_CFG.hourRate };
}

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

function totalsUnder(day, areas, cfg, blockHours) {
  const copy = cloneDay(day);
  if (blockHours) {
    // Materialise the old fallback so recalcExtra reads it from period.hours.
    Object.entries(copy.periods || {}).forEach(([pk, per]) => {
      if (per && !per.hours) per.hours = blockHours[pk];
    });
  }
  recalcExtra(copy, areas, cfg);
  return {
    extraHours: copy.totals.extraHours,
    extraCost: copy.totals.extraCost,
  };
}

// The app's own rounding. sepRound is Math.floor to WHOLE RUPEES (currency.js),
// so a 2-dp report figure describes precision the stored data cannot carry
// (Janus LOW). Aggregate the same way the values were booked.
const money = (n) => (n < 0 ? -sepRound(-n) : sepRound(n));

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
    deferredEveningHours: [],
    flagged: [],
    changes: [],
  };

  Object.keys(logs).sort().forEach((date) => {
    const day = logs[date];
    out[date] = day;
    report.scanned += 1;

    if (!day || !day.totals || !day.periods) { report.skippedNoTotals += 1; return; }

    // A day whose evening block is still booked at 3 hours cannot be "corrected".
    // period.hours is NOT merely an operator record: confirmProduction() writes
    // otHours = morningOT.hours + eveningOT.hours into cwAtt/peAtt, and payroll
    // prices dayH = 8 + otHours. A stored 3 costs each evening worker 4 hr x
    // Rs 47.50 = Rs 190/day in the app's own wage line. Stamping corrections[]
    // on such a day records a forensic assurance that is false — worse than
    // leaving it alone (Castor BLOCKER-2).
    //
    // Not blanket-corrected either: the distinguishing evidence is the slip's
    // clock span (8+3+7 = 18 matches; 8+3+3 = 14 matches nothing on any slip),
    // which this migration cannot see. So the day is DEFERRED, with the reason.
    if (day.periods.eveningOT?.active && day.periods.eveningOT.hours === 3) {
      report.eveningHours3Days += 1;
      report.deferredEveningHours.push({
        date,
        stored: { extraHours: day.totals.extraHours || 0, extraCost: day.totals.extraCost || 0 },
        why: 'evening block booked at 3 h where the ruling says 7 — correcting the '
           + 'rate here would produce a figure that is still wrong, and stamping '
           + 'corrections[] on it would assert otherwise. Needs the slip span.',
      });
      return;
    }

    const stored = {
      extraHours: day.totals.extraHours || 0,
      extraCost: day.totals.extraCost || 0,
    };
    const underOld = totalsUnder(day, old.areas, old.cfg, OLD_BLOCK_HOURS);

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

    // SEQUENTIAL decomposition, not marginal. Measuring both legs against
    // `stored` holds the other factor at its old value, so the interaction term
    // is double-counted and the legs do not sum to deltaCost — on four synthetic
    // days that left Rs 200 unexplained (Castor MEDIUM-3 / Janus HIGH-3). This
    // report is what BM signs a payroll restatement against, so it has to
    // reconcile with itself: (rateOnly - stored) + (next - rateOnly) === delta.
    const rateOnly = totalsUnder(day, old.areas, cfg);
    report.raisedByRate += money(rateOnly.extraCost - stored.extraCost);
    report.loweredByEstablishment += money(next.extraCost - rateOnly.extraCost);

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
 * Storage-touching wrapper. Safe to call on every boot.
 *
 * IDEMPOTENCE IS THE GATE'S JOB, NOT A FLAG'S. An earlier cut short-circuited
 * on `hasRun(MIGRATION_ID)`. That guard lives in `K.migrations` while the data
 * it protects lives in `sep_prod_log_v1` — two keys that can be replaced
 * independently, and `importData()` MERGES a backup without clearing. Every
 * backup in existence predates today, so restoring one reverted the data and
 * the rate while the applied-record survived, and the guard then prevented
 * re-correction permanently (Janus BLOCKER-2, reproduced). The reproducibility
 * gate already refuses an already-corrected day, so re-running is free.
 *
 * WRITE ORDER. The data write is confirmed before the audit record is written.
 * `saveJSON` used to swallow its exception and return void, so a quota failure
 * on the prod-log write followed by a successful record write marked the
 * migration applied against an uncorrected log — permanently, and with a report
 * asserting corrections that never happened (Janus BLOCKER-1, reproduced).
 *
 * MONTH LOCK. Deliberately bypassed for `totals.extraHours` / `totals.extraCost`,
 * which carry a per-record `corrections[]` trail. ⚠ The `K.prodCfg` rate write
 * below ALSO crosses the lock and restates derived wage figures in locked months
 * with no such trail — see `wageSideDisclosure` (Castor BLOCKER-1).
 */
export function runPendingMigrations({ at } = {}) {
  const stamp = at || new Date().toISOString();

  // STEP 1 — un-shadow the rate. Must precede the recompute, or getCfg() hands
  // it the very value it exists to correct.
  const rateFix = planCfgRateFix(loadJSON(K.prodCfg, {}));
  if (rateFix.changed && !saveJSON(K.prodCfg, rateFix.cfg)) {
    console.error(`[migration ${MIGRATION_ID}] rate un-shadow failed to persist; aborting, will retry next boot`);
    return null;
  }

  // STEP 2 — recompute derived totals against the now-correct config.
  const { logs, report } = planExtraRateRecompute(
    getProdLogs(), getAreas(), getCfg(), { at: stamp },
  );
  report.storedRateUnshadowed = rateFix.changed;
  report.unexpectedStoredRate = rateFix.unexpected ? loadJSON(K.prodCfg, {}).hourRate : null;

  // ⚠ THE HALF THIS MIGRATION DOES NOT CORRECT, disclosed rather than implied.
  // `hourRate` has five consumers; only the first is gated, trailed and reported.
  // The other four derive on READ from stored attendance, so the un-shadow above
  // reprices every historical CW wage line by +15.15% the instant it runs — with
  // no reproducibility gate, no corrections[] entry and no per-record trail. On
  // the W32 slip alone that is ~Rs 3,625 against this migration's ~Rs 1,444:
  // the unaudited half is 2.5x the audited one (Castor BLOCKER-1).
  report.wageSideDisclosure = rateFix.changed ? {
    note: 'The rate un-shadow also restates every historical figure derived from '
        + 'cfg.hourRate on read. These are NOT gated, trailed or counted below.',
    consumers: [
      'payroll.js calcDayWages / calcMonthWages  (finance month rollup)',
      'payroll.js calcCWWeeklyPay                (each CW weekly wage line)',
      'finance.js OT cost',
      'finance-export.js OT cost                 (CSV export)',
    ],
    magnitude: '+15.15% on every affected wage figure',
    alsoNote: 'finance.markCWPaid persists the amount PAID at the old rate while '
            + 'the card recomputes gross at the new one, so an already-paid week '
            + 'now shows a permanent paid-vs-computed divergence.',
  } : null;

  if (report.corrected > 0 && !saveJSON(K.prodLog, logs)) {
    console.error(`[migration ${MIGRATION_ID}] prod-log write failed; NOT recording as applied`);
    return null;                      // retried next boot; nothing marked done
  }
  saveJSON(K.migrations, { ...getMigrationRecords(), [MIGRATION_ID]: report });
  return report;
}
