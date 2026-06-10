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

// --- Picker item providers ---
const workerItems = () => [
  ...DEF_PERM.filter((w) => !w.inactive).map((w) => ({ id: w.id, primary: w.name, sub: w.role })),
  ...DEF_CW.filter((w) => !w.inactive).map((w) => ({ id: w.id, primary: w.name, sub: 'Contractor' })),
];

const machineItems = () => DEF_AREAS.map((a) => ({
  id: a.id, primary: a.name, sub: a.group, method: a.group === 'vat' ? 'V' : a.group === 'barrel' ? 'B' : '—',
}));

const itemItems = () => DEF_STOCK.map((s) => ({ id: s.id, primary: s.name, sub: s.unit }));

// Seed lists — replaced by the Firestore-hydrated cache in Stage B/D.
const jobItems = () => [
  { id: 'J-1042', primary: 'ABC Industries', sub: 'J-1042', tier: 'P', method: 'V' },
  { id: 'J-1041', primary: 'XYZ Auto',       sub: 'J-1041', tier: 'S', method: 'B' },
  { id: 'J-1038', primary: 'DEF Hardware',   sub: 'J-1038', tier: 'P', method: 'V' },
];
const customerItems = () => [
  { id: 'C-ABC', primary: 'ABC Industries', tier: 'P' },
  { id: 'C-XYZ', primary: 'XYZ Auto',       tier: 'S' },
  { id: 'C-DEF', primary: 'DEF Hardware',   tier: 'P' },
];
const supplierItems = () => [
  { id: 'S-TARA', primary: 'Tara Traders' },
  { id: 'S-GROWEL', primary: 'Growel Chem' },
];

const STATION_OPTS = [
  { value: 'pickling', labelKey: 'opt_pickling' },
  { value: 'plating', labelKey: 'opt_plating' },
  { value: 'passivation', labelKey: 'opt_passivation' },
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
  customer: customerItems, item: itemItems, supplier: supplierItems,
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
