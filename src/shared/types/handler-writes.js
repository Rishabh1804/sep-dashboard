// Handler write-boundary schemas — the per-form Zod gate (Stage D hardening).
//
// schemas.js/HandlerRecordSchema validates the queued record ENVELOPE
// ({type, idempotencyKey, ts, fields}). These validate the MAPPED FIRESTORE
// DOC that transport.recordToWrite produces — the exact shape that hits
// Firestore — one schema per form type, keyed by record.type.
//
// Two reasons this is load-bearing, not ceremony:
//   1. Lockstep with the rules. Each schema mirrors an isValidX predicate in
//      FIRESTORE_RULES.ref.txt. A Zod-green doc the rules would reject is a
//      record that queues, gets a permission-denied, and — because rule
//      denials are TRANSIENT (they read mutable token/build state) — retries
//      forever instead of being parked. Catching it here as a PermanentRejection
//      routes it to the reviewable rejected-store instead of wedging the queue.
//   2. Guarding what the rules DON'T. The deployed rules content-validate
//      production / job / dft / stock / note, but are SILENT on the enums of
//      dispatch (job_id), check-in (direction / slot) and machine-state
//      (state) — they gate those on auth/token/role only. Here is the only
//      client-side content guard for those three. Garbage enums would land.
//
// zod/mini, NOT zod classic: this module rides the handler's boot-critical
// firebase-boot chunk (via transport.js) AND the dashboard bundle (via
// edit-model.js). Classic measured ~530 kB unminified in the chunk; mini is
// ~19× smaller for the same schemas. Every bound/enum comes from
// rule-bounds.js / job-status.js — the single sources — so a rules change is
// a one-file edit here.
//
// All object schemas are LOOSE (classic .passthrough()): the mapped doc
// carries the envelope (author_user_id, created_at serverTimestamp SENTINEL,
// app_version, client_ts, idempotency_key) plus optional derived fields
// (rounds, part_number, …). We constrain the domain fields the rules judge
// and let the rest ride.

import * as z from 'zod/mini';
import { JOB_STATUSES } from './job-status.js';
import {
  QTY_MAX, PCS_MAX, DFT_MICRON_MAX,
  RULE_STATIONS, JOB_ROUTES, DEPLETION_REASONS, COST_UNITS, DFT_OUTCOMES,
  NOTE_STATUSES, NOTE_PRIORITIES, MACHINE_STATES, CHECK_DIRECTIONS, CHECK_SLOTS,
} from './rule-bounds.js';

const str = z.string().check(z.minLength(1));
const qtyField = z.number().check(z.gte(0), z.lt(QTY_MAX));
const opt = z.optional;

// --- Content fields: the domain fields the rules judge, per record type. ---
// One flat field→schema map per type so the Edit gate can validate a SINGLE
// changed field against the exact bound the write gate enforces.
const CONTENT = {
  production: {
    job_id: str,
    machine_id: str,
    worker_id: str,
    station: z.enum(RULE_STATIONS),
    qty_pcs: opt(qtyField),
    qty_kg: opt(qtyField),
  },
  job_receipt: {
    customer_id: str,
    received_kg: qtyField,
    received_pcs: opt(z.number().check(z.gte(0), z.lt(PCS_MAX))),
    route: z.enum(JOB_ROUTES),
    current_status: z.enum(JOB_STATUSES),
  },
  dft: {
    job_id: str,
    // 0 < µm <= DFT_MICRON_MAX — the cap is INCLUSIVE (see rule-bounds.js).
    micron_value: z.number().check(z.gt(0), z.lte(DFT_MICRON_MAX)),
    outcome: z.enum(DFT_OUTCOMES),
  },
  dispatch: {
    job_id: str,
    weight_kg: opt(z.number().check(z.gt(0))),
  },
  stock_refill: {
    qty_received: z.number().check(z.gt(0)),
    unit_cost: opt(z.number().check(z.gt(0))),
    cost_unit: opt(z.enum(COST_UNITS)),
    supplier_id: opt(str),
  },
  stock_deplete: {
    qty_depleted: z.number().check(z.gt(0)),
    reason: z.enum(DEPLETION_REASONS),
    level_after: opt(z.number().check(z.gte(0))),
  },
  machine_state: {
    state: z.enum(MACHINE_STATES),
  },
  check_in: {
    direction: z.enum(CHECK_DIRECTIONS),
    slot: opt(z.enum(CHECK_SLOTS)),
  },
  note: {
    created_by: z.looseObject({ uid: str }),
    summary: z.string().check(z.minLength(1), z.maxLength(120)),
    body: z.string(),
    status: z.enum(NOTE_STATUSES),
    priority: z.enum(NOTE_PRIORITIES),
    topic_refs: z.array(z.string()).check(z.minLength(1)),
  },
};

// --- Cross-field refinements — only meaningful on the FULL mapped doc. ---
const REFINES = {
  production: z.refine(
    (d) => (d.qty_pcs ?? 0) > 0 || (d.qty_kg ?? 0) > 0,
    { error: 'need a positive qty_pcs or qty_kg' },
  ),
  job_receipt: z.refine(
    (d) => d.received_kg > 0 || (d.received_pcs ?? 0) > 0,
    { error: 'need a positive received_kg or received_pcs' },
  ),
  stock_refill: z.refine(
    (d) => (d.cost_unit == null) === (d.unit_cost == null),
    { error: 'unit_cost and cost_unit travel together' },
  ),
};

const BY_TYPE = Object.fromEntries(Object.entries(CONTENT).map(([type, fields]) => {
  const base = z.looseObject(fields);
  return [type, REFINES[type] ? base.check(REFINES[type]) : base];
}));

/**
 * Validate a mapped write doc against its form-type schema.
 * Returns { ok:true } or { ok:false, reason } — a short human string suitable
 * for the rejected-store's reason field. Never throws. An unknown type is a
 * failure (a record type with no schema must not slip through the gate).
 */
export function validateWrite(type, data) {
  const schema = BY_TYPE[type];
  if (!schema) return { ok: false, reason: `no write schema for '${type}'` };
  const r = schema.safeParse(data);
  if (r.success) return { ok: true };
  const first = r.error.issues[0];
  const path = first?.path?.length ? `${first.path.join('.')}: ` : '';
  return { ok: false, reason: `${path}${first?.message || 'invalid'}` };
}

// --- Edit-surface gate -------------------------------------------------------
// The dashboard's Edit tab writes with the admin identity, which the deployed
// rules short-circuit past content validation (isAdmin() ||) — so this module
// is the ONLY content guard on that path too. Field-level on purpose: an edit
// is a partial (changed fields + revision bookkeeping), so cross-field refines
// don't apply; each changed value is judged against the same per-field bound
// the write gate enforces. Keys are the dashboard's collection names (doc
// path), mapped to record types here.
const TYPE_BY_COLLECTION = {
  production_entries: 'production',
  jobs: 'job_receipt',
  dft_measurements: 'dft',
  dispatch_events: 'dispatch',
  receipts: 'stock_refill',
  depletions: 'stock_deplete',
  state_transitions: 'machine_state',
  shifts: 'check_in',
  notes: 'note',
};

/**
 * Validate one edited field value for a collection. Fields the rules don't
 * judge (notes, labels, challan_no) pass — the gate constrains exactly what
 * the write gate constrains, nothing more. Returns { ok } or { ok:false, reason }.
 */
export function validateEditField(collection, key, value) {
  const type = TYPE_BY_COLLECTION[collection];
  const fieldSchema = type ? CONTENT[type]?.[key] : undefined;
  if (!fieldSchema) return { ok: true };
  const r = fieldSchema.safeParse(value);
  if (r.success) return { ok: true };
  const first = r.error.issues[0];
  return { ok: false, reason: `${key}: ${first?.message || 'invalid'}` };
}
