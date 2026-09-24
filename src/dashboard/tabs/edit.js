// Edit tab — the dashboard's CORRECTION + steward surface (DASHBOARD_VIEWER.md
// Tab 2 "recent entries by category" + edit affordance; STEWARD_AFFORDANCES.md
// edit-with-reason + inboxes). This is the answer to the on-device dry-run's
// "edit/history missing": the handler PWA is append-only by design, so every
// correction beyond its rules-enforced 24h window happens here, under the
// admin/steward identity the dashboard signs in as.
//
// What works against the ALREADY-DEPLOYED staging rules (no IAM-gated deploy):
//   - Editing handler-authored docs. The rules permit admin updates on every
//     editable collection via the `isAdmin() ||` short-circuit (production_
//     entries / dft_measurements / jobs / dispatch_events / notes / shifts /
//     depletions). The edit appends a forensic on-doc revisions[] entry — the
//     audit record that survives WITHOUT the audit-event CF (which mirrors it
//     to audit_events server-side once deployed).
//
// What is a READ-ONLY honest surface until the Cloud Functions land:
//   - Pending-conflicts inbox reads _rejected_writes (CF-written; admin/steward
//     readable). Disposition (retry/discard/annotate) writes back to a CF-only
//     collection → shown as a deferred seam, not faked.
//   - Anomaly inbox needs the anomaly-detector CF (no collection, no read rule
//     yet) → static deferred panel.
//   - Steward KPI card reads kpi_snapshots (CF-written) → renders when present.
//
// Reuses the proven Live boot path (shared, memoised firebase-session.js) and
// the shared stream formatters. Its own listeners overlap Live's; Firestore
// multiplexes them on the one app, and volumes are tiny in alpha. A future
// shared firestore-store can de-dup the two tabs.

import { esc, escAttr } from '../../shared/utils/format.js';
import { eventMillis } from '../../shared/utils/event-time.js';
import { makeStreamFormatters, fmtTime } from '../stream-format.js';
import {
  buildEditPayload, editableFields, docTypeFromPath, REASON_ENUM, summarizeRevision,
} from '../edit-model.js';
import {
  initAdoption, renderAdoption, loadAdoption, adoptionNeedsLoad,
} from '../adoption-view.js';

const STREAM_LIMIT = 50;
const tsMs = eventMillis;

// category id → { label, coll (bucket key) }
const CATEGORIES = [
  { id: 'production', label: 'Production', coll: 'production_entries' },
  { id: 'jobs', label: 'Jobs', coll: 'jobs' },
  { id: 'dft', label: 'DFT', coll: 'dft_measurements' },
  { id: 'dispatch', label: 'Dispatch', coll: 'dispatch_events' },
  { id: 'notes', label: 'Notes', coll: 'notes' },
  { id: 'checkins', label: 'Check-ins', coll: 'shifts' },
  { id: 'depletions', label: 'Depletions', coll: 'depletions' },
];
const TOP_COLLS = ['production_entries', 'jobs', 'dft_measurements', 'dispatch_events', 'notes'];

let session = null;
let bootState = 'idle';     // idle | booting | no-config | ready | error
let unsubs = [];
let claims = {};            // { is_admin, is_steward, roles } from getIdTokenResult
const docsByColl = {};      // coll → [{id, __path, ...data}]
const collErr = {};         // coll → error code
let customerNames = {};
let rejectedWrites = [];
let kpiSnapshot = null;

let view = 'records';       // records | inboxes | adoption
let activeCat = 'production';
let modal = null;           // { path, type } when an edit modal is open
let formErr = '';

const $root = () => document.getElementById('editRoot');
const custName = (id) => customerNames[id] || id || '?';

let adoptionReady = false;

export function renderEdit() {
  if (!$root()) return;
  if (!adoptionReady) { adoptionReady = true; initAdoption(paint, () => session); }
  // Retry from 'error' too (not just first 'idle'): a transient boot failure
  // (firebase/* import blip) clears the memoised session promise, so re-opening
  // the tab can genuinely recover — which is what the error card promises.
  if (bootState === 'idle' || bootState === 'error') { bootState = 'booting'; boot(); }
  paint();
}

async function boot() {
  try {
    const { bootFirebaseSession } = await import('../../shared/firebase-session.js');
    session = await bootFirebaseSession();
    if (!session) { bootState = 'no-config'; return paint(); }
    bootState = 'ready';
    session.fbAuth.onAuthStateChanged(session.auth, async (user) => {
      if (!user) { stopListeners(); claims = {}; return paint(); }
      // Resolve claims BEFORE tearing down + rebuilding listeners, so a token
      // refresh never leaves a window where paint() renders with claims={}
      // (Edit buttons flicker non-editable for an admin) and empty buckets.
      let next = {};
      try { next = (await user.getIdTokenResult()).claims || {}; } catch { next = {}; }
      claims = next;
      stopListeners();
      startListeners();
      paint();
    });
  } catch {
    bootState = 'error';
  }
  paint();
}

function stopListeners() {
  unsubs.forEach((u) => { try { u(); } catch { /* ignore */ } });
  unsubs = [];
}

function startListeners() {
  const { db, fs } = session;
  const grab = (snap) => snap.docs.map((d) => ({ id: d.id, __path: d.ref.path, ...d.data() }));
  const onErr = (key) => (err) => { collErr[key] = err?.code || 'error'; paint(); };

  for (const coll of TOP_COLLS) {
    unsubs.push(fs.onSnapshot(
      fs.query(fs.collection(db, coll), fs.orderBy('created_at', 'desc'), fs.limit(STREAM_LIMIT)),
      (s) => { docsByColl[coll] = grab(s); delete collErr[coll]; paint(); },
      onErr(coll),
    ));
  }
  // Collection-group reads (same rules path the Live viewer uses).
  unsubs.push(fs.onSnapshot(
    fs.query(fs.collectionGroup(db, 'shifts'), fs.limit(200)),
    (s) => { docsByColl.shifts = grab(s); delete collErr.shifts; paint(); }, onErr('shifts'),
  ));
  unsubs.push(fs.onSnapshot(
    fs.query(fs.collectionGroup(db, 'depletions'), fs.limit(200)),
    (s) => { docsByColl.depletions = grab(s); delete collErr.depletions; paint(); }, onErr('depletions'),
  ));
  // Customer names for job rows.
  unsubs.push(fs.onSnapshot(
    fs.query(fs.collection(db, 'customers'), fs.limit(250)),
    (s) => { customerNames = Object.fromEntries(s.docs.map((d) => [d.id, d.data().name])); paint(); },
    onErr('customers'),
  ));
  // Inbox reads (admin/steward only; quietly empty otherwise).
  unsubs.push(fs.onSnapshot(
    fs.query(fs.collection(db, '_rejected_writes'), fs.limit(100)),
    (s) => { rejectedWrites = grab(s); delete collErr.rejected; paint(); }, onErr('rejected'),
  ));
  unsubs.push(fs.onSnapshot(
    fs.query(fs.collection(db, 'kpi_snapshots'), fs.limit(1)),
    (s) => { kpiSnapshot = s.docs[0]?.data() || null; delete collErr.kpi; paint(); }, onErr('kpi'),
  ));
}

// ---- helpers over the listener buckets ----

function bucketFor(catId) {
  const cat = CATEGORIES.find((c) => c.id === catId) || CATEGORIES[0];
  return [...(docsByColl[cat.coll] || [])].sort((a, b) => tsMs(b) - tsMs(a));
}

function docByPath(path) {
  for (const coll of Object.keys(docsByColl)) {
    const hit = (docsByColl[coll] || []).find((d) => d.__path === path);
    if (hit) return hit;
  }
  return null;
}

function canEditType(type) {
  if (claims.is_admin) return true;
  if (claims.is_steward && type === 'notes') return true;   // rules: steward may update notes only
  return false;
}

// ---- write path ----

async function saveEdit() {
  if (!modal || !session) return;
  const before = docByPath(modal.path);
  if (!before) { formErr = 'record no longer present'; return paint(); }
  const values = {};
  for (const f of editableFields(modal.type) || []) {
    const el = document.getElementById(`edF_${f.key}`);
    if (el) values[f.key] = el.value;
  }
  const reason = document.getElementById('edReason')?.value || '';
  const reasonText = document.getElementById('edReasonText')?.value || '';
  const evidence = document.getElementById('edEvidence')?.value || '';

  const built = buildEditPayload({
    path: modal.path, before, values, reason, reasonText, evidence,
    uid: session.auth.currentUser?.uid, now: Date.now(),
  });
  if (!built.ok) { formErr = built.error; return paint(); }

  const { fs, db } = session;
  const ref = fs.doc(db, ...modal.path.split('/'));
  const updates = {
    ...built.updates,
    last_edited_at: fs.serverTimestamp(),
    revisions: fs.arrayUnion(built.revision),
  };
  try {
    await fs.updateDoc(ref, updates);
    modal = null; formErr = '';
    paint();   // the onSnapshot listener will also refresh the row
  } catch (e) {
    formErr = e?.code === 'permission-denied'
      ? 'Edit denied by the rules — is this session signed in as admin/steward?'
      : (e?.message || 'write failed');
    paint();
  }
}

// ---- window-exposed interaction handlers (template-onclick convention) ----

export function edSetView(v) {
  view = v;
  // Count on first open rather than rendering an empty grid: a zero the user
  // did not ask for reads as "nobody entered anything", which is the one
  // conclusion an un-run adoption view must never suggest.
  if (v === 'adoption' && adoptionNeedsLoad()) loadAdoption();
  paint();
}
export function edSelectCat(id) { activeCat = id; paint(); }
export function edOpenEdit(encPath) {
  const path = decodeURIComponent(encPath);
  const type = docTypeFromPath(path);
  if (!editableFields(type)) return;
  modal = { path, type, mode: 'edit' }; formErr = ''; paint();
}
export function edOpenHistory(encPath) {
  const path = decodeURIComponent(encPath);
  modal = { path, type: docTypeFromPath(path), mode: 'history' }; paint();
}
export function edCloseModal() { modal = null; formErr = ''; paint(); }
export function edReasonChange() {
  const v = document.getElementById('edReason')?.value;
  const row = document.getElementById('edReasonTextRow');
  if (row) row.style.display = v === 'other' ? 'block' : 'none';
}
export function edSaveEdit() { saveEdit(); }

// ---- paint ----

function paint() {
  const el = $root();
  if (!el) return;

  if (bootState === 'booting' || bootState === 'idle') {
    el.innerHTML = `<div class="lv-state">Connecting to Firestore…</div>`; return;
  }
  if (bootState === 'no-config') {
    el.innerHTML = `<div class="lv-state">No Firebase config for this environment.</div>`; return;
  }
  if (bootState === 'error') {
    el.innerHTML = `<div class="lv-state">Firebase failed to load (offline?). Re-open this tab to retry.</div>`; return;
  }
  const user = session?.auth?.currentUser;
  if (!user) {
    el.innerHTML = `<div class="lv-state">
      <b>Not signed in.</b>
      <p>Editing and the steward inboxes need an admin/steward session. Run the
      <code>firebase-admin</code> workflow's <code>mint-token</code> action
      (uid <code>rishabh</code>, admin) and open this page with the printed
      <code>#token=…</code> fragment appended.</p>
    </div>`;
    return;
  }

  const role = claims.is_admin ? 'admin' : claims.is_steward ? 'steward' : 'viewer';
  const conflictCount = rejectedWrites.length;
  el.innerHTML = `
    <div class="lv-signed">Signed in as <b>${esc(user.uid)}</b> · ${role} · staging</div>
    <div class="ed-views">
      <button class="ed-viewbtn ${view === 'records' ? 'active' : ''}" onclick="edSetView('records')">Records</button>
      <button class="ed-viewbtn ${view === 'inboxes' ? 'active' : ''}" onclick="edSetView('inboxes')">
        Inboxes${conflictCount ? ` <span class="ed-badge">${conflictCount}</span>` : ''}
      </button>
      <button class="ed-viewbtn ${view === 'adoption' ? 'active' : ''}" onclick="edSetView('adoption')">Adoption</button>
    </div>
    ${view === 'records' ? renderRecords() : view === 'adoption' ? renderAdoption(claims) : renderInboxes()}
    ${modal ? renderModal() : ''}`;
}

function renderRecords() {
  const chips = CATEGORIES.map((c) =>
    `<button class="ed-chip ${c.id === activeCat ? 'active' : ''}" onclick="edSelectCat('${c.id}')">${esc(c.label)}</button>`).join('');
  const cat = CATEGORIES.find((c) => c.id === activeCat) || CATEGORIES[0];
  const err = collErr[cat.coll];
  const rows = bucketFor(activeCat);
  const fmt = makeStreamFormatters(custName)[cat.coll];

  let body;
  if (err) {
    body = `<div class="lv-state">This category needs the 12 Jun collection-group rules deploy (<code>${esc(err)}</code>) — empty until <code>deploy-rules</code> is green.</div>`;
  } else if (!rows.length) {
    body = `<div class="lv-state">No ${esc(cat.label.toLowerCase())} records yet.</div>`;
  } else {
    body = `<div class="ed-table">${rows.map((d) => recordRow(d, fmt)).join('')}</div>`;
  }
  return `<div class="ed-chips">${chips}</div>${body}`;
}

function recordRow(d, fmt) {
  const type = docTypeFromPath(d.__path);
  const editable = !!editableFields(type) && canEditType(type);
  const revs = Array.isArray(d.revisions) ? d.revisions.length : 0;
  const text = fmt ? fmt.fmt(d) : (d.summary || d.id);
  // __path is system-generated (idempotency keys / sep-{id}), but encode it for
  // the inline onclick JS-string anyway — esc() leaves quotes intact, and an
  // unescaped quote here was the exact sink class the 12-Jun review caught.
  const ep = encodeURIComponent(d.__path);
  return `
    <div class="ed-row">
      <span class="lv-row-time">${fmtTime(tsMs(d))}</span>
      <span class="ed-row-text">${esc(text)}${d.last_edit_reason ? ` <span class="ed-tag">edited</span>` : ''}</span>
      <span class="ed-row-actions">
        ${revs ? `<button class="ed-act" onclick="edOpenHistory('${ep}')">History (${revs})</button>` : ''}
        ${editable ? `<button class="ed-act ed-act-edit" onclick="edOpenEdit('${ep}')">Edit</button>`
                   : `<span class="ed-act-disabled" title="${claims.is_admin || claims.is_steward ? 'not editable from this surface' : 'admin/steward only'}">—</span>`}
      </span>
    </div>`;
}

function renderModal() {
  const d = docByPath(modal.path);
  if (!d) return '';
  if (modal.mode === 'history') return renderHistoryModal(d);
  return renderEditModal(d);
}

function renderEditModal(d) {
  const fields = editableFields(modal.type) || [];
  const fieldHtml = fields.map((f) => {
    const cur = d[f.key] != null ? d[f.key] : '';
    if (f.kind === 'select') {
      const curStr = cur === '' ? '' : String(cur);
      const opts = f.options.map((o) => `<option value="${escAttr(o)}" ${curStr === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
      // Surface an out-of-enum stored value (e.g. a legacy route) as its own
      // selected option instead of silently falling back to the blank "—" —
      // otherwise the current value is invisible and reads as "no change".
      const orphan = (curStr && !f.options.includes(curStr))
        ? `<option value="${escAttr(curStr)}" selected>${esc(curStr)} (current)</option>` : '';
      return `<div class="form-group"><label>${esc(f.label)}</label><select id="edF_${f.key}"><option value="">—</option>${orphan}${opts}</select></div>`;
    }
    const t = f.kind === 'number' ? 'number' : 'text';
    return `<div class="form-group"><label>${esc(f.label)}</label><input id="edF_${f.key}" type="${t}" value="${escAttr(cur)}" inputmode="${f.kind === 'number' ? 'decimal' : 'text'}"></div>`;
  }).join('');

  const reasonOpts = REASON_ENUM.map((r) => `<option value="${r.value}">${esc(r.label)}</option>`).join('');
  return `
    <div class="inv-modal-overlay" onclick="if(event.target===this)edCloseModal()">
      <div class="inv-modal ed-modal">
        <div class="ed-modal-h">Edit ${esc(modal.type)} <button class="ed-x" onclick="edCloseModal()">✕</button></div>
        <div class="ed-modal-sub">${esc(d.__path)}</div>
        ${fieldHtml}
        <div class="form-group">
          <label>Reason</label>
          <select id="edReason" onchange="edReasonChange()">
            <option value="">— choose —</option>${reasonOpts}
          </select>
        </div>
        <div class="form-group" id="edReasonTextRow" style="display:none">
          <label>Describe (other)</label>
          <input id="edReasonText" type="text" placeholder="what was wrong">
        </div>
        <div class="form-group">
          <label>Evidence ref (optional)</label>
          <input id="edEvidence" type="text" placeholder="note id / photo url / conversation">
        </div>
        ${formErr ? `<div class="lv-warn lv-warn-red">${esc(formErr)}</div>` : ''}
        <div class="ed-modal-actions">
          <button class="ed-btn-ghost" onclick="edCloseModal()">Cancel</button>
          <button class="ed-btn-primary" onclick="edSaveEdit()">Save edit</button>
        </div>
        <div class="ed-modal-foot">Appends to this record's revision history; never overwrites the original silently.</div>
      </div>
    </div>`;
}

function renderHistoryModal(d) {
  const revs = Array.isArray(d.revisions) ? [...d.revisions].sort((a, b) => (b.at || 0) - (a.at || 0)) : [];
  const list = revs.length
    ? revs.map((r) => `<div class="ed-rev">
        <div class="ed-rev-time">${fmtTime(r.at)} · ${esc(r.by || '?')}</div>
        <div class="ed-rev-body">${esc(summarizeRevision(r))}</div>
        ${r.evidence ? `<div class="ed-rev-ev">evidence: ${esc(r.evidence)}</div>` : ''}
      </div>`).join('')
    : `<div class="lv-state">No edits recorded for this entry.</div>`;
  return `
    <div class="inv-modal-overlay" onclick="if(event.target===this)edCloseModal()">
      <div class="inv-modal ed-modal">
        <div class="ed-modal-h">History <button class="ed-x" onclick="edCloseModal()">✕</button></div>
        <div class="ed-modal-sub">${esc(d.__path)}</div>
        ${list}
        <div class="ed-modal-foot">On-doc revision trail. The audit-event Cloud Function mirrors these to <code>audit_events</code> once deployed.</div>
      </div>
    </div>`;
}

function renderInboxes() {
  return `
    ${renderConflicts()}
    ${renderAnomalies()}
    ${renderKpi()}`;
}

function renderConflicts() {
  if (collErr.rejected) {
    return panel('Pending conflicts', `<div class="lv-state">Readable by admin/steward only (<code>${esc(collErr.rejected)}</code>).</div>`);
  }
  if (!rejectedWrites.length) {
    return panel('Pending conflicts', `<div class="lv-state">No rejected writes. LWW-overwritten edits + rule rejections surface here once the conflict-capture Cloud Function writes <code>_rejected_writes</code>.</div>`);
  }
  const rows = rejectedWrites
    .sort((a, b) => tsMs(b) - tsMs(a))
    .map((r) => `<div class="ed-row">
      <span class="lv-row-time">${fmtTime(tsMs(r))}</span>
      <span class="ed-row-text">${esc(r.entity_type || r.target_path || r.id)} · ${esc(r.reason || r.error || 'rejected')}</span>
    </div>`).join('');
  return panel('Pending conflicts', `<div class="ed-table">${rows}</div>
    <div class="ed-modal-foot">Read-only this build — retry / discard / annotate write back to a CF-only collection (deferred with the steward-disposition CF).</div>`);
}

function renderAnomalies() {
  return panel('Anomaly inbox', `<div class="lv-state">Awaiting the anomaly-detector Cloud Function (Phase 8, ~11 categories per <code>ANOMALY_INBOX.md</code>). No client read path until it lands.</div>`);
}

function renderKpi() {
  if (!kpiSnapshot) {
    return panel('Steward KPI (weekly)', `<div class="lv-state">Four data-integrity metrics populate as the KPI aggregator CF accrues <code>kpi_snapshots</code>: anomaly aging · edit-with-reason rate · dispute reopens · anomaly precision.</div>`);
  }
  const m = kpiSnapshot;
  return panel('Steward KPI (weekly)', `<div class="lv-kpis">
    ${kpiCard(m.anomaly_aging_median, 'anomaly aging')}
    ${kpiCard(m.edit_reason_rate, 'edits / 1000')}
    ${kpiCard(m.dispute_reopen_pct, 'dispute reopens')}
    ${kpiCard(m.anomaly_precision_pct, 'anomaly precision')}
  </div>`);
}

function kpiCard(v, label) {
  return `<div class="lv-kpi"><div class="lv-kpi-v">${v != null ? esc(String(v)) : '—'}</div><div class="lv-kpi-l">${esc(label)}</div></div>`;
}

function panel(title, inner) {
  return `<div class="ed-panel"><div class="lv-stream-h">${esc(title)}</div>${inner}</div>`;
}
