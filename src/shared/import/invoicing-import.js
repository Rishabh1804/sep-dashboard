// sep-invoicing → Firestore importer (Stage B, Track 1).
//
// sep-invoicing is the system of record for billing (customers, item rates,
// invoices). Per the ratified Stage-B decisions (AskUserQuestion 2026-06-10),
// Firestore is SoR for the floor and is *fed* by sep-invoicing's JSON export.
// This module is the deterministic, idempotent transform from that export's
// shape into SCHEMA v2 documents — the historical seed and the ongoing bridge.
//
// Pure, dependency-free, side-effect-free: it takes the parsed export object
// and returns plain document arrays. The caller (Layer 2 / a Cloud Function in
// Track 2) is responsible for validating (Zod) and writing them to Firestore.
//
// Source shape (sep-invoicing backup JSON), the fields we read:
//   clients[]:         { id, name, add1, add2, add3, phone, mobile, email,
//                        gstin, billingMode: 'weight'|'piece', isActive }
//   items[]:           { id, partNumber, desc, hsn, unit: 'KG'|'NOS', stdWeightKg }
//   incomingMaterial[]:{ id, challanNo, challanDate, clientId, items: [
//                          { id, partNumber, desc, unit, qty, rate, amount,
//                            invoiced, invoiceId, nosQty } ] }
//
// Output (SCHEMA v2): { customers, items, jobs, jobLines }. jobLines are flat
// with a job_id FK (Firestore subcollection writes derive the path from it).

export const IMPORT_SCHEMA_VERSION = 2;

// --- small pure helpers (exported for unit tests) ---

// sep-invoicing bills 'weight' (kg) or 'piece' (pcs). Floor default_billing_unit.
export function mapBillingUnit(billingMode) {
  return billingMode === 'piece' ? 'pcs' : 'kg';
}

// sep-invoicing stores std weight in KILOgrams per piece (e.g. 0.098). The app
// wants grams. Null/0/undefined → null (uncalibrated), never a fake 0.
export function wppGramsFromStdWeight(stdWeightKg) {
  if (stdWeightKg == null || stdWeightKg === 0) return null;
  const g = Number(stdWeightKg) * 1000;
  return Number.isFinite(g) ? Math.round(g * 1000) / 1000 : null;
}

// Source `unit` is 'KG' or 'NOS' (occasionally lower/mixed case). Normalize.
export function normalizeUnit(unit) {
  const u = String(unit || '').trim().toUpperCase();
  if (u === 'KG') return 'KG';
  if (u === 'NOS' || u === 'NO' || u === 'PCS' || u === 'PC') return 'NOS';
  return u || 'KG';
}

// Stable ids — re-running the import on the same export yields identical ids,
// so a write is an idempotent upsert, never a duplicate.
export const customerId = (clientId) => `cust-${clientId}`;
export const itemId = (sourceId) => `item-${sourceId}`;
// Job id = the IM row's SOURCE id (unique across the export), NOT the
// challan number: challanNo is the CUSTOMER's number — different customers
// legitimately issue overlapping numbers ("1", "10", "100" all repeat across
// clients in the real export; 107 collisions over 508 rows) and some rows
// carry no challan number at all. Ruled 12 Jun 2026 after the dry-run guard
// fired. The challan number survives as sep_invoicing_challan_no for
// human cross-reference.
export const jobId = (imId) => `sep-${imId}`;
export const jobLineId = (job, lineSourceId, idx) =>
  `${job}__${lineSourceId != null ? lineSourceId : `l${idx}`}`;

function joinAddress(c) {
  return [c.add1, c.add2, c.add3].map((s) => (s || '').trim()).filter(Boolean).join(', ');
}

// Firestore setDoc throws outright on explicit `undefined` field values
// ("Unsupported field value: undefined"), in both the web and Admin SDKs
// (unless ignoreUndefinedProperties is set, which we don't rely on). Emitted
// docs must therefore OMIT absent fields, not carry undefined. Deep over
// plain objects (contact_info); null is preserved (it's meaningful: e.g.
// wpp_grams null = uncalibrated).
export function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? stripUndefined(v) : v;
  }
  return out;
}

// --- entity transforms ---

export function toCustomer(client, stamp) {
  return {
    __schema_version: IMPORT_SCHEMA_VERSION,
    id: customerId(client.id),
    name: client.name,
    contact_info: {
      phone: client.phone || client.mobile || undefined,
      email: client.email || undefined,
      address: joinAddress(client) || undefined,
    },
    client_tier: 'default', // not in source; promoted manually later
    default_quality_tier: 'standard', // not in source
    default_billing_unit: mapBillingUnit(client.billingMode),
    is_informal: false,
    sep_invoicing_customer_id: client.id,
    deleted_at: client.isActive === false ? stamp.now : null,
    ...stamp.audit,
  };
}

export function toItem(srcItem, stamp) {
  return {
    __schema_version: IMPORT_SCHEMA_VERSION,
    id: itemId(srcItem.id),
    part_number: srcItem.partNumber,
    description: srcItem.desc || srcItem.partNumber,
    hsn: srcItem.hsn || undefined,
    default_unit: normalizeUnit(srcItem.unit),
    wpp_grams: wppGramsFromStdWeight(srcItem.stdWeightKg),
    wpp_calibrated_at: null,
    default_plating_method: null, // not derivable from billing source
    deleted_at: null,
    ...stamp.audit,
  };
}

// A challan (incomingMaterial) becomes one Job + N job_lines. Returns
// { job, lines } so the caller writes the parent then the subcollection.
export function toJobWithLines(im, itemsByPart, stamp) {
  const job = jobId(im.id);
  // Blank trailing rows (no partNumber, no desc, qty 0) are saved empty form
  // lines in sep-invoicing (real export: IM-1775812632470 line 3) — they carry
  // zero information and fail the schema's min-length checks. Skipped, and
  // counted in stats.emptyLinesSkipped so the drop is visible, not silent.
  const blank = (li) => !String(li.partNumber || '').trim()
    && !String(li.desc || '').trim() && !(Number(li.qty) > 0);
  const srcLines = (im.items || []);
  const emptyLinesSkipped = srcLines.filter(blank).length;
  const lines = srcLines.filter((li) => !blank(li)).map((li, idx) => {
    const unit = normalizeUnit(li.unit);
    const resolved = itemsByPart.get(String(li.partNumber));
    const qty = Number(li.qty) || 0;
    return {
      __schema_version: IMPORT_SCHEMA_VERSION,
      id: jobLineId(job, li.id, idx),
      job_id: job,
      item_id: resolved ? resolved.id : undefined,
      part_number: li.partNumber,
      description: li.desc || li.partNumber,
      qty,
      unit,
      qty_kg: unit === 'KG' ? qty : undefined,
      qty_pcs: li.nosQty != null ? Number(li.nosQty) : unit === 'NOS' ? qty : undefined,
      rate: li.rate != null ? Number(li.rate) : undefined,
      amount: li.amount != null ? Number(li.amount) : undefined,
      invoiced: li.invoiced === true,
      invoice_id: li.invoiceId || undefined,
      ...stamp.audit,
    };
  });

  const received_kg = lines.reduce((s, l) => s + (l.qty_kg || 0), 0);
  const received_pcs = lines.reduce((s, l) => s + (l.qty_pcs || 0), 0);
  const allInvoiced = lines.length > 0 && lines.every((l) => l.invoiced);

  return {
    emptyLinesSkipped,
    job: {
      __schema_version: IMPORT_SCHEMA_VERSION,
      id: job,
      customer_id: customerId(im.clientId),
      item_id: lines.length === 1 ? lines[0].item_id : undefined,
      sep_invoicing_challan_no: im.challanNo != null && im.challanNo !== '' ? String(im.challanNo) : undefined,
      sep_invoicing_challan_date: im.challanDate || im.receivedDate || undefined,
      sep_invoicing_customer_id: im.clientId,
      is_informal: false,
      received_kg: Math.round(received_kg * 1000) / 1000,
      received_pcs: received_pcs || undefined,
      route: 'standard',
      current_status: allInvoiced ? 'dispatched' : 'in-flight',
      received_at: im.challanDate || im.receivedDate || undefined,
      deleted_at: null,
      ...stamp.audit,
    },
    lines,
  };
}

// --- top-level orchestrator ---

/**
 * Transform a parsed sep-invoicing export into SCHEMA v2 document arrays.
 * @param {object} exportJson parsed backup JSON
 * @param {object} [opts]
 * @param {string} [opts.appVersion] build hash stamped onto every doc
 * @param {string} [opts.authorUserId] importing actor uid
 * @param {string} [opts.now] ISO timestamp for created_at/deleted_at
 * @returns {{customers:object[], items:object[], jobs:object[], jobLines:object[], stats:object}}
 */
export function importInvoicingExport(exportJson, opts = {}) {
  const now = opts.now || new Date().toISOString();
  const stamp = {
    now,
    audit: {
      created_at: now,
      app_version: opts.appVersion || 'import',
      author_user_id: opts.authorUserId || 'system:import',
    },
  };

  const clients = exportJson.clients || [];
  const srcItems = exportJson.items || [];
  const incoming = exportJson.incomingMaterial || [];

  const customers = clients.map((c) => stripUndefined(toCustomer(c, stamp)));
  const items = srcItems.map((it) => stripUndefined(toItem(it, stamp)));

  // partNumber → item doc, for line resolution. Last write wins on dupes.
  const itemsByPart = new Map();
  for (const it of items) itemsByPart.set(String(it.part_number), it);

  const jobs = [];
  const jobLines = [];
  let emptyLinesSkipped = 0;
  for (const im of incoming) {
    const { job, lines, emptyLinesSkipped: skipped } = toJobWithLines(im, itemsByPart, stamp);
    emptyLinesSkipped += skipped;
    jobs.push(stripUndefined(job));
    for (const l of lines) jobLines.push(stripUndefined(l));
  }

  // Source-id-collision guard. jobId = `sep-{im.id}`, so two rows sharing
  // a number (e.g. if sep-invoicing resets numbering across financial years)
  // would silently upsert into ONE Job. Surface it in stats so the caller can
  // abort/branch rather than merge — a Track-2 precondition before the real
  // 508-challan import runs. jobIdCollisions === 0 is the expected healthy case.
  const seen = new Set();
  const collided = new Set();
  for (const j of jobs) { if (seen.has(j.id)) collided.add(j.id); seen.add(j.id); }

  return {
    customers,
    items,
    jobs,
    jobLines,
    stats: {
      customers: customers.length,
      items: items.length,
      jobs: jobs.length,
      jobLines: jobLines.length,
      linesResolvedToItem: jobLines.filter((l) => l.item_id).length,
      emptyLinesSkipped,
      jobIdCollisions: collided.size,
      collidingJobIds: [...collided],
    },
  };
}
