// Paper backup forms — ADOPTION_PLAN.md Week 0, escape hatch #1.
//
// "Laminated paper forms in every area (4G + wifi both down → handler batch-
// enters from paper later)" and, during the parallel-paper run of Weeks 1–4,
// the authoritative record the digital entries are reconciled against.
//
// The whole point is that these are DERIVED, not drawn. A paper form that
// drifts from the app is worse than no paper form: the handler copies fields
// that no longer exist and misses ones that do, and every reconciliation after
// that measures the drift instead of the adoption. So the spec below is built
// from FORMS (the same registry the PWA renders) and DICT (the same Devanagari
// / English strings), and a unit test fails CI when a field gains a label the
// paper cannot render.
//
// Not imported by handler/main.js — it is build-time only, so nothing here
// reaches either web bundle. scripts/build-paper-forms.mjs writes the printable
// sheet; ADOPTION_PLAN's "field positions match PWA layout" is satisfied by
// construction, because the field ORDER is the registry's own.

import { FORMS } from './forms-registry.js';
import { DICT } from './i18n.js';

// A field whose `required` is a FUNCTION is conditionally required — the PWA
// evaluates it against live form state, which paper cannot do. Each one needs a
// human sentence instead. The coupling test asserts this map covers every
// function-required field in the registry, so adding one to the app without a
// paper sentence fails CI rather than printing a silently-wrong form.
export const CONDITIONAL_HINTS = {
  'production.quantity': {
    hi: 'राउंड × हर राउंड लिखा हो तो छोड़ दें',
    en: 'Skip if rounds × per-round count is filled',
  },
  'job_receipt.weight': {
    hi: 'सिर्फ़ पीस (NOS) का चालान हो तो छोड़ दें',
    en: 'Skip if this is a pieces-only (NOS) challan',
  },
};

// High-volume forms get a row-per-entry grid; the rest get repeated blocks with
// full labels and tick boxes. Production runs ~300/day and check-in ~40/day
// (20 workers, in + out) — at that rate a block layout would burn a sheet an
// hour. The others are low enough that legibility beats density.
export const GRID_FORMS = new Set(['production', 'check_in']);

// Rows / blocks per A4 sheet. Grid counts are measured against the printable
// height (A4 less 9mm margins) by the e2e print test, not guessed; block
// counts fall out of field count.
const GRID_ROWS = { production: 24, check_in: 24 };

export function label(key) {
  const entry = DICT[key];
  if (!entry) return { hi: key, en: key, missing: true };
  return { hi: entry.hi, en: entry.en };
}

function blocksPerSheet(fieldCount) {
  if (fieldCount <= 3) return 4;
  if (fieldCount <= 5) return 3;
  return 2;
}

// `required` is one of: true (always), a function (conditional), or absent.
function requirement(formId, field) {
  if (field.required === true) return { level: 'yes', hint: null };
  if (typeof field.required === 'function') {
    return { level: 'if', hint: CONDITIONAL_HINTS[`${formId}.${field.key}`] || null };
  }
  return { level: 'no', hint: null };
}

export function paperSpec(form) {
  const title = label(form.titleKey);
  const fields = form.fields.map((f) => {
    const l = label(f.labelKey);
    const req = requirement(form.id, f);
    return {
      key: f.key,
      kind: f.kind,
      icon: f.icon || '',
      labelHi: l.hi,
      labelEn: l.en,
      required: req.level,
      hint: req.hint,
      // Select options print as tick boxes; picker/number/text/notes print as
      // a write-in rule. A picker's real list (jobs, customers) is hundreds of
      // rows and lives in the app — on paper it is a name written by hand.
      options: f.kind === 'select'
        ? (f.options || []).map((o) => ({ value: o.value, ...label(o.labelKey) }))
        : null,
    };
  });
  const layout = GRID_FORMS.has(form.id) ? 'grid' : 'block';
  return {
    id: form.id,
    icon: form.icon,
    titleHi: title.hi,
    titleEn: title.en,
    layout,
    repeat: layout === 'grid' ? (GRID_ROWS[form.id] || 15) : blocksPerSheet(fields.length),
    fields,
  };
}

export const PAPER_FORMS = FORMS.map(paperSpec);

// --- rendering ---

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TICK = '☐';

function reqMark(level) {
  if (level === 'yes') return '<span class="req" title="required">*</span>';
  if (level === 'if') return '<span class="req cond" title="conditional">†</span>';
  return '';
}

function sheetHeader(spec, meta) {
  return `
  <header class="sheet-h">
    <div class="sheet-title">
      <span class="sheet-icon">${esc(spec.icon)}</span>
      <span>
        <span class="t-hi">${esc(spec.titleHi)}</span>
        <span class="t-en">${esc(spec.titleEn)}</span>
      </span>
    </div>
    <div class="sheet-meta">
      <div class="mrow"><span class="mlbl">दिनांक / Date</span><span class="mline"></span></div>
      <div class="mrow"><span class="mlbl">नाम / Name</span><span class="mline"></span></div>
      <div class="mrow"><span class="mlbl">पारी / Shift</span>
        <span class="mopts">${TICK} सुबह Mor &nbsp; ${TICK} दिन Std &nbsp; ${TICK} शाम Eve</span></div>
    </div>
  </header>
  <div class="sheet-id">${esc(spec.id)} · ${esc(meta.stamp)}</div>`;
}

function gridSheet(spec) {
  const cols = spec.fields
    // Notes take the leftover width; render them as the last column.
    .map((f) => `<th class="${f.kind === 'notes' ? 'c-notes' : ''}">
        <span class="h-hi">${esc(f.labelHi)}${reqMark(f.required)}</span>
        <span class="h-en">${esc(f.labelEn)}</span>
        ${f.options ? `<span class="h-opts">${f.options.map((o) => esc(o.hi)).join(' / ')}</span>
           <span class="h-opts-en">${f.options.map((o) => esc(o.en)).join(' / ')}</span>` : ''}
      </th>`).join('');
  const row = `<tr>${spec.fields.map((f) => `<td class="${f.kind === 'notes' ? 'c-notes' : ''}"></td>`).join('')}<td class="c-tick">${TICK}</td></tr>`;
  return `
  <table class="grid">
    <thead><tr>${cols}<th class="c-tick"><span class="h-hi">ऐप</span><span class="h-en">In app</span></th></tr></thead>
    <tbody>${row.repeat(spec.repeat)}</tbody>
  </table>`;
}

function fieldBlock(f) {
  const body = f.options
    ? `<div class="opts">${f.options.map((o) =>
        `<span class="opt">${TICK} <b>${esc(o.hi)}</b> <i>${esc(o.en)}</i></span>`).join('')}</div>`
    : `<div class="write ${f.kind === 'notes' ? 'write-tall' : ''}"></div>`;
  return `
    <div class="f">
      <div class="f-l">
        <span class="f-hi">${esc(f.icon)} ${esc(f.labelHi)}${reqMark(f.required)}</span>
        <span class="f-en">${esc(f.labelEn)}</span>
        ${f.hint ? `<span class="f-hint">${esc(f.hint.hi)} · ${esc(f.hint.en)}</span>` : ''}
      </div>
      ${body}
    </div>`;
}

function blockSheet(spec) {
  const one = (n) => `
    <section class="block">
      <div class="block-n">${n}</div>
      ${spec.fields.map(fieldBlock).join('')}
      <div class="block-tick">${TICK} <span class="t-hi">ऐप में डाल दिया</span> <span class="t-en">Entered in app</span></div>
    </section>`;
  return `<div class="blocks">${Array.from({ length: spec.repeat }, (_, i) => one(i + 1)).join('')}</div>`;
}

const STYLES = `
@page { size: A4 portrait; margin: 9mm 8mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', 'Noto Sans', system-ui, sans-serif;
  color: #000; background: #fff; font-size: 9pt; line-height: 1.25;
}
.sheet { page-break-after: always; break-after: page; padding: 0 0 4mm; }
.sheet:last-child { page-break-after: auto; break-after: auto; }
.sheet-h { display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 1.2pt solid #000; padding-bottom: 2mm; margin-bottom: 1.5mm; gap: 6mm; }
.sheet-title { display: flex; align-items: baseline; gap: 3mm; }
.sheet-icon { font-size: 15pt; }
.t-hi { font-size: 16pt; font-weight: 700; display: block; }
.t-en { font-size: 8.5pt; letter-spacing: .04em; text-transform: uppercase; display: block; }
.sheet-meta { min-width: 62mm; }
.mrow { display: flex; align-items: flex-end; gap: 2mm; margin-bottom: 1.6mm; }
.mlbl { font-size: 7.5pt; white-space: nowrap; }
.mline { flex: 1; border-bottom: .6pt solid #000; height: 4.6mm; }
.mopts { font-size: 7.5pt; }
.sheet-id { font-size: 6.5pt; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2mm; }
.req { font-weight: 700; }
.req.cond { font-weight: 400; }

/* grid layout — one entry per row */
.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
.grid th, .grid td { border: .5pt solid #000; padding: 1mm 1.2mm; vertical-align: top; }
.grid th { background: #eee; text-align: left; }
.h-hi { display: block; font-size: 8.5pt; font-weight: 700; }
.h-en { display: block; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .03em; }
.h-opts { display: block; font-size: 6.5pt; font-weight: 400; }
.h-opts-en { display: block; font-size: 5.5pt; }
.grid td { height: 8mm; }
.c-tick { width: 9mm; text-align: center; font-size: 11pt; }
.c-notes { width: 22mm; }

/* block layout — repeated full-label entries */
.blocks { display: flex; flex-direction: column; gap: 2.5mm; }
.block { border: .8pt solid #000; padding: 2mm 2.5mm; position: relative; }
.block-n { position: absolute; top: 0; right: 0; background: #000; color: #fff;
  font-size: 7pt; padding: .4mm 1.6mm; }
.f { display: flex; align-items: flex-end; gap: 3mm; margin-bottom: 1.8mm; }
.f-l { width: 42mm; flex-shrink: 0; }
.f-hi { display: block; font-size: 9.5pt; font-weight: 600; }
.f-en { display: block; font-size: 6.8pt; text-transform: uppercase; letter-spacing: .03em; }
.f-hint { display: block; font-size: 6.2pt; font-style: italic; }
.write { flex: 1; border-bottom: .6pt solid #000; height: 6mm; }
.write-tall { height: 9mm; }
.opts { flex: 1; display: flex; flex-wrap: wrap; gap: 1mm 4mm; padding-bottom: .8mm; }
.opt { font-size: 8pt; white-space: nowrap; }
.opt i { font-size: 6.8pt; font-style: normal; }
.block-tick { border-top: .5pt dashed #000; margin-top: 1.5mm; padding-top: 1.2mm; font-size: 8pt; }
.block-tick .t-hi, .block-tick .t-en { display: inline; font-size: 8pt; font-weight: 400; text-transform: none; }

.legend { font-size: 7pt; border-top: .5pt solid #000; margin-top: 2mm; padding-top: 1.2mm; }

/* Screen-only cover: printing is the point, so it never reaches paper. */
.cover { max-width: 170mm; margin: 0 auto; padding: 10mm 0; }
.cover h1 { font-size: 20pt; margin-bottom: 3mm; }
.cover p { font-size: 10pt; margin-bottom: 2.5mm; }
.cover ol { margin: 0 0 3mm 5mm; font-size: 10pt; }
.cover li { margin-bottom: 1.2mm; }
@media print { .cover { display: none; } }
`;

export function renderPaperFormsHtml({ stamp = '', generatedOn = '' } = {}) {
  const meta = { stamp };
  const sheets = PAPER_FORMS.map((spec) => `
  <div class="sheet">
    ${sheetHeader(spec, meta)}
    ${spec.layout === 'grid' ? gridSheet(spec) : blockSheet(spec)}
    <div class="legend">
      <b>*</b> ज़रूरी / required &nbsp;·&nbsp; <b>†</b> हालत के हिसाब से / conditional
      &nbsp;·&nbsp; ${TICK} ऐप में डालने के बाद निशान लगाएँ / tick once entered in SEP Handler
    </div>
  </div>`).join('');

  return `<!doctype html>
<html lang="hi">
<head>
<meta charset="utf-8">
<title>SEP Handler — काग़ज़ बैकअप फ़ॉर्म / Paper backup forms</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
<div class="cover">
  <h1>SEP Handler — काग़ज़ बैकअप फ़ॉर्म</h1>
  <p><b>Paper backup forms · ${esc(PAPER_FORMS.length)} sheets, one per handler form.</b>
     Generated ${esc(generatedOn)} from the live form registry (${esc(stamp)}).</p>
  <ol>
    <li>Print A4 portrait, 100% scale, single-sided, black &amp; white.</li>
    <li>Laminate one of each per area — VAT Room 1, VAT Room 2, Barrel Room, Pickling Area 4, Office.</li>
    <li>Keep a loose (un-laminated) pad of Production and Check-in beside each laminated set; those two fill up.</li>
    <li>Every row and block carries a <b>${TICK} In app</b> tick — that tick is what the end-of-shift
        reconciliation counts against the dashboard's Adoption view.</li>
    <li>Devanagari renders through Noto Sans Devanagari; offline, the system Hindi font is used instead.
        Check one sheet before printing the set.</li>
  </ol>
  <p>Regenerate after any change to the handler forms: <code>pnpm paper:forms</code>.</p>
</div>
${sheets}
</body>
</html>`;
}
