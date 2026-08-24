// Adoption view — the rollout KPI surface (ADOPTION_PLAN.md Week 0 acceptance:
// "Adoption rate KPI computed weekly from paper reconciliation … calculated by
// handler in dashboard 'Adoption' view (steward-exclusive)").
//
// Rendered inside the Edit tab because that is already the steward surface:
// it resolves custom claims, and adoption is a data-stewardship metric, not a
// floor read. Steward-exclusive per the plan; a viewer session is told so.
//
// Two halves, deliberately not blurred:
//   · DIGITAL (numerator) — counted from Firestore, person-authored only.
//   · PAPER   (denominator) — typed in by the steward from the paper backup
//     forms' "✓ In app" ticks. There is no Firestore write rule for an
//     adoption count and inventing one would need the IAM-gated rules deploy,
//     so paper counts live in this device's localStorage. Single-steward,
//     single-device is exactly the Week-0 shape; the limitation is stated on
//     the card rather than hidden.
//
// One-shot getDocs per collection, not listeners: a week of production is far
// past the 50-doc stream the Live/Edit tabs subscribe to, and adoption is an
// end-of-shift reconciliation ritual, not a live number.

import { esc, escAttr } from '../shared/utils/format.js';
import { eventMillis } from '../shared/utils/event-time.js';
import {
  ADOPTION_FORMS, DAY_LABELS, STEADY_TARGET,
  isoWeekStart, isoWeekKey, addWeeks, weekEnd,
  countByFormDay, summarizeWeek,
  PAPER_STORE_KEY, readPaperStore, setPaperCount, paperForWeek,
} from './adoption-model.js';

// Range-queried collections are exact. Collection groups are fetched bare (a
// range filter on a collection GROUP needs an explicit CG index, which needs
// the IAM-gated deploy) and filtered client-side, so they carry a cap.
const RANGE_LIMIT = 2000;
const GROUP_LIMIT = 3000;

let weekStart = isoWeekStart();
let docsByForm = {};
let loadState = 'idle';       // idle | loading | ready | error
let loadErr = '';
let capped = [];              // form ids whose fetch hit its limit
let denied = [];              // form ids the rules refused
let store = {};
let repaint = () => {};
let getSession = () => null;

// The Edit tab owns the Firebase session and the paint loop; adoption borrows
// both through getters so its window-exposed handlers can stay argument-free
// (the template-onclick convention this codebase already uses).
export function initAdoption(paintFn, sessionGetter) {
  repaint = paintFn;
  getSession = sessionGetter;
  store = loadStore();
  // Mounting the view counts nothing. Reset the measurement state so a fresh
  // mount can never inherit a previous session's documents behind a 'ready'
  // flag — the tab mounts once today, but the invariant is what matters.
  docsByForm = {};
  loadState = 'idle';
  capped = [];
  denied = [];
  loadErr = '';
}

function loadStore() {
  try { return readPaperStore(globalThis.localStorage?.getItem(PAPER_STORE_KEY)); } catch { return {}; }
}
function saveStore() {
  try { globalThis.localStorage?.setItem(PAPER_STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
}

// --- fetch ---

export async function loadAdoption() {
  const session = getSession();
  if (!session) {
    // Nothing counted, and nothing may be claimed as counted: a week change
    // with no session must not leave the previous week's docs sitting behind a
    // 'ready' flag, where they would be re-bucketed into the new week and read
    // as a measurement.
    docsByForm = {};
    loadState = 'idle';
    repaint();
    return;
  }
  loadState = 'loading'; loadErr = ''; capped = []; denied = []; repaint();
  const { db, fs } = session;
  const start = fs.Timestamp.fromMillis(weekStart.getTime());
  const end = fs.Timestamp.fromMillis(weekEnd(weekStart).getTime());
  const next = {};

  await Promise.all(ADOPTION_FORMS.map(async (f) => {
    try {
      const q = f.group
        // Bare CG read — same shape the Live viewer already proves against the
        // deployed rules. Week filtering happens in countByFormDay.
        ? fs.query(fs.collectionGroup(db, f.coll), fs.limit(GROUP_LIMIT))
        // Single-field range on created_at: auto-indexed at collection scope,
        // so this is exact and needs no index deploy.
        : fs.query(
            fs.collection(db, f.coll),
            fs.where('created_at', '>=', start),
            fs.where('created_at', '<', end),
            fs.limit(RANGE_LIMIT),
          );
      const snap = await fs.getDocs(q);
      next[f.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (snap.docs.length >= (f.group ? GROUP_LIMIT : RANGE_LIMIT)) capped.push(f.id);
    } catch (e) {
      next[f.id] = [];
      if (e?.code === 'permission-denied') denied.push(f.id);
      else loadErr = e?.code || e?.message || 'read failed';
    }
  }));

  docsByForm = next;
  loadState = 'ready';
  repaint();
}

// --- window-exposed handlers (template-onclick convention, as in edit.js) ---

export function adShiftWeek(n) { weekStart = addWeeks(weekStart, n); loadAdoption(); }
export function adThisWeek() { weekStart = isoWeekStart(); loadAdoption(); }
export function adRefresh() { loadAdoption(); }
export function adSetPaper(el) {
  const formId = el?.dataset?.form;
  const day = Number(el?.dataset?.day);
  store = setPaperCount(store, isoWeekKey(weekStart), formId, day, el?.value);
  saveStore();
  repaint();
}

// --- render ---

// True once a week has been fetched — the Edit tab uses it to load on first
// open of the view instead of showing an empty grid that looks like zero.
export function adoptionNeedsLoad() { return loadState === 'idle'; }

export function renderAdoption(claims) {
  if (!(claims?.is_admin || claims?.is_steward)) {
    return `<div class="lv-state"><b>Steward-exclusive.</b>
      <p>The adoption KPI is the handler-steward's surface (ADOPTION_PLAN Week 0).
      This session has neither <code>is_steward</code> nor <code>is_admin</code>.</p></div>`;
  }
  const wk = isoWeekKey(weekStart);
  const paper = paperForWeek(store, wk);
  // Until a fetch has actually run, digital is UNKNOWN — not zero. Rendering
  // rate(0, paperTotal) here would put a red 0% next to a week nobody counted,
  // which is the single conclusion this view must never assert by accident.
  const counted = loadState === 'ready';
  const counts = countByFormDay(docsByForm, weekStart, eventMillis);
  const s = summarizeWeek(counts, paper, STEADY_TARGET);
  const isThisWeek = weekStart.getTime() === isoWeekStart().getTime();

  return `
    <div class="ad-bar">
      <div class="ad-week">
        <button class="ed-act" onclick="adShiftWeek(-1)" title="Previous week">◀</button>
        <span class="ad-week-k">${esc(wk)}</span>
        <button class="ed-act" onclick="adShiftWeek(1)" ${isThisWeek ? 'disabled' : ''} title="Next week">▶</button>
        <span class="ad-week-d">${esc(fmtRange(weekStart))}</span>
      </div>
      <div>
        ${isThisWeek ? '' : `<button class="ed-act" onclick="adThisWeek()">This week</button>`}
        <button class="ed-act" onclick="adRefresh()">${loadState === 'loading' ? 'Loading…' : 'Refresh'}</button>
      </div>
    </div>

    ${headline(s, counted)}
    ${table(s, counted)}
    ${notices(s, counted)}`;
}

function fmtRange(ws) {
  const end = new Date(weekEnd(ws).getTime() - 1);
  const f = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${f(ws)} – ${f(end)}`;
}

const pct = (r) => (r === null ? '—' : `${Math.round(r * 100)}%`);

function headline(s, counted) {
  const cls = counted ? { ok: 'ad-ok', near: 'ad-near', below: 'ad-below', over: 'ad-over', unmeasured: '' }[s.status] : '';
  return `
    <div class="ad-head ${cls}">
      <div class="ad-head-v">${counted ? pct(s.rate) : '—'}</div>
      <div class="ad-head-l">
        <b>Adoption rate</b> · ${counted ? `${s.digitalTotal} digital` : 'not counted yet'} / ${s.expectedTotal || '—'} on paper
        <span class="ad-cov">${counted
          ? `measured on ${s.formsMeasured} of ${s.formsTotal} forms · target ${Math.round(STEADY_TARGET * 100)}%`
          : 'press Refresh to count this week from Firestore'}</span>
      </div>
    </div>`;
}

function table(s, counted) {
  // Form, then WEEK, then the seven days. Nine forms × seven days cannot fit a
  // phone, so the table scrolls — and whatever scrolls away must not be the
  // number the view exists to show.
  const head = `<tr><th class="ad-f">Form</th><th class="ad-r">Week</th>${DAY_LABELS.map((d) => `<th>${d}</th>`).join('')}</tr>`;
  const rows = s.rows.map((r) => {
    const cells = DAY_LABELS.map((_, i) => {
      const d = r.digital[i] || 0;
      const p = r.expected[i];
      return `<td>
        <span class="ad-dig ${counted && d ? '' : 'ad-zero'}">${counted ? d : '—'}</span>
        <input class="ad-paper" type="number" min="0" inputmode="numeric"
               data-form="${escAttr(r.id)}" data-day="${i}"
               value="${p === '' || p == null ? '' : escAttr(String(p))}"
               placeholder="paper" onchange="adSetPaper(this)">
      </td>`;
    }).join('');
    const cls = counted ? { ok: 'ad-ok', near: 'ad-near', below: 'ad-below', over: 'ad-over', unmeasured: '' }[r.status] : '';
    const flag = denied.includes(r.id) ? ' <span class="ed-tag">denied</span>'
      : capped.includes(r.id) ? ' <span class="ed-tag">capped</span>' : '';
    return `<tr>
      <th class="ad-f">${esc(r.label)}${flag}</th>
      <td class="ad-r ${cls}"><b>${counted ? pct(r.rate) : '—'}</b><span class="ad-sub">${counted ? r.digitalTotal : '—'}/${r.expectedTotal || '—'}</span></td>
      ${cells}
    </tr>`;
  }).join('');
  return `<div class="ad-wrap"><table class="ad-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

function notices(s, counted) {
  const out = [];
  if (!counted) {
    out.push(['', loadState === 'loading'
      ? 'Counting this week from Firestore…'
      : 'Not counted yet. Press Refresh — the digital column is UNKNOWN until then, which is why it reads — and not 0.']);
  }
  if (loadErr) out.push(['lv-warn-red', `Firestore read failed: ${loadErr}`]);
  if (denied.length) {
    out.push(['', `Rules refused ${denied.length} collection${denied.length > 1 ? 's' : ''} (${denied.join(', ')}) — the 12 Jun collection-group read rules are still IAM-gated. Those rows read 0 digital, which is a MISSING measurement, not a zero.`]);
  }
  if (capped.length) {
    out.push(['lv-warn-amber', `Capped at ${GROUP_LIMIT} docs: ${capped.join(', ')}. Collection-group reads cannot be week-filtered server-side without a CG index, so these counts may be under-reported. Add the index before the corpus outgrows the cap.`]);
  }
  if (counted && s.expectedTotal === 0) {
    out.push(['', 'No paper counts entered yet. Count the ✓ In app ticks on each paper sheet at end of shift and type them into the day columns — the rate is blank until then, deliberately: a denominator of zero is not 100%.']);
  }
  if (counted && s.status === 'over') {
    out.push(['lv-warn-amber', 'More digital entries than paper. Either a paper sheet went uncounted or an entry was submitted twice — reconcile before recording the week.']);
  }
  out.push(['', 'Paper counts are stored on THIS device only (localStorage). Enter them on the machine the steward reconciles from.']);
  return `<div class="lv-warnings">${out.map(([c, t]) => `<div class="lv-warn ${c}">${esc(t)}</div>`).join('')}</div>`;
}
