// Rule-bounds — the ONE place the client encodes the Firestore rules'
// content bounds and enums (FIRESTORE_RULES.ref.txt), plus the shared
// production-quantity derivation.
//
// Dependency-free on purpose (same discipline as job-status.js): consumed by
// the eager handler bundle (sanity.js, forms-registry.js), the lazy transport
// chunk (transport.js, handler-writes.js), the dashboard (edit-model.js), and
// the server-side schemas (schemas.js) — none of which may drag a schema
// library in with it.
//
// Inclusivity is part of the contract — spell it per constant:
//   QTY_MAX / PCS_MAX are EXCLUSIVE (rules: qty < 100000) — the cap itself
//     is illegal. DFT_MICRON_MAX is INCLUSIVE (rules: micron <= 50) — the cap
//     itself is legal. The Session-18 round-2 review caught a real bug from
//     conflating these; don't "unify" the comparisons.

export const QTY_MAX = 100000;      // exclusive — isValidProductionEntry / isValidJob kg
export const PCS_MAX = 1000000;     // exclusive — isValidJob received_pcs
export const DFT_MICRON_MAX = 50;   // INCLUSIVE — isValidDftMeasurement (0 < µm <= 50)

// Stations isValidProductionEntry accepts. The form offers a subset
// (passivation folded into plating per the Stage D ruling); the mapper
// whitelist and the write schema both derive from this list.
export const RULE_STATIONS = ['pickling', 'plating', 'inspection', 'dispatch'];

export const JOB_ROUTES = ['standard', 'rework-active', 'rework-completed'];
export const DEPLETION_REASONS = ['production_use', 'waste', 'spillage', 'theft', 'other'];
export const COST_UNITS = ['per_kg', 'per_bag', 'per_liter'];
export const DFT_OUTCOMES = ['pass', 'fail-rework'];
export const NOTE_STATUSES = ['active', 'resolved', 'archived'];
export const NOTE_PRIORITIES = ['normal', 'urgent'];

// Enums the rules are SILENT on — the write schemas are their only guard.
export const MACHINE_STATES = ['running', 'idle', 'down'];
export const CHECK_DIRECTIONS = ['in', 'out'];
export const CHECK_SLOTS = ['morning_ot', 'regular', 'evening_ot'];

// Production quantity derivation — THE single encoding of "explicit total
// wins; otherwise rounds × round_size; otherwise undefined". Consumed by the
// transport mapper (what lands in Firestore) and the sanity net (what the
// confirm modal judges) — one function so the two can never drift.
// Trim-aware: a whitespace-only quantity is "not entered" (Number(' ') === 0
// would otherwise masquerade as an explicit zero total).
export function deriveTotalQty(f = {}) {
  if (f.quantity != null && String(f.quantity).trim() !== '') return Number(f.quantity);
  const rounds = Number(f.rounds);
  const roundSize = Number(f.round_size);
  if (rounds > 0 && roundSize > 0) return rounds * roundSize;
  return undefined;
}
