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
// All schemas .passthrough(): the mapped doc carries the envelope
// (author_user_id, created_at serverTimestamp SENTINEL, app_version, client_ts,
// idempotency_key) plus optional derived fields (rounds, part_number, …). We
// constrain the domain fields the rules judge and let the rest ride.

import { z } from 'zod';

const str = z.string().min(1);
// Envelope's created_at is a serverTimestamp() sentinel (an object) on the
// happy path and a stub in tests — never constrained here; passthrough carries it.

// production_entries — mirror isValidProductionEntry. At least one of
// qty_pcs / qty_kg present and > 0; both bounded [0, 100000).
const qtyField = z.number().nonnegative().lt(100000);
export const ProductionWrite = z.object({
  job_id: str,
  machine_id: str,
  worker_id: str,
  station: z.enum(['pickling', 'plating', 'inspection', 'dispatch']),
  qty_pcs: qtyField.optional(),
  qty_kg: qtyField.optional(),
}).passthrough().refine(
  (d) => (d.qty_pcs ?? 0) > 0 || (d.qty_kg ?? 0) > 0,
  { message: 'need a positive qty_pcs or qty_kg' },
);

// jobs (job receipt) — mirror isValidJob.
export const JobReceiptWrite = z.object({
  customer_id: str,
  received_kg: z.number().nonnegative().lt(100000),
  received_pcs: z.number().nonnegative().lt(1000000).optional(),
  route: z.enum(['standard', 'rework-active', 'rework-completed']),
  current_status: z.enum(['in-flight', 'ready', 'dispatched']),
}).passthrough().refine(
  (d) => d.received_kg > 0 || (d.received_pcs ?? 0) > 0,
  { message: 'need a positive received_kg or received_pcs' },
);

// dft_measurements — mirror isValidDftMeasurement (0 < micron ≤ 50).
export const DftWrite = z.object({
  job_id: str,
  micron_value: z.number().positive().max(50),
  outcome: z.enum(['pass', 'fail-rework']),
}).passthrough();

// dispatch_events — rules are SILENT on content; this is the only guard.
export const DispatchWrite = z.object({
  job_id: str,
  weight_kg: z.number().positive().optional(),
}).passthrough();

// stock_items/{sid}/receipts — mirror isValidStockReceipt (cost/supplier
// optional; cost_unit must accompany unit_cost).
export const StockRefillWrite = z.object({
  qty_received: z.number().positive(),
  unit_cost: z.number().positive().optional(),
  cost_unit: z.enum(['per_kg', 'per_bag', 'per_liter']).optional(),
  supplier_id: str.optional(),
}).passthrough().refine(
  (d) => !('cost_unit' in d) || d.unit_cost != null,
  { message: 'cost_unit without unit_cost' },
).refine(
  (d) => d.unit_cost == null || d.cost_unit != null,
  { message: 'unit_cost without cost_unit' },
);

// stock_items/{sid}/depletions — mirror isValidStockDepletion.
export const StockDepleteWrite = z.object({
  qty_depleted: z.number().positive(),
  reason: z.enum(['production_use', 'waste', 'spillage', 'theft', 'other']),
  level_after: z.number().nonnegative().optional(),
}).passthrough();

// machines/{mid}/state_transitions — rules SILENT on the state enum.
export const MachineStateWrite = z.object({
  state: z.enum(['running', 'idle', 'down']),
}).passthrough();

// workers/{wid}/shifts — rules SILENT on direction / slot enums.
export const CheckInWrite = z.object({
  direction: z.enum(['in', 'out']),
  slot: z.enum(['morning_ot', 'regular', 'evening_ot']).optional(),
}).passthrough();

// notes — mirror isValidNote (summary 1..120, non-empty topic_refs, status).
export const NoteWrite = z.object({
  created_by: z.object({ uid: str }).passthrough(),
  summary: z.string().min(1).max(120),
  body: z.string(),
  status: z.enum(['active', 'resolved', 'archived']),
  priority: z.enum(['normal', 'urgent']),
  topic_refs: z.array(z.string()).min(1),
}).passthrough();

const BY_TYPE = {
  production: ProductionWrite,
  job_receipt: JobReceiptWrite,
  dft: DftWrite,
  dispatch: DispatchWrite,
  stock_refill: StockRefillWrite,
  stock_deplete: StockDepleteWrite,
  machine_state: MachineStateWrite,
  check_in: CheckInWrite,
  note: NoteWrite,
};

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
