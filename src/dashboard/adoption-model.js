// Adoption model — the arithmetic behind the dashboard's Adoption view.
//
// ADOPTION_PLAN.md locks the rollout KPI as ADOPTION RATE, explicitly not
// entries-per-day: "(digital entries / expected entries) × 100%, computed
// weekly from paper reconciliation". Expected entries come from the paper
// backup forms (dist/paper-forms.html) that run in parallel through Weeks 1–4,
// so the denominator is a HUMAN COUNT and cannot be derived from Firestore.
// That asymmetry is the whole design: the numerator is measured, the
// denominator is entered, and the view must never blur which is which.
//
// Pure: no Firestore, no DOM, no storage. The tab supplies the documents and
// owns persistence; everything here unit-tests in milliseconds.

// Form → the collection its handler writes land in (transport.js MAPPERS).
// `group: true` marks a subcollection read as a collection group.
export const ADOPTION_FORMS = [
  { id: 'production', label: 'Production', coll: 'production_entries' },
  { id: 'job_receipt', label: 'Job receipt', coll: 'jobs' },
  { id: 'dft', label: 'DFT', coll: 'dft_measurements' },
  { id: 'dispatch', label: 'Dispatch', coll: 'dispatch_events' },
  { id: 'stock_refill', label: 'Stock refill', coll: 'receipts', group: true },
  { id: 'stock_deplete', label: 'Stock used', coll: 'depletions', group: true },
  { id: 'machine_state', label: 'Machine state', coll: 'state_transitions', group: true },
  { id: 'check_in', label: 'Check in/out', coll: 'shifts', group: true },
  { id: 'note', label: 'Note', coll: 'notes' },
];

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ADOPTION_PLAN Week 1 ramp, by day-of-rollout. Held as the bar the view
// measures against — a rate with no target next to it is a number nobody
// can act on.
export const WEEK1_TARGETS = [
  { day: 1, target: 0.60 },
  { day: 5, target: 0.80 },
  { day: 7, target: 0.95 },
];

// The steady-state bar once a form is past its ramp week (Week 3 Day 7 /
// Week 4 sunset both sit at 95%).
export const STEADY_TARGET = 0.95;

// --- week arithmetic (ISO, Monday-start — the soma-internal convention) ---

export function isoWeekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun … 6=Sat. Monday-start means Sunday is day 7, not day 0.
  const shift = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - shift);
  return x;
}

export function addWeeks(weekStart, n) {
  const x = new Date(weekStart);
  x.setDate(x.getDate() + n * 7);
  return x;
}

export function weekEnd(weekStart) {
  return addWeeks(weekStart, 1);
}

// ISO-8601 week key, e.g. '2026-W35'. The ISO year can differ from the
// calendar year in the first/last days of a year, which is why the year is
// taken from the Thursday of the week rather than from weekStart itself.
export function isoWeekKey(weekStart) {
  const thu = new Date(weekStart);
  thu.setDate(thu.getDate() + 3);
  const jan1 = new Date(thu.getFullYear(), 0, 1);
  const week = Math.floor((thu - jan1) / 86400000 / 7) + 1;
  return `${thu.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// 0..6 for a timestamp inside the week; -1 outside it.
export function dayIndex(ms, weekStart) {
  const start = weekStart.getTime();
  if (!(ms >= start)) return -1;
  const end = weekEnd(weekStart).getTime();
  if (ms >= end) return -1;
  // Date arithmetic, not ms/86400000: a DST shift inside the week would put
  // the later days off by an hour and drop Sunday entries into Saturday.
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - weekStart) / 86400000);
}

// --- authorship ---

// A digital entry counts toward adoption only if a PERSON made it. The
// invoicing importer writes 'system:import' and the Stage E aggregators
// attribute derived writes to the system too — counting those would inflate
// the numerator with rows no handler ever typed.
export function isPersonAuthored(doc) {
  const a = doc?.author_user_id;
  return typeof a === 'string' && a.length > 0 && !a.startsWith('system');
}

// --- counting ---

// docsByForm: { [formId]: [{ author_user_id, ...}] }, tsOf: doc → epoch ms.
// Returns { [formId]: number[7] } — one count per weekday.
export function countByFormDay(docsByForm, weekStart, tsOf) {
  const out = {};
  for (const f of ADOPTION_FORMS) {
    const days = [0, 0, 0, 0, 0, 0, 0];
    for (const doc of docsByForm[f.id] || []) {
      if (!isPersonAuthored(doc)) continue;
      const i = dayIndex(tsOf(doc), weekStart);
      if (i >= 0) days[i] += 1;
    }
    out[f.id] = days;
  }
  return out;
}

export const sum = (arr) => (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);

// --- rate ---

// null when there is no denominator. A rate needs a paper count; without one
// the honest answer is "not measured", never 0% (which reads as total failure)
// and never 100% (which reads as done).
export function rate(digital, expected) {
  const e = Number(expected);
  if (!Number.isFinite(e) || e <= 0) return null;
  return digital / e;
}

// Rates above 1 are real and are NOT clamped: they mean digital entries exist
// with no paper twin — a reconciliation finding (missed paper, or double
// entry) that clamping would hide.
export function statusFor(r, target = STEADY_TARGET) {
  if (r === null) return 'unmeasured';
  if (r > 1.02) return 'over';      // more digital than paper — investigate
  if (r >= target) return 'ok';
  if (r >= target - 0.15) return 'near';
  return 'below';
}

export function targetForRolloutDay(day) {
  let t = WEEK1_TARGETS[0].target;
  for (const row of WEEK1_TARGETS) if (day >= row.day) t = row.target;
  return t;
}

// Per-form + overall summary for one week.
// paper: { [formId]: number[7] } — blanks are '' / undefined, not 0.
export function summarizeWeek(counts, paper, target = STEADY_TARGET) {
  const rows = ADOPTION_FORMS.map((f) => {
    const digital = counts[f.id] || [0, 0, 0, 0, 0, 0, 0];
    const expected = paper[f.id] || [];
    const dTotal = sum(digital);
    const eTotal = sum(expected);
    const r = rate(dTotal, eTotal);
    return {
      id: f.id,
      label: f.label,
      digital,
      expected,
      digitalTotal: dTotal,
      expectedTotal: eTotal,
      rate: r,
      status: statusFor(r, target),
    };
  });
  const dAll = rows.reduce((s, r) => s + r.digitalTotal, 0);
  const eAll = rows.reduce((s, r) => s + r.expectedTotal, 0);
  const overall = rate(dAll, eAll);
  return {
    rows,
    digitalTotal: dAll,
    expectedTotal: eAll,
    rate: overall,
    status: statusFor(overall, target),
    // How much of the picture is actually measured. A 98% rate drawn from one
    // form out of nine is not the same number as one drawn from all nine, and
    // the view says so rather than letting it pass as complete.
    formsMeasured: rows.filter((r) => r.expectedTotal > 0).length,
    formsTotal: rows.length,
  };
}

// --- paper-count store (plain object; the tab persists it) ---

export const PAPER_STORE_KEY = 'sep_adoption_paper';

// { [weekKey]: { [formId]: number[7] } } — validated on read so a hand-edited
// or truncated localStorage blob can't throw inside paint().
export function readPaperStore(raw) {
  let parsed;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {}; }
  if (!parsed || typeof parsed !== 'object') return {};
  const out = {};
  for (const [wk, forms] of Object.entries(parsed)) {
    if (!forms || typeof forms !== 'object') continue;
    const clean = {};
    for (const f of ADOPTION_FORMS) {
      const arr = forms[f.id];
      if (!Array.isArray(arr)) continue;
      clean[f.id] = Array.from({ length: 7 }, (_, i) => {
        const n = Number(arr[i]);
        return Number.isFinite(n) && n >= 0 ? n : '';
      });
    }
    out[wk] = clean;
  }
  return out;
}

export function setPaperCount(store, weekKey, formId, dayIdx, value) {
  if (!ADOPTION_FORMS.some((f) => f.id === formId)) return store;
  if (!(dayIdx >= 0 && dayIdx < 7)) return store;
  const trimmed = String(value ?? '').trim();
  const n = trimmed === '' ? '' : Number(trimmed);
  if (n !== '' && (!Number.isFinite(n) || n < 0)) return store;
  const week = { ...(store[weekKey] || {}) };
  const row = Array.isArray(week[formId]) ? [...week[formId]] : ['', '', '', '', '', '', ''];
  row[dayIdx] = n;
  week[formId] = row;
  return { ...store, [weekKey]: week };
}

export function paperForWeek(store, weekKey) {
  return store[weekKey] || {};
}
