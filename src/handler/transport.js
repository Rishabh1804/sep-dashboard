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
// KNOWN RULES↔FORM SKEWS (Stage D decides which side moves; the mapper
// pre-rejects these with err.permanent=true so one bad record lands in the
// rejected store instead of wedging the whole queue):
//   - production.station 'passivation' — form offers it, rules only allow
//     pickling/plating/inspection/dispatch.
//   - stock_refill without cost or supplier — rules require unit_cost > 0
//     and supplier_id (isValidStockReceipt); the form has both optional.

import { DEF_AREAS } from '../shared/config/areas.js';
import { DEF_STOCK } from '../shared/config/stock.js';
import { BUILD } from '../shared/config/app.js';

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
      throw new PermanentRejection(`station '${station}' not accepted by rules (Stage D skew)`);
    }
    const data = {
      ...envelope(record, ctx),
      job_id: f.job,
      machine_id: f.machine,
      worker_id: f.worker,
      station,
      [qtyFieldFor(f.machine)]: num(f.quantity),
    };
    if (f.part) data.item_id = f.part;
    if (f.part__label) data.part_number = f.part__label;
    if (f.notes) data.notes = f.notes;
    return { path: ['production_entries', record.idempotencyKey], data };
  },

  job_receipt(f, record, ctx) {
    const data = {
      ...envelope(record, ctx),
      __schema_version: 2,
      customer_id: f.customer,
      received_kg: num(f.weight),
      route: 'standard',
      current_status: 'in-flight',
    };
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
    const data = { ...envelope(record, ctx), job_id: f.job };
    if (f.weight != null) data.weight_kg = num(f.weight);
    if (f.notes) data.notes = f.notes;
    return { path: ['dispatch_events', record.idempotencyKey], data };
  },

  stock_refill(f, record, ctx) {
    if (f.cost == null || !(num(f.cost) > 0) || !f.supplier) {
      throw new PermanentRejection('rules require unit_cost > 0 and supplier_id (Stage D skew)');
    }
    const data = {
      ...envelope(record, ctx),
      qty_received: num(f.quantity),
      unit_cost: num(f.cost),
      // Cost unit follows the stock item's tracked unit (DEF_STOCK): litre-
      // tracked chemistry is priced per litre, everything else per kg. A
      // per-piece tier lands with the universal stock model (Stage D+).
      cost_unit: stockUnitFor(f.item) === 'L' ? 'per_liter' : 'per_kg',
      supplier_id: f.supplier,
    };
    if (f.notes) data.notes = f.notes;
    return { path: ['stock_items', f.item, 'receipts', record.idempotencyKey], data };
  },

  stock_deplete(f, record, ctx) {
    const data = {
      ...envelope(record, ctx),
      qty_depleted: num(f.quantity),
      // The form has no reason field yet; production use is the dominant
      // case on the floor (chemistry draw). Stage D adds the selector.
      reason: 'production_use',
    };
    if (f.notes) data.notes = f.notes;
    return { path: ['stock_items', f.item, 'depletions', record.idempotencyKey], data };
  },

  machine_state(f, record, ctx) {
    const data = { ...envelope(record, ctx), state: f.state };
    if (f.notes) data.notes = f.notes;
    return { path: ['machines', f.machine, 'state_transitions', record.idempotencyKey], data };
  },

  check_in(f, record, ctx) {
    const data = { ...envelope(record, ctx), direction: f.direction };
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
      topic_refs: [f.note_kind || 'general'],
    };
    return { path: ['notes', record.idempotencyKey], data };
  },
};

export function recordToWrite(record, ctx) {
  const mapper = MAPPERS[record.type];
  if (!mapper) throw new PermanentRejection(`unknown record type '${record.type}'`);
  if (!ctx?.uid) throw new Error('not-signed-in');
  return mapper(record.fields || {}, record, ctx);
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
