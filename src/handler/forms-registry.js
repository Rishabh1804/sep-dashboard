// The 9 handler forms (HANDLER_FORMS.md). Stage C defines each form's
// shape — icon, title, mode, fields, picker sources — so the universal
// engine can render all of them and the shell is a complete data-capture
// surface. What Stage D adds on top: Zod schemas, the full pre-fill
// defense bundle, sanity hard-blocks beyond the basic ones here, and
// CF-mediated cross-doc validation for Production / DFT / Dispatch.
//
// Picker sources currently seed from local config + a small static job/
// customer/supplier list. Stage B/D replaces these with the recent-first
// IndexedDB cache hydrated from Firestore.

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

const PICKERS = {
  job: jobItems, machine: machineItems, worker: workerItems,
  customer: customerItems, item: itemItems, part: partItems, supplier: supplierItems,
};

const posNumber = (v) => (Number(v) > 0 ? null : '> 0');
const dftRange = (v) => (Number(v) > 50 ? '0–50 µm' : Number(v) > 0 ? null : '> 0');

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
      { key: 'quantity', labelKey: 'f_quantity', kind: 'number', icon: '🔢', required: true, validate: posNumber },
      { key: 'station', labelKey: 'f_station', kind: 'select', icon: '📍', options: STATION_OPTS, remember: true },
      { key: 'notes', labelKey: 'f_notes', kind: 'notes' },
    ],
  },
  {
    id: 'job_receipt', icon: '📋', titleKey: 'job_receipt', mode: 'return',
    pickers: PICKERS,
    fields: [
      { key: 'customer', labelKey: 'f_customer', kind: 'picker', pickerKey: 'customer', icon: '🏢', required: true },
      { key: 'weight', labelKey: 'f_weight', kind: 'number', icon: '⚖️', required: true, validate: posNumber },
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
      ] },
      { key: 'note_text', labelKey: 'f_note_text', kind: 'notes', icon: '📝', required: true },
    ],
  },
];

export function getForm(id) { return FORMS.find((f) => f.id === id); }
