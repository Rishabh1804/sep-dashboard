// Queued handler record → Firestore write (Track 2).
//
// recordToWrite() is PURE — no Firebase imports; the serverTimestamp
// sentinel and auth uid are injected via ctx so it unit-tests in jsdom
// and gets parity-tested against the live rules in tests/rules (same
// discipline as the importer). createTransport() is the thin impure
// wrapper injected into sync.js's setTransport() seam.
//
// Every write carries the envelope the rules demand (FIRESTORE_RULES.ref.txt):
//   author_user_id == auth.uid          (authoredBySelf; notes use created_by.uid)
//   created_at == request.time          (serverTimestamp sentinel)
//   app_version = String(BUILD)         (numeric-string; buildSupported int())
// Doc IDs are the form's idempotencyKey, so a crash-between-send-and-dequeue
// replays onto the same doc and is detected (getDoc → already exists → done).
//
// STAGE D SKEW RULINGS (both resolved 12 Jun 2026):
//   - production.station 'passivation' — RESOLVED form-side earlier: folded
//     into 'plating' per the locked v2 schema; the form no longer offers it.
//     The station guard below stays as a belt-and-braces check.
//   - stock_refill cost/supplier — RESOLVED rules-side: optional, validated
//     when present. Codex evidence (zinc PO #70, 9 Jun): material arrives on
//     an unpriced challan, the priced invoice follows days later — receipt-
//     time cost is routinely unknown. Until the relaxed rules deploy (IAM-
//     gated), costless refills queue as transient denials and drain on
//     deploy — by design, not data loss.

import { DEF_AREAS } from '../shared/config/areas.js';
import { DEF_STOCK } from '../shared/config/stock.js';
import { BUILD } from '../shared/config/app.js';
import { validateWrite } from '../shared/types/handler-writes.js';

export class PermanentRejection extends Error {
  constructor(message) {
    super(message);
    this.name = 'PermanentRejection';
    this.permanent = true;
  }
}

const RULE_STATIONS = ['pickling', 'plating', 'inspection', 'dispatch'];

function areaById(id) { return DEF_AREAS.find((a) => a.id === id) || null; }

// VAT registers count NOS, barrel relays kg — unit follows the machine's
// group (Session 11 units lock).
function qtyFieldFor(machineId) {
  const area = areaById(machineId);
  return area?.group === 'barrel' ? 'qty_kg' : 'qty_pcs';
}

// Pickling areas log pickling; everything else defaults to plating.
function defaultStation(machineId) {
  return areaById(machineId)?.dep ? 'pickling' : 'plating';
}

function stockUnitFor(itemId) {
  return DEF_STOCK.find((s) => s.id === itemId)?.unit || 'kg';
}

function num(v) { return typeof v === 'number' ? v : Number(v); }

function envelope(record, ctx) {
  return {
    author_user_id: ctx.uid,
    created_at: ctx.serverTimestamp(),
    app_version: String(ctx.build ?? BUILD),
    client_ts: record.ts,
    idempotency_key: record.idempotencyKey,
  };
}

const MAPPERS = {
  production(f, record, ctx) {
    const station = f.station || defaultStation(f.machine);
    if (!RULE_STATIONS.includes(station)) {
      throw new PermanentRejection(`station '${station}' not accepted by rules`);
    }
    // Register grain: total quantity, or rounds × per-round size ("108-round",
    // "25×6"). When both are given the explicit total wins; rounds are kept
    // on the doc either way — they're the productivity denominator.
    const rounds = f.rounds != null ? num(f.rounds) : null;
    const roundSize = f.round_size != null ? num(f.round_size) : null;
    const qty = f.quantity != null ? num(f.quantity)
      : (rounds > 0 && roundSize > 0 ? rounds * roundSize : NaN);
    if (!(qty > 0)) {
      throw new PermanentRejection('quantity missing: need a total or rounds × round size');
    }
    const data = {
      ...envelope(record, ctx),
      job_id: f.job,
      machine_id: f.machine,
      worker_id: f.worker,
      station,
      [qtyFieldFor(f.machine)]: qty,
    };
    if (rounds > 0) data.rounds = rounds;
    if (roundSize > 0) data.round_size = roundSize;
    if (f.part) data.item_id = f.part;
    if (f.part__label) data.part_number = f.part__label;
    if (f.notes) data.notes = f.notes;
    return { path: ['production_entries', record.idempotencyKey], data };
  },

  job_receipt(f, record, ctx) {
    // NOS-only challans carry received_kg 0 with the count in received_pcs
    // (isValidJob accepts either being positive).
    const data = {
      ...envelope(record, ctx),
      __schema_version: 2,
      customer_id: f.customer,
      received_kg: f.weight != null ? num(f.weight) : 0,
      route: 'standard',
      current_status: 'in-flight',
    };
    if (f.received_pcs != null) data.received_pcs = num(f.received_pcs);
    // Customer paperwork number — a label, not a key (107-collision ruling).
    if (f.challan_no) data.challan_no = String(f.challan_no).trim();
    if (f.notes) data.notes = f.notes;
    return { path: ['jobs', record.idempotencyKey], data };
  },

  dft(f, record, ctx) {
    const v = num(f.dft_micron);
    // The form's explicit outcome wins (HANDLER_FORMS.md: inspector judgment
    // is a field, not a formula). The 8-12 µm derivation only covers records
    // queued by builds that predate the outcome field — flagged when used.
    const derived = !f.outcome;
    const data = {
      ...envelope(record, ctx),
      job_id: f.job,
      micron_value: v,
      outcome: f.outcome || (v >= 8 && v <= 12 ? 'pass' : 'fail-rework'),
    };
    if (derived) data.outcome_derived = true;
    if (f.notes) data.notes = f.notes;
    return { path: ['dft_measurements', record.idempotencyKey], data };
  },

  dispatch(f, record, ctx) {
    // KNOWN GAP (12 Jun review): this only creates the dispatch_events doc —
    // nothing flips jobs/{jid}.current_status to 'dispatched'. That is the
    // Stage E aggregator CF's job (skeleton today), and the rules block a
    // client-side flip on jobs outside the author's 24h edit window. Until
    // the aggregator ships, handler-dispatched jobs stay 'in-flight' and
    // keep appearing in the OPEN_JOB_STATUSES picker query.
    const data = { ...envelope(record, ctx), job_id: f.job };
    if (f.weight != null) data.weight_kg = num(f.weight);
    if (f.notes) data.notes = f.notes;
    return { path: ['dispatch_events', record.idempotencyKey], data };
  },

  stock_refill(f, record, ctx) {
    // Cost + supplier are OPTIONAL (Stage D ruling — material arrives on
    // unpriced challans; the priced invoice follows). When cost is present,
    // the unit follows the stock item's tracked unit (DEF_STOCK): litre-
    // tracked chemistry per litre, everything else per kg.
    const data = {
      ...envelope(record, ctx),
      qty_received: num(f.quantity),
    };
    if (f.cost != null && num(f.cost) > 0) {
      data.unit_cost = num(f.cost);
      data.cost_unit = stockUnitFor(f.item) === 'L' ? 'per_liter' : 'per_kg';
    }
    if (f.supplier) data.supplier_id = f.supplier;
    if (f.notes) data.notes = f.notes;
    return { path: ['stock_items', f.item, 'receipts', record.idempotencyKey], data };
  },

  stock_deplete(f, record, ctx) {
    const data = {
      ...envelope(record, ctx),
      qty_depleted: num(f.quantity),
      reason: f.reason || 'production_use',
    };
    // Stock-take companion: level remaining after the draw. 0 = NIL —
    // the Live view's reorder alert keys on this.
    if (f.level_after != null && num(f.level_after) >= 0) data.level_after = num(f.level_after);
    if (f.notes) data.notes = f.notes;
    return { path: ['stock_items', f.item, 'depletions', record.idempotencyKey], data };
  },

  machine_state(f, record, ctx) {
    const data = { ...envelope(record, ctx), state: f.state };
    if (f.notes) data.notes = f.notes;
    return { path: ['machines', f.machine, 'state_transitions', record.idempotencyKey], data };
  },

  check_in(f, record, ctx) {
    // slot (morning_ot / regular / evening_ot) is the T-CH payload — it maps
    // each in/out straight onto the payroll OT decomposition.
    const data = { ...envelope(record, ctx), direction: f.direction };
    if (f.slot) data.slot = f.slot;
    return { path: ['workers', f.worker, 'shifts', record.idempotencyKey], data };
  },

  note(f, record, ctx) {
    const text = String(f.note_text || '').trim();
    const data = {
      ...envelope(record, ctx),
      // Rules check created_by.uid (not author_user_id) on notes.
      created_by: { uid: ctx.uid },
      summary: text.slice(0, 120),
      body: text,
      kind: f.note_kind || 'general',
      status: 'active',
      priority: f.priority === 'urgent' ? 'urgent' : 'normal',
      topic_refs: [f.note_kind || 'general'],
    };
    return { path: ['notes', record.idempotencyKey], data };
  },
};

export function recordToWrite(record, ctx) {
  const mapper = MAPPERS[record.type];
  if (!mapper) throw new PermanentRejection(`unknown record type '${record.type}'`);
  if (!ctx?.uid) throw new Error('not-signed-in');
  const w = mapper(record.fields || {}, record, ctx);
  // Path-segment guard: the doc path carries picker fields the data schema
  // never sees (worker / item / machine / job). A missing one would reach
  // fs.doc() as `undefined`, whose SDK error is classified TRANSIENT by the
  // flush loop — wedging the queue behind the poisoned record on every flush.
  // Absence here is content-deterministic → permanent, like the schema gate.
  if (w.path.some((seg) => typeof seg !== 'string' || seg === '')) {
    throw new PermanentRejection('path: missing segment');
  }
  // Zod gate (Stage D hardening): the mapped doc must satisfy its form-type
  // schema — the exact shape Firestore receives. A failure here is
  // content-deterministic (retrying the identical doc gets the identical
  // verdict), so it is a PermanentRejection, parked in the rejected-store
  // rather than retried against the rules forever. The mappers above still
  // throw their own domain rejections first (station whitelist, qty
  // derivation); this is the backstop that also guards the enums the rules
  // leave unchecked (dispatch / check-in / machine-state).
  const v = validateWrite(record.type, w.data);
  if (!v.ok) throw new PermanentRejection(`schema: ${v.reason}`);
  return w;
}

// fs = the firebase/firestore module namespace (injected so this file
// stays statically import-free of Firebase and the bundle split holds).
export function createTransport({ db, auth, fs }) {
  return async (record) => {
    const user = auth.currentUser;
    if (!user) throw new Error('not-signed-in'); // transient: stay queued
    const w = recordToWrite(record, { uid: user.uid, build: BUILD, serverTimestamp: fs.serverTimestamp });
    const ref = fs.doc(db, ...w.path);
    try {
      await fs.setDoc(ref, w.data);
    } catch (err) {
      if (err?.code === 'permission-denied') {
        // The rules' verdict is NOT a pure function of the doc — it reads
        // mutable state (active_token_id, revoked_at, min_supported_build).
        // A denial here is therefore treated as TRANSIENT: re-provisioning
        // or a build update can make the same record valid, and parking a
        // whole day's queue over a token rotation would invite data loss.
        // Content-deterministic rejections are recordToWrite's job (above),
        // raised as PermanentRejection BEFORE anything is sent.
        //
        // One denial cause IS handled here: a doc that already exists (a
        // crash or concurrent flush replayed the same idempotency key — the
        // create rule's serverTimestamp/pinning checks fail on the second
        // attempt). Existence check runs only on this failure path so the
        // happy path costs one write and zero reads.
        const existing = await fs.getDoc(ref).catch(() => null);
        if (existing?.exists()) return; // already synced — treat as success
      }
      throw err; // transient (offline, unavailable, env denial) — retry later
    }
  };
}
