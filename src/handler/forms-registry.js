// The 9 handler forms (HANDLER_FORMS.md), completed to Stage D field
// level in the soma-internal evidence order (decisions/2026-06-12.md §2):
//   1. Check-in — OT slot tagging (T-CH: morning 6 AM / evening post-5 PM
//      slots are the independence-gap data Champai records).
//   2. Production — rounds × round size (the register's native grain:
//      "108-round", "25×6").
//   3. Job receipt — challan number + NOS count (incoming-material log).
//   4. Stock depletion — reason + level-after (chemistry stock-take; a
//      level_after of 0 is Shyam's "NIL" and feeds the viewer's alert).
//   5. Note — power-cut / incident kinds + urgency (power-cut log).
// Still deferred: Zod at the form boundary, the full pre-fill defense
// bundle, 2σ sanity prompts, CF-mediated cross-doc validation.

import { DEF_PERM, DEF_CW } from '../shared/config/workers.js';
import { DEF_AREAS } from '../shared/config/areas.js';
import { DEF_STOCK } from '../shared/config/stock.js';
import { getCache } from './picker-cache.js';

// --- Picker item providers ---
// Worker / machine / stock-item come from real config (DEF_PERM / DEF_AREAS /
// DEF_STOCK). Customer / part / job / supplier come from the Firestore-
// hydrated cache (picker-cache.js) — empty until Track 2 wires the listener,
// which is honest rather than the Stage C placeholders it replaces.
const workerItems = () => [
  ...DEF_PERM.filter((w) => !w.inactive).map((w) => ({ id: w.id, primary: w.name, sub: w.role })),
  ...DEF_CW.filter((w) => !w.inactive).map((w) => ({ id: w.id, primary: w.name, sub: 'Contractor' })),
];

const machineItems = () => DEF_AREAS.map((a) => ({
  id: a.id, primary: a.name, sub: a.group, method: a.group === 'vat' ? 'V' : a.group === 'barrel' ? 'B' : '—',
}));

// `item` = our consumable stock (chemicals) — used by the stock forms.
const itemItems = () => DEF_STOCK.map((s) => ({ id: s.id, primary: s.name, sub: s.unit }));

// `part` = a CUSTOMER part / SKU (items collection) — distinct from stock.
// The production register keys on customer + SKU, so Production needs this.
const partItems = () => getCache('part');
const jobItems = () => getCache('job');
const customerItems = () => getCache('customer');
const supplierItems = () => getCache('supplier');

// Stations the Firestore rules accept (isValidProductionEntry). Passivation
// is real floor work but the locked v2 schema folds it into plating — the
// option was a silent reject-on-sync trap (HANDLER_FORMS.md locks station as
// machine-derived anyway; the select survives only as an alpha override).
const STATION_OPTS = [
  { value: 'pickling', labelKey: 'opt_pickling' },
  { value: 'plating', labelKey: 'opt_plating' },
  { value: 'inspection', labelKey: 'opt_inspection' },
];
const STATE_OPTS = [
  { value: 'running', labelKey: 'opt_running' },
  { value: 'idle', labelKey: 'opt_idle' },
  { value: 'down', labelKey: 'opt_down' },
];
const DIRECTION_OPTS = [
  { value: 'in', labelKey: 'opt_in' },
  { value: 'out', labelKey: 'opt_out' },
];
// OT slots per the codex convention (decisions/2026-06-10.md): morning OT
// is the 6–8:30 AM slot (counted 3 hr), evening OT is post-5 PM.
const SLOT_OPTS = [
  { value: 'morning_ot', labelKey: 'opt_morning_ot' },
  { value: 'regular', labelKey: 'opt_regular' },
  { value: 'evening_ot', labelKey: 'opt_evening_ot' },
];
const REASON_OPTS = [
  { value: 'production_use', labelKey: 'opt_use' },
  { value: 'waste', labelKey: 'opt_waste' },
  { value: 'spillage', labelKey: 'opt_spill' },
  { value: 'theft', labelKey: 'opt_theft' },
  { value: 'other', labelKey: 'opt_other' },
];
const PRIORITY_OPTS = [
  { value: 'normal', labelKey: 'opt_normal' },
  { value: 'urgent', labelKey: 'opt_urgent' },
];

// Smart default: infer the OT slot from the clock (override stays one tap).
function inferSlot() {
  const h = new Date().getHours();
  if (h < 9) return 'morning_ot';
  if (h < 17) return 'regular';
  return 'evening_ot';
}

const PICKERS = {
  job: jobItems, machine: machineItems, worker: workerItems,
  customer: customerItems, item: itemItems, part: partItems, supplier: supplierItems,
};

const posNumber = (v) => (Number(v) > 0 ? null : '> 0');
const nonNegNumber = (v) => (Number(v) >= 0 ? null : '≥ 0');
const dftRange = (v) => (Number(v) > 50 ? '0–50 µm' : Number(v) > 0 ? null : '> 0');

// Production quantity is required unless rounds × round size carries the
// count; job-receipt weight is required unless the challan is NOS-only.
const qtyUnlessRounds = (s) => !(Number(s.rounds) > 0 && Number(s.round_size) > 0);
const kgUnlessPcs = (s) => !(Number(s.received_pcs) > 0);

// --- Form definitions ---
// `remember:true` fields pre-fill from the previous submission of the form.
export const FORMS = [
  {
    id: 'production', icon: '🏭', titleKey: 'production', mode: 'continue',
    pickers: PICKERS,
    fields: [
      { key: 'job', labelKey: 'f_job', kind: 'picker', pickerKey: 'job', icon: '📋', required: true, remember: true },
      // Customer SKU run on this job — the register keys on customer+SKU.
      // Optional in alpha (the part cache is empty until Track 2 hydration).
      { key: 'part', labelKey: 'f_part', kind: 'picker', pickerKey: 'part', icon: '🏷️', remember: true },
      { key: 'machine', labelKey: 'f_machine', kind: 'picker', pickerKey: 'machine', icon: '🔧', required: true, remember: true },
      { key: 'worker', labelKey: 'f_worker', kind: 'picker', pickerKey: 'worker', icon: '👷', required: true, remember: true },
      // The register's native grain is rounds: "108-round" VAT days, "25×6"
      // batches. Either enter the total, or rounds × per-round size — the
      // transport derives the total when only rounds are given.
      { key: 'rounds', labelKey: 'f_rounds', kind: 'number', icon: '🔁', validate: posNumber },
      { key: 'round_size', labelKey: 'f_round_size', kind: 'number', icon: '✖️', validate: posNumber },
      { key: 'quantity', labelKey: 'f_quantity', kind: 'number', icon: '🔢', required: qtyUnlessRounds, validate: posNumber },
      { key: 'station', labelKey: 'f_station', kind: 'select', icon: '📍', options: STATION_OPTS, remember: true },
      { key: 'notes', labelKey: 'f_notes', kind: 'notes' },
    ],
  },
  {
    id: 'job_receipt', icon: '📋', titleKey: 'job_receipt', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'customer', labelKey: 'f_customer', kind: 'picker', pickerKey: 'customer', icon: '🏢', required: true },
      // The customer's paperwork number — a label, not a key (the 107-
      // collision ruling, SCHEMA_CHANGELOG v2.1). Cross-reference only.
      { key: 'challan_no', labelKey: 'f_challan', kind: 'text', icon: '🧾' },
      { key: 'weight', labelKey: 'f_weight', kind: 'number', icon: '⚖️', required: kgUnlessPcs, validate: posNumber },
      // NOS-only challans (clamps/brackets counted in pieces) carry no kg.
      { key: 'received_pcs', labelKey: 'f_pcs', kind: 'number', icon: '🔢', validate: posNumber },
      { key: 'notes', labelKey: 'f_notes', kind: 'notes' },
    ],
  },
  {
    id: 'dft', icon: '🔬', titleKey: 'dft', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'job', labelKey: 'f_job', kind: 'picker', pickerKey: 'job', icon: '📋', required: true },
      { key: 'dft_micron', labelKey: 'f_dft_micron', kind: 'number', icon: '🔬', required: true, validate: dftRange },
      // Inspector judgment is a FIELD, not a formula (HANDLER_FORMS.md) — a
      // 7.8 µm reading can be a pass for a customer who accepts 7+.
      { key: 'outcome', labelKey: 'f_outcome', kind: 'select', icon: '⚖️', required: true, options: [
        { value: 'pass', labelKey: 'opt_pass' },
        { value: 'fail-rework', labelKey: 'opt_fail_rework' },
      ] },
      { key: 'notes', labelKey: 'f_notes', kind: 'notes' },
    ],
  },
  {
    id: 'dispatch', icon: '🚚', titleKey: 'dispatch', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'job', labelKey: 'f_job', kind: 'picker', pickerKey: 'job', icon: '📋', required: true },
      { key: 'weight', labelKey: 'f_weight', kind: 'number', icon: '⚖️', validate: posNumber },
      { key: 'notes', labelKey: 'f_notes', kind: 'notes' },
    ],
  },
  {
    id: 'stock_refill', icon: '📦', titleKey: 'stock_refill', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'item', labelKey: 'f_item', kind: 'picker', pickerKey: 'item', icon: '📦', required: true },
      { key: 'supplier', labelKey: 'f_supplier', kind: 'picker', pickerKey: 'supplier', icon: '🚛' },
      { key: 'quantity', labelKey: 'f_quantity', kind: 'number', icon: '🔢', required: true, validate: posNumber },
      { key: 'cost', labelKey: 'f_cost', kind: 'number', icon: '₹' },
      { key: 'notes', labelKey: 'f_notes', kind: 'notes' },
    ],
  },
  {
    id: 'stock_deplete', icon: '📤', titleKey: 'stock_deplete', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'item', labelKey: 'f_item', kind: 'picker', pickerKey: 'item', icon: '📦', required: true },
      { key: 'quantity', labelKey: 'f_quantity', kind: 'number', icon: '🔢', required: true, validate: posNumber },
      { key: 'reason', labelKey: 'f_reason', kind: 'select', icon: '❓', options: REASON_OPTS, default: 'production_use', required: true },
      // The chemistry stock-take companion: how much is LEFT after this
      // draw. 0 = Shyam's "NIL" — surfaces as a reorder alert in the
      // dashboard's Live view. Optional; most floor draws skip it.
      { key: 'level_after', labelKey: 'f_level_after', kind: 'number', icon: '📏', validate: nonNegNumber },
      { key: 'notes', labelKey: 'f_notes', kind: 'notes' },
    ],
  },
  {
    id: 'machine_state', icon: '🔧', titleKey: 'machine_state', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'machine', labelKey: 'f_machine', kind: 'picker', pickerKey: 'machine', icon: '🔧', required: true },
      { key: 'state', labelKey: 'f_state', kind: 'select', icon: '🚦', options: STATE_OPTS, required: true },
      { key: 'notes', labelKey: 'f_notes', kind: 'notes' },
    ],
  },
  {
    id: 'check_in', icon: '⏱', titleKey: 'check_in', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'worker', labelKey: 'f_worker', kind: 'picker', pickerKey: 'worker', icon: '👷', required: true },
      { key: 'direction', labelKey: 'f_direction', kind: 'select', icon: '↔️', options: DIRECTION_OPTS, required: true },
      // T-CH: the slot tag makes each in/out decompose straight into the
      // payroll OT model (morning 6–8:30 = 3 hr convention; evening post-5).
      // Defaults from the clock; overriding stays one tap.
      { key: 'slot', labelKey: 'f_slot', kind: 'select', icon: '🕕', options: SLOT_OPTS, default: inferSlot, required: true },
    ],
  },
  {
    id: 'note', icon: '📝', titleKey: 'note', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'note_kind', labelKey: 'f_note_kind', kind: 'select', icon: '🏷️', options: [
        { value: 'machine', labelKey: 'f_machine' },
        { value: 'job', labelKey: 'f_job' },
        { value: 'worker', labelKey: 'f_worker' },
        { value: 'item', labelKey: 'f_item' },
        // First-class incident kinds (codex power-cut-log evidence): a
        // power cut is a note today; the viewer surfaces urgent ones.
        { value: 'power_cut', labelKey: 'opt_power_cut' },
        { value: 'incident', labelKey: 'opt_incident' },
      ] },
      { key: 'note_text', labelKey: 'f_note_text', kind: 'notes', icon: '📝', required: true },
      { key: 'priority', labelKey: 'f_priority', kind: 'select', icon: '🚨', options: PRIORITY_OPTS, default: 'normal' },
    ],
  },
];

export function getForm(id) { return FORMS.find((f) => f.id === id); }
