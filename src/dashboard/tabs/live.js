// Live tab — Stage F minimal viewer (DASHBOARD_VIEWER.md, alpha cut per
// the 12 Jun targets): activity stream + daily KPI strip + NIL/overdue
// warnings. The dashboard's write-companion view onto the staging
// Firestore the handler PWA writes to — proof the data is flowing,
// before the Konva floor view exists.
//
// Read surfaces only; no writes from this tab. Firebase loads through
// the same dynamic-import session boot as the handler (shared/firebase-
// session.js), so the SDK stays out of the main dashboard bundle and the
// tab degrades honestly when there is no config / no sign-in.
//
// Sign-in: mint-token workflow (uid rishabh, --admin) → open the
// dashboard URL with the printed #token=… fragment appended.

import { DEF_STOCK } from '../../shared/config/stock.js';

const READY_LOITER_MS = 12 * 3600 * 1000;   // Session 11: 12-hour Ready alarm
const SLA_MS = 24 * 3600 * 1000;            // received → 24h SLA
const STREAM_LIMIT = 50;

let session = null;        // { db, auth, fs, fbAuth } once booted
let bootState = 'idle';    // idle | booting | no-config | ready | error
let unsubs = [];
const COLLS = ['production_entries', 'jobs', 'dft_measurements', 'dispatch_events', 'notes'];
const docsByColl = {};     // coll → array of {id, ...data}
const collErr = {};        // coll → error code (e.g. CG reads pre-rules-deploy)
let inflightJobs = [];

const $root = () => document.getElementById('liveRoot');

export function renderLive() {
  if (!$root()) return;
  if (bootState === 'idle') { bootState = 'booting'; boot(); }
  paint();
}

async function boot() {
  try {
    const { bootFirebaseSession } = await import('../../shared/firebase-session.js');
    session = await bootFirebaseSession();
    if (!session) { bootState = 'no-config'; return paint(); }
    bootState = 'ready';
    session.fbAuth.onAuthStateChanged(session.auth, (user) => {
      stopListeners();
      if (user) startListeners();
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

  // Recent stream per top-level collection (created_at is auto-indexed).
  for (const coll of COLLS) {
    unsubs.push(fs.onSnapshot(
      fs.query(fs.collection(db, coll), fs.orderBy('created_at', 'desc'), fs.limit(STREAM_LIMIT)),
      (s) => { docsByColl[coll] = grab(s); delete collErr[coll]; paint(); },
      onErr(coll),
    ));
  }

  // Collection-group reads: check-ins (T-CH) + depletions (NIL alerts).
  // No orderBy — bare CG queries need no composite index; volumes are tiny
  // in alpha and we sort client-side by client_ts. Denied until the 12 Jun
  // CG-read rules deploy (IAM-gated) — surfaced inline, not fatal.
  unsubs.push(fs.onSnapshot(
    fs.query(fs.collectionGroup(db, 'shifts'), fs.limit(200)),
    (s) => { docsByColl.shifts = grab(s); delete collErr.shifts; paint(); },
    onErr('shifts'),
  ));
  unsubs.push(fs.onSnapshot(
    fs.query(fs.collectionGroup(db, 'depletions'), fs.limit(200)),
    (s) => { docsByColl.depletions = grab(s); delete collErr.depletions; paint(); },
    onErr('depletions'),
  ));

  // Jobs still on the floor (equality-only filter — no composite index).
  unsubs.push(fs.onSnapshot(
    fs.query(fs.collection(db, 'jobs'), fs.where('current_status', 'in', ['in-flight', 'ready']), fs.limit(200)),
    (s) => { inflightJobs = grab(s); delete collErr.inflight; paint(); },
    onErr('inflight'),
  ));
}

// --- derivations (pure over the listener arrays) ---

function tsMs(doc) {
  const t = doc.created_at;
  if (t && typeof t.toMillis === 'function') return t.toMillis();
  return typeof doc.client_ts === 'number' ? doc.client_ts : 0;
}

function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

function kpis() {
  const t0 = todayStart();
  const today = (coll) => (docsByColl[coll] || []).filter((d) => tsMs(d) >= t0);
  const prod = today('production_entries');
  const dft = today('dft_measurements');
  return {
    entries: prod.length,
    nos: prod.reduce((s, d) => s + (d.qty_pcs || 0), 0),
    kg: prod.reduce((s, d) => s + (d.qty_kg || 0), 0),
    jobsIn: today('jobs').length,
    dispatches: today('dispatch_events').length,
    dftPass: dft.filter((d) => d.outcome === 'pass').length,
    dftFail: dft.filter((d) => d.outcome !== 'pass').length,
    checkIns: (docsByColl.shifts || []).filter((d) => tsMs(d) >= t0).length,
  };
}

// Latest depletion per stock item; NIL when its level_after === 0.
function nilAlerts() {
  const latest = {};
  for (const d of docsByColl.depletions || []) {
    const sid = (d.__path || '').split('/')[1];
    if (!sid) continue;
    if (!latest[sid] || tsMs(d) > tsMs(latest[sid])) latest[sid] = d;
  }
  return Object.entries(latest)
    .filter(([, d]) => d.level_after === 0)
    .map(([sid, d]) => ({
      name: DEF_STOCK.find((s) => s.id === sid)?.name || sid,
      since: tsMs(d),
    }));
}

function overdueJobs() {
  const now = Date.now();
  return inflightJobs
    .map((j) => ({ ...j, age: now - tsMs(j) }))
    .filter((j) => (j.current_status === 'ready' && j.age > READY_LOITER_MS)
                || (j.current_status === 'in-flight' && j.age > SLA_MS))
    .sort((a, b) => b.age - a.age)
    .slice(0, 20);
}

function streamRows() {
  const label = {
    production_entries: ['🏭', (d) => `${d.machine_id || '?'} · ${d.qty_pcs ? d.qty_pcs + ' NOS' : (d.qty_kg || 0) + ' kg'}${d.rounds ? ` (${d.rounds}×${d.round_size || '?'})` : ''} · ${d.worker_id || ''}`],
    jobs: ['📋', (d) => `Job in · ${d.customer_id || '?'}${d.challan_no ? ` · Ch ${d.challan_no}` : ''} · ${d.received_kg ? d.received_kg + ' kg' : (d.received_pcs || 0) + ' NOS'}`],
    dft_measurements: ['🔬', (d) => `DFT ${d.micron_value} µm · ${d.outcome}`],
    dispatch_events: ['🚚', (d) => `Dispatch · ${d.job_id || ''}${d.weight_kg ? ` · ${d.weight_kg} kg` : ''}`],
    notes: ['📝', (d) => `${d.priority === 'urgent' ? '🚨 ' : ''}${d.kind}: ${d.summary || ''}`],
    shifts: ['⏱', (d) => `${(d.__path || '').split('/')[1] || '?'} ${d.direction === 'in' ? '→ in' : '→ out'}${d.slot ? ` · ${d.slot}` : ''}`],
    depletions: ['📤', (d) => `${(d.__path || '').split('/')[1] || '?'} −${d.qty_depleted}${d.level_after != null ? ` (left: ${d.level_after})` : ''}`],
  };
  const rows = [];
  for (const [coll, [icon, fmt]] of Object.entries(label)) {
    for (const d of docsByColl[coll] || []) {
      rows.push({ ts: tsMs(d), icon, text: fmt(d), author: d.author_user_id || '' });
    }
  }
  return rows.sort((a, b) => b.ts - a.ts).slice(0, STREAM_LIMIT);
}

// --- paint ---

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function fmtAge(ms) {
  const h = Math.floor(ms / 3600000);
  return h >= 48 ? `${Math.floor(h / 24)}d` : `${h}h`;
}

function paint() {
  const el = $root();
  if (!el) return;

  if (bootState === 'booting' || bootState === 'idle') {
    el.innerHTML = `<div class="lv-state">Connecting to Firestore…</div>`;
    return;
  }
  if (bootState === 'no-config') {
    el.innerHTML = `<div class="lv-state">No Firebase config for this environment.</div>`;
    return;
  }
  if (bootState === 'error') {
    el.innerHTML = `<div class="lv-state">Firebase failed to load (offline?). Re-open this tab to retry.</div>`;
    return;
  }
  const user = session?.auth?.currentUser;
  if (!user) {
    el.innerHTML = `<div class="lv-state">
      <b>Not signed in.</b>
      <p>Run the <code>firebase-admin</code> workflow's <code>mint-token</code> action
      (uid <code>rishabh</code>, admin) and open this page with the printed
      <code>#token=…</code> fragment appended to the URL. The session persists after the first sign-in.</p>
    </div>`;
    return;
  }

  const k = kpis();
  const nils = nilAlerts();
  const overdue = overdueJobs();
  const rows = streamRows();
  const cgBlocked = collErr.shifts || collErr.depletions;

  el.innerHTML = `
    <div class="lv-signed">Signed in as <b>${esc(user.uid)}</b> · staging</div>

    <div class="lv-kpis">
      ${kpi(k.entries, 'entries today')}
      ${kpi(k.nos.toLocaleString(), 'NOS plated')}
      ${kpi(k.kg.toLocaleString(), 'kg plated')}
      ${kpi(k.jobsIn, 'jobs in')}
      ${kpi(k.dispatches, 'dispatches')}
      ${kpi(`${k.dftPass}/${k.dftPass + k.dftFail}`, 'DFT pass')}
      ${kpi(k.checkIns, 'check-ins')}
    </div>

    <div class="lv-warnings">
      ${nils.map((n) => `<div class="lv-warn lv-warn-red">⚠ NIL stock: <b>${esc(n.name)}</b> (since ${fmtTime(n.since)})</div>`).join('')}
      ${overdue.map((j) => `<div class="lv-warn ${j.current_status === 'ready' ? 'lv-warn-red' : 'lv-warn-amber'}">
          ⏰ ${j.current_status === 'ready' ? 'Ready, not dispatched' : 'Over SLA'}:
          <b>${esc(j.id)}</b> · ${esc(j.customer_id || '')} · ${fmtAge(j.age)}</div>`).join('')}
      ${cgBlocked ? `<div class="lv-warn">ℹ Check-in stream + NIL alerts need the 12 Jun rules deploy (IAM-gated) — sections stay empty until <code>deploy-rules</code> is green.</div>` : ''}
      ${!nils.length && !overdue.length && !cgBlocked ? `<div class="lv-warn lv-warn-ok">✓ No NIL stock, nothing overdue.</div>` : ''}
    </div>

    <div class="lv-stream-h">Activity</div>
    <div class="lv-stream">
      ${rows.length ? rows.map((r) => `
        <div class="lv-row">
          <span class="lv-row-time">${fmtTime(r.ts)}</span>
          <span class="lv-row-icon">${r.icon}</span>
          <span class="lv-row-text">${esc(r.text)}</span>
          <span class="lv-row-who">${esc(r.author)}</span>
        </div>`).join('')
      : `<div class="lv-state">No activity yet — entries from the SEP Handler app appear here live.</div>`}
    </div>`;
}

function kpi(value, label) {
  return `<div class="lv-kpi"><div class="lv-kpi-v">${value}</div><div class="lv-kpi-l">${label}</div></div>`;
}
