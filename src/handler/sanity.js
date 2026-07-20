// Sanity / σ-outlier prompts — the "this number looks wrong, sure?" net.
//
// HANDLER_FORMS.md asks numeric fields for a "sanity hard-block 2σ": stop a
// fat-finger (a 45000 where 450 was meant) before it queues. Two nets, both
// pure and unit-tested here; form.js surfaces the verdict as a confirm step:
//
//   1. Declared plausibility bounds — a hard [min,max] the value is physically
//      impossible outside (block), and a soft [min,max] typical band the value
//      merely looks wrong outside (confirm). Works on the very first entry,
//      before any history exists.
//   2. Rolling σ baseline — once enough entries of the same form+field have
//      accumulated, a value more than `z` std-devs from the running mean also
//      prompts. Welford's online algorithm keeps {n, mean, m2} so the baseline
//      sharpens without storing every past value ("graduate when ready"). The
//      threshold is per-field (SANITY .z); it defaults to 3σ rather than the
//      spec's literal 2σ to hold prompt-fatigue down on noisy floor data —
//      tighten a field to z:2 once its distribution proves stable.
//
// The verdict is advisory (confirm), never a silent drop: the handler taps
// "yes, correct" to proceed. Only physical impossibility hard-blocks — and
// that mostly overlaps the Zod gate, so block is the belt to its braces.

// rule-bounds + config are dependency-free — this module stays effectively pure.
import { QTY_MAX, PCS_MAX, deriveTotalQty } from '../shared/types/rule-bounds.js';
import { DEF_AREAS } from '../shared/config/areas.js';

// --- Welford online mean/variance ---
export function emptyStats() { return { n: 0, mean: 0, m2: 0 }; }

// Fold one sample in; returns a NEW stats object (callers persist it).
export function pushStat(stats, x) {
  const s = stats && stats.n ? { ...stats } : emptyStats();
  const v = Number(x);
  if (!Number.isFinite(v)) return s;
  s.n += 1;
  const delta = v - s.mean;
  s.mean += delta / s.n;
  s.m2 += delta * (v - s.mean);
  return s;
}

export function stdev(stats) {
  if (!stats || stats.n < 2) return 0;
  return Math.sqrt(stats.m2 / (stats.n - 1)); // sample std-dev
}

// Signed distance from the mean in std-devs. 0 when no spread is known yet.
export function zScore(stats, x) {
  const sd = stdev(stats);
  if (!(sd > 0)) return 0;
  return (Number(x) - stats.mean) / sd;
}

// Minimum history before the rolling σ net (default 3σ) activates — below this
// the floor distribution is too thin to trust; declared bounds carry the load.
export const MIN_HISTORY = 8;

// Per-form numeric-field plausibility. hard = impossible (block); soft =
// typical band (confirm outside it); z = std-dev threshold once history matures.
// Bounds are deliberately generous — the goal is catching a fat-finger order-
// of-magnitude slip, not second-guessing a busy floor.
export const SANITY = {
  production: {
    quantity:   { hardMin: 0, hardMax: QTY_MAX, softMax: 40000, z: 3 },
    rounds:     { hardMin: 0, hardMax: 2000,   softMax: 500,   z: 3 },
    round_size: { hardMin: 0, hardMax: 5000,   softMax: 2000,  z: 3 },
  },
  job_receipt: {
    weight:       { hardMin: 0, hardMax: QTY_MAX, softMax: 20000, z: 3 },
    received_pcs: { hardMin: 0, hardMax: PCS_MAX, softMax: 200000, z: 3 },
  },
  dft: {
    // No hardMax: exactly 50 µm is LEGAL in every other layer (rules <= 50,
    // Zod .max(50), the form's dftRange rejects only > 50 before sanity even
    // runs) — a hardMax:50 here (block on v >= 50) made the one legal boundary
    // reading unenterable. softMax keeps the confirm prompt for high readings.
    dft_micron: { hardMin: 0, softMin: 2, softMax: 30, z: 3 },
  },
  dispatch: {
    weight: { hardMin: 0, hardMax: QTY_MAX, softMax: 20000, z: 3 },
  },
  stock_refill: {
    quantity: { hardMin: 0, hardMax: QTY_MAX, softMax: 5000, z: 3 },
    // No hardMin: 0 is a legitimate cost (an unpriced/free receipt); the
    // mapper only records unit_cost when cost > 0 anyway. A hardMin:0 here
    // would block-then-refuse a 0, which is not an impossible value.
    cost:     { hardMax: 10000000, softMax: 1000000, z: 3 },
  },
  stock_deplete: {
    quantity:    { hardMin: 0, hardMax: QTY_MAX, softMax: 5000, z: 3 },
    // No hardMin: level_after: 0 is Shyam's NIL stock-take — the reorder-alert
    // signal, a VALID reading. Blocking v <= hardMin(0) would make NIL
    // unenterable. Negatives are already caught by Zod (nonnegative) + the
    // form's nonNegNumber validate.
    level_after: { hardMax: QTY_MAX, softMax: 20000, z: 3 },
  },
};

// Verdict for one value against its config + optional rolling baseline.
// Returns { level: 'ok'|'confirm'|'block', reason? }. Non-numeric / absent
// values are 'ok' — presence + type are the Zod gate's job, not sanity's.
export function fieldVerdict(value, cfg, stats) {
  if (!cfg) return { level: 'ok' };
  const v = Number(value);
  // Trim-aware absent check: a whitespace-only string is "empty", not the
  // number 0 (Number(' ') === 0 would otherwise hit hardMin blocks on a
  // field that LOOKS blank — an invisible-character trap on touch keyboards).
  if (value == null || String(value).trim() === '' || !Number.isFinite(v)) return { level: 'ok' };

  if (cfg.hardMax != null && v >= cfg.hardMax) return { level: 'block', reason: `≥ ${cfg.hardMax}` };
  if (cfg.hardMin != null && v <= cfg.hardMin) return { level: 'block', reason: `≤ ${cfg.hardMin}` };

  if (cfg.softMax != null && v > cfg.softMax) return { level: 'confirm', reason: `> ${cfg.softMax}` };
  if (cfg.softMin != null && v < cfg.softMin) return { level: 'confirm', reason: `< ${cfg.softMin}` };

  if (stats && stats.n >= MIN_HISTORY) {
    const z = zScore(stats, v);
    if (Math.abs(z) >= (cfg.z ?? 3)) {
      return { level: 'confirm', reason: `${z > 0 ? '+' : ''}${z.toFixed(1)}σ` };
    }
  }
  return { level: 'ok' };
}

// --- Baseline scoping (unit keys) -------------------------------------------
// A rolling baseline is only meaningful over ONE distribution. Production
// `quantity` is pcs on VAT machines and kg on barrels (Session 11 units lock)
// — pooling them inflates σ until the net either nags on every entry or never
// fires. Stock quantities differ per item by orders of magnitude (HCl in
// hundreds of kg vs brightener in litres). So baselines are KEYED by the
// distribution context: production per machine-group, stock forms per item.
// Declared bounds stay unscoped — they encode physical impossibility, which
// doesn't depend on which machine ran.
const SCOPES = {
  production: (s) => (DEF_AREAS.find((a) => a.id === s.machine) || {}).group,
  stock_refill: (s) => s.item,
  stock_deplete: (s) => s.item,
};

// The persisted-stats key for one field of one submission. Unscoped when the
// form has no scope or the scoping field is unset (falls back to the plain
// field key — old unscoped stats simply orphan and fresh scoped ones accrue).
export function statKey(type, field, state = {}) {
  const scope = SCOPES[type]?.(state);
  return scope ? `${field}@${scope}` : field;
}

/**
 * Check every configured numeric field of a form's state.
 * `baselines` maps statKey(type, field, state) -> stats (from IndexedDB);
 * absent = no history for that field in that unit context.
 * Returns the flags that need attention, worst-first: [{ key, value, level, reason }].
 * An empty array means nothing looked wrong.
 */
export function checkRecord(type, state = {}, baselines = {}) {
  const cfgs = SANITY[type];
  if (!cfgs) return [];
  const flags = [];
  for (const [key, cfg] of Object.entries(cfgs)) {
    const raw = state[key];
    if (raw == null || String(raw).trim() === '') continue; // trim-aware, matches fieldVerdict
    const verdict = fieldVerdict(raw, cfg, baselines[statKey(type, key, state)]);
    if (verdict.level !== 'ok') flags.push({ key, value: Number(raw), ...verdict });
  }
  const rank = { block: 0, confirm: 1 };
  return flags.sort((a, b) => rank[a.level] - rank[b.level]);
}

// The numeric fields a form contributes to the rolling baseline — the keys
// SANITY declares for that type. Used by form.js to fold a successful
// submission's values into the persisted stats.
export function statFields(type) {
  return Object.keys(SANITY[type] || {});
}

// Production may enter quantity as rounds × round_size with no explicit total;
// surface the DERIVED total under `quantity` so the net judges what actually
// lands in Firestore (mirrors transport's derivation). A fat-finger round_size
// that multiplies out of band then prompts even though each factor looks fine.
// Other form types (and production-with-explicit-total) pass through untouched.
export function deriveSanityState(type, state = {}) {
  if (type !== 'production') return state;
  // deriveTotalQty (rule-bounds.js) is the SAME derivation transport's mapper
  // writes to Firestore — shared so the judged number and the landed number
  // can never drift. Trim-aware there (whitespace quantity = "not entered").
  const total = deriveTotalQty(state);
  if (total === undefined || Number(state.quantity) === total) return state;
  return { ...state, quantity: total };
}
