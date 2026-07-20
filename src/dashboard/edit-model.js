// Edit-with-reason model — pure, Layer-5 helper. No Firebase imports, so it
// unit-tests in jsdom and parity-tests against the live rules (same discipline
// as transport.js / the importer).
//
// This is the dashboard's CORRECTION surface — the answer to the on-device
// dry-run's "edit/history missing". The handler PWA is append-only by design
// (last-10 recent log only); corrections beyond its rules-enforced 24h window
// live here, performed by the admin/steward identity the dashboard signs in as.
//
// Per STEWARD_AFFORDANCES.md (edit-with-reason: structured enum reason +
// optional evidence + append-only revisions[]) and CONFLICT_RESOLUTION.md
// (audit-log-first). The durable forensic record is an on-doc `revisions[]`
// array (STRUCTURED_NOTES.md pattern): it survives WITHOUT the audit-event
// Cloud Function, which mirrors the same change to audit_events server-side
// once deployed (functions/src/index.js → auditEventGenerator). No double
// truth — the on-doc array is the record that works today; the CF is the
// eventual server mirror.
//
// buildEditPayload is pure and returns plain objects. The impure caller
// (edit.js) attaches the Firebase sentinels: updates.last_edited_at =
// serverTimestamp(), updates.revisions = arrayUnion(revision). The revision's
// own `at` is a client millis (Firestore forbids serverTimestamp sentinels
// inside array elements), injected here for testability.

import { validateEditField, validateEditedDoc } from '../shared/types/handler-writes.js';
import {
  JOB_ROUTES, DEPLETION_REASONS, DFT_OUTCOMES,
  NOTE_STATUSES, NOTE_PRIORITIES, CHECK_DIRECTIONS, CHECK_SLOTS,
} from '../shared/types/rule-bounds.js';
import { JOB_STATUSES } from '../shared/types/job-status.js';

// Structured reason enum (STEWARD_AFFORDANCES §edit-with-reason). Free text is
// only meaningful when reason === 'other' — and a high 'other' rate is itself
// the signal that the enum is missing a category.
export const REASON_ENUM = [
  { value: 'typo', label: 'Typo' },
  { value: 'operator-misread', label: 'Operator misread' },
  { value: 'equipment-misread', label: 'Equipment misread' },
  { value: 'customer-disputed', label: 'Customer disputed' },
  { value: 'late-correction', label: 'Late correction' },
  { value: 'other', label: 'Other (specify)' },
];
const REASON_VALUES = REASON_ENUM.map((r) => r.value);

// Editable-field specs per doc type. The type is the collection key derived
// from the doc path (docTypeFromPath). Only fields listed here are editable;
// everything else on the doc is immutable from this surface. Scoped to what
// the deployed rules let an admin update (the `isAdmin() ||` short-circuit on
// each collection) and what the Live listeners + collection-group reads can
// see. Stock receipts are intentionally absent: there is no collection-group
// read rule for `receipts`, so the dashboard can't list them to edit (deferred
// with per-item listeners).
export const FIELD_SPECS = {
  production_entries: [
    { key: 'qty_pcs', label: 'Quantity (NOS)', kind: 'number' },
    { key: 'qty_kg', label: 'Quantity (kg)', kind: 'number' },
    { key: 'worker_id', label: 'Worker', kind: 'text' },
    { key: 'notes', label: 'Notes', kind: 'text' },
  ],
  dft_measurements: [
    { key: 'micron_value', label: 'DFT (µm)', kind: 'number' },
    { key: 'outcome', label: 'Outcome', kind: 'select', options: DFT_OUTCOMES },
    { key: 'notes', label: 'Notes', kind: 'text' },
  ],
  jobs: [
    { key: 'current_status', label: 'Status', kind: 'select', options: JOB_STATUSES },
    { key: 'route', label: 'Route', kind: 'select', options: JOB_ROUTES },
    { key: 'challan_no', label: 'Challan no.', kind: 'text' },
    { key: 'notes', label: 'Notes', kind: 'text' },
  ],
  dispatch_events: [
    { key: 'weight_kg', label: 'Weight (kg)', kind: 'number' },
    { key: 'notes', label: 'Notes', kind: 'text' },
  ],
  notes: [
    { key: 'summary', label: 'Summary', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'select', options: NOTE_STATUSES },
    { key: 'priority', label: 'Priority', kind: 'select', options: NOTE_PRIORITIES },
  ],
  shifts: [
    { key: 'direction', label: 'Direction', kind: 'select', options: CHECK_DIRECTIONS },
    { key: 'slot', label: 'OT slot', kind: 'select', options: CHECK_SLOTS },
  ],
  depletions: [
    { key: 'qty_depleted', label: 'Qty depleted', kind: 'number' },
    { key: 'level_after', label: 'Level after (0 = NIL)', kind: 'number' },
    { key: 'reason', label: 'Reason', kind: 'select', options: DEPLETION_REASONS },
  ],
};

// Path → collection key. Top-level docs ('jobs/{id}') key on the first
// segment; subcollection docs ('stock_items/{sid}/depletions/{id}',
// 'workers/{wid}/shifts/{sid}') key on the subcollection name (segment 2).
export function docTypeFromPath(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  if (parts.length >= 4) return parts[2];
  return parts[0] || '';
}

export function editableFields(type) {
  return FIELD_SPECS[type] || null;
}

export function isEditable(path) {
  return !!FIELD_SPECS[docTypeFromPath(path)];
}

// Coerce a raw form value (always a string from an <input>) to its typed form.
// Empty string means "left blank" → treated as no-change (this surface does
// not clear fields; that's a deliberate scope limit, not an oversight).
function coerce(spec, raw) {
  if (raw == null || raw === '') return undefined;
  if (spec.kind === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return String(raw);
}

function changedKey(spec, before, raw) {
  const next = coerce(spec, raw);
  if (next === undefined) return null;           // blank → no change
  const prev = before ? before[spec.key] : undefined;
  if (spec.kind === 'number' ? Number(prev) === next : prev === next) return null;
  return { key: spec.key, before: prev ?? null, after: next };
}

// Build the field updates + the revision to append. PURE.
//   input = { path, before, values:{fieldKey: rawString}, reason, reasonText,
//             evidence, uid, now }
// Returns { ok:false, error } or
//   { ok:true, type, changedKeys, updates, revision }.
// The caller decorates updates with serverTimestamp() + arrayUnion(revision).
export function buildEditPayload(input) {
  const { path, before = {}, values = {}, reason, reasonText = '', evidence = '', uid, now = Date.now() } = input || {};
  const type = docTypeFromPath(path);
  const spec = FIELD_SPECS[type];
  if (!spec) return { ok: false, error: `'${type}' is not editable from this surface` };
  if (!uid) return { ok: false, error: 'not signed in' };
  if (!REASON_VALUES.includes(reason)) return { ok: false, error: 'choose a reason' };
  if (reason === 'other' && !String(reasonText).trim()) return { ok: false, error: 'describe the reason' };

  const diffs = [];
  for (const fs of spec) {
    const d = changedKey(fs, before, values[fs.key]);
    if (d) diffs.push(d);
  }
  if (!diffs.length) return { ok: false, error: 'no changes to save' };

  // Schema gate (same bounds the handler's write gate enforces). Admin writes
  // short-circuit the rules' content validation (isAdmin() ||), so this is
  // the ONLY content guard on the edit path — without it a steward typo
  // (micron_value 500, a misspelled status) writes a doc the handler itself
  // could never produce, and downstream aggregators/digests consume it.
  // Per-field first (clearest error attribution), then the merged doc for
  // the cross-field refines (e.g. zeroing the only positive quantity).
  // NOTE an invalid field refuses the WHOLE edit — all-or-nothing is the
  // safe semantic for a correction surface; entered values stay in the modal.
  for (const d of diffs) {
    const v = validateEditField(type, d.key, d.after);
    if (!v.ok) return { ok: false, error: v.reason };
  }
  {
    const merged = { ...before };
    for (const d of diffs) merged[d.key] = d.after;
    const v = validateEditedDoc(type, merged, diffs.map((d) => d.key));
    if (!v.ok) return { ok: false, error: v.reason };
  }

  const after = {};
  const beforeChanged = {};
  for (const d of diffs) { after[d.key] = d.after; beforeChanged[d.key] = d.before; }

  const updates = {
    ...after,
    last_edit_reason: reason,
    last_edited_by: uid,
  };
  if (reason === 'other') updates.last_edit_reason_text = String(reasonText).trim();

  const revision = {
    at: now,
    by: uid,
    reason,
    before: beforeChanged,
    after,
  };
  if (reason === 'other') revision.reason_text = String(reasonText).trim();
  if (String(evidence).trim()) { revision.evidence = String(evidence).trim(); updates.last_edit_evidence = revision.evidence; }

  return { ok: true, type, changedKeys: diffs.map((d) => d.key), updates, revision };
}

// One-line summary of a stored revision, for the History view.
export function summarizeRevision(rev) {
  if (!rev) return '';
  const fields = Object.keys(rev.after || {});
  const changes = fields.map((k) => `${k}: ${fmtVal(rev.before?.[k])} → ${fmtVal(rev.after?.[k])}`).join(', ');
  const reason = rev.reason === 'other' && rev.reason_text ? `other — ${rev.reason_text}` : rev.reason;
  return `${changes}  ·  ${reason}`;
}

function fmtVal(v) {
  if (v == null || v === '') return '∅';
  return String(v);
}
