// Zod schemas — the validation boundary (Stage B, Track 1).
//
// Per SCHEMA.md (authoritative) these mirror the v2 shapes. They run at the
// write boundary: the importer validates its output before anything is handed
// to Firestore, and the handler validates a queued record before transport.
// When code and SCHEMA.md disagree, SCHEMA.md wins — fix here.
//
// .passthrough() keeps schemas forward-compatible: derived/audit fields added
// later don't fail validation. Required fields are the load-bearing ones.

import { z } from 'zod';
import { JOB_STATUSES } from './job-status.js';
import { QTY_MAX, PCS_MAX, JOB_ROUTES } from './rule-bounds.js';

export const SCHEMA_VERSION = 2;

const schemaVersion = z.number().int().positive();
const isoOrTs = z.union([z.string(), z.number(), z.date(), z.null()]);

export const CustomerSchema = z.object({
  __schema_version: schemaVersion,
  id: z.string().min(1),
  name: z.string().min(1),
  client_tier: z.enum(['tier-1', 'tier-2', 'default']),
  default_quality_tier: z.enum(['premium', 'standard']),
  default_billing_unit: z.enum(['kg', 'pcs']),
  is_informal: z.boolean().optional(),
  sep_invoicing_customer_id: z.number().optional(),
  deleted_at: isoOrTs.optional(),
}).passthrough();

export const ItemSchema = z.object({
  __schema_version: schemaVersion,
  id: z.string().min(1),
  part_number: z.string().min(1),
  description: z.string(),
  default_unit: z.enum(['KG', 'NOS']).optional(),
  wpp_grams: z.number().positive().nullable(),
  default_plating_method: z.enum(['cyanide', 'acid']).nullable().optional(),
}).passthrough();

export const JobLineSchema = z.object({
  __schema_version: schemaVersion,
  id: z.string().min(1),
  job_id: z.string().min(1),
  part_number: z.string().min(1),
  item_id: z.string().optional(),
  qty: z.number().nonnegative(),
  unit: z.enum(['KG', 'NOS']),
  qty_kg: z.number().nonnegative().optional(),
  qty_pcs: z.number().nonnegative().optional(),
  invoiced: z.boolean().optional(),
  invoice_id: z.string().optional(),
}).passthrough();

export const JobSchema = z.object({
  __schema_version: schemaVersion,
  id: z.string().min(1),
  customer_id: z.string().min(1),
  item_id: z.string().optional(),
  sep_invoicing_challan_no: z.string().optional(),
  sep_invoicing_customer_id: z.number().optional(),
  is_informal: z.boolean().optional(),
  // Caps + the at-least-one-positive refine mirror isValidJob in the Firestore
  // rules (FIRESTORE_RULES.ref.txt). Keep the two encodings in lockstep — a
  // Zod-green doc the rules reject means a partial import; the reverse means
  // garbage lands in Firestore. The rules emulator suite's importer-parity
  // test guards one direction; this guards the other.
  received_kg: z.number().nonnegative().lt(QTY_MAX),
  received_pcs: z.number().nonnegative().lt(PCS_MAX).optional(),
  client_tier_at_receipt: z.enum(['tier-1', 'tier-2', 'default']).optional(),
  route: z.enum(JOB_ROUTES),
  current_status: z.enum(JOB_STATUSES),
}).passthrough().refine(
  (j) => j.received_kg > 0 || (j.received_pcs ?? 0) > 0,
  { message: 'at least one of received_kg / received_pcs must be > 0' },
);

// The queued handler write (form.js buildRecord) — validated before transport.
export const HandlerRecordSchema = z.object({
  type: z.string().min(1),
  idempotencyKey: z.string().min(1),
  ts: z.number().int().positive(),
  fields: z.record(z.string(), z.unknown()),
}).passthrough();

const BY_COLLECTION = {
  customers: CustomerSchema,
  items: ItemSchema,
  jobs: JobSchema,
  jobLines: JobLineSchema,
};

/** Validate one doc against a named collection schema. Returns {ok, error?}. */
export function validateDoc(collection, doc) {
  const schema = BY_COLLECTION[collection];
  if (!schema) return { ok: false, error: `unknown collection: ${collection}` };
  const r = schema.safeParse(doc);
  return r.success ? { ok: true } : { ok: false, error: r.error };
}

/**
 * Validate the full importer output. Returns { ok, counts, failures } where
 * failures lists { collection, index, id, issues } — never throws, so a caller
 * can surface a partial-import report rather than aborting on the first bad row.
 */
export function validateImportOutput(out) {
  const failures = [];
  const counts = {};
  for (const [collection, schema] of Object.entries(BY_COLLECTION)) {
    const docs = out[collection] || [];
    counts[collection] = docs.length;
    docs.forEach((doc, index) => {
      const r = schema.safeParse(doc);
      if (!r.success) {
        failures.push({ collection, index, id: doc?.id, issues: r.error.issues });
      }
    });
  }
  return { ok: failures.length === 0, counts, failures };
}
