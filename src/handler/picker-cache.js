// Picker cache — the Stage B/D seam that replaces Stage C's hardcoded
// placeholder lists (ABC Industries / J-1042 / Tara Traders).
//
// High-frequency picker fields (customer, part/SKU, job, supplier) read from
// an in-memory cache that is hydrated from IndexedDB at boot. In Track 2 a
// Firestore listener calls setCache(kind, items) whenever those collections
// change, and the cache persists to IndexedDB so the picker works offline.
// Until Firestore is wired, caches default EMPTY and the picker honestly
// shows "no recent" — no faked data. Worker/machine/stock-item pickers stay
// config-backed (DEF_PERM / DEF_AREAS / DEF_STOCK) — those are real already.

import { idbAvailable, idbGet, idbSet } from './idb.js';

const KINDS = ['customer', 'part', 'job', 'supplier'];
const CACHE = Object.fromEntries(KINDS.map((k) => [k, []]));
const KEY = (kind) => `pickcache:${kind}`;

// Synchronous read — the form engine's `def.pickers[key]()` contract.
export function getCache(kind) { return CACHE[kind] || []; }

// Track 2 entry point: a Firestore read maps docs → picker items and calls this.
export function setCache(kind, items) {
  CACHE[kind] = Array.isArray(items) ? items : [];
  if (idbAvailable()) idbSet(KEY(kind), CACHE[kind]).catch(() => {});
  return CACHE[kind];
}

// Boot: restore the last persisted snapshot so the picker is populated offline.
export async function hydrateCaches(kinds = KINDS) {
  if (!idbAvailable()) return;
  for (const kind of kinds) {
    const saved = await idbGet(KEY(kind)).catch(() => null);
    if (Array.isArray(saved)) CACHE[kind] = saved;
  }
}

// --- Pure adapters: SCHEMA v2 docs → picker-item shape ---
// Picker item: { id, primary, sub?, tier?, method? }. These are the bridge
// from the invoicing importer's output to the UI; unit-tested.

export function customerToPickerItem(c) {
  return {
    id: c.id,
    primary: c.name,
    sub: c.default_billing_unit === 'pcs' ? 'pcs' : 'kg',
    tier: c.default_quality_tier === 'premium' ? 'P' : 'S',
  };
}

export function itemToPickerItem(it) {
  return {
    id: it.id,
    primary: it.part_number || it.description,
    sub: it.description && it.description !== it.part_number ? it.description : (it.default_unit || ''),
    method: it.default_unit === 'NOS' ? 'NOS' : 'KG',
  };
}

export function jobToPickerItem(j, customerName) {
  // The floor thinks in customers first (the register keys on customer+SKU),
  // so the resolved customer NAME is the primary line; the challan number —
  // captured at receipt (challan_no) or imported (sep_invoicing_challan_no) —
  // is the cross-reference sub-line. Raw customer_id only as a last resort.
  const challan = j.challan_no || j.sep_invoicing_challan_no;
  return {
    id: j.id,
    primary: customerName || j.customer_id,
    sub: challan ? `Challan ${challan}` : j.id,
    method: j.current_status === 'dispatched' ? '✓' : '•',
  };
}

export const customersToPickerItems = (cs = []) => cs.map(customerToPickerItem);
export const itemsToPickerItems = (its = []) => its.map(itemToPickerItem);
export const jobsToPickerItems = (js = [], namesById = {}) =>
  js.map((j) => jobToPickerItem(j, namesById[j.customer_id]));
