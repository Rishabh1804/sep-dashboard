// Universal form template engine.
//
// One renderer drives all 9 handler forms (HANDLER_UI_SHELL.md "Universal
// form template"). A form definition declares fields; this builds the
// screen, wires draft auto-save, inline validation, the idempotency key,
// and the offline-queue submit path. Field-level specs per form land in
// Stage D — this engine is the substrate they plug into.
//
// Stage C deliberately ships the *entry points* for the pre-fill defense
// bundle (last-value memory + pulsing "still the same?" hint). The full
// bundle (visual diff, 15-min decay, job-completion clear, first-of-
// session confirm step) is HANDLER_FORMS.md / Stage D work.

import { t, speak } from './i18n.js';
import { openPicker } from './picker.js';
import { idbAvailable, idbGet, idbSet, idbDel } from './idb.js';
import { confirmSaved, signalError } from './feedback.js';
import { enqueueWrite, showModal } from './sync.js';
import { pushRecent } from './recent.js';
import { checkRecord, deriveSanityState, statFields, statKey, pushStat, emptyStats } from './sanity.js';

const DRAFT_PREFIX = 'draft:';
const LASTVALS_PREFIX = 'lastvals:';
const STATS_PREFIX = 'stats:';

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function debounce(fn, ms) {
  let h;
  return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

// def: { type, titleKey, mode, fields:[...], pickers:{ key: ()=>items } }
// host: container element; ctx: { onBack, afterSubmit }
export async function renderForm(host, def, ctx = {}) {
  const idempotencyKey = uuid();
  const state = { __idem: idempotencyKey };
  const lastVals = (idbAvailable() ? await idbGet(LASTVALS_PREFIX + def.id).catch(() => null) : null) || {};
  // Rolling σ baseline (default 3σ) for this form's numeric fields (Welford stats per key).
  const baselines = (idbAvailable() ? await idbGet(STATS_PREFIX + def.id).catch(() => null) : null) || {};

  host.innerHTML = `
    <div class="h-form-head">
      <button class="h-back" aria-label="${t('back')}">←</button>
      <div class="h-screen-title">${t(def.titleKey)}</div>
    </div>
    <form class="h-form" novalidate>
      <div class="h-fields"></div>
      <div class="h-actions">
        <button type="button" class="h-btn h-btn-ghost h-cancel">${t('cancel')}</button>
        <button type="submit" class="h-btn h-btn-primary h-submit">
          ${t(def.mode === 'continue' ? 'submit_continue' : 'submit_return')}
        </button>
      </div>
    </form>`;

  const fieldsEl = host.querySelector('.h-fields');
  host.querySelector('.h-back').addEventListener('click', () => ctx.onBack?.());
  host.querySelector('.h-cancel').addEventListener('click', () => { clearDraft(def.id); ctx.onBack?.(); });

  const fieldApi = {}; // key -> { setValue, getEl }

  // Draft auto-save (defends against acid-splash screen-wake loss).
  // Declared BEFORE the field loop: the picker setValue closure calls it, and
  // the loop's lastVals pre-fill invokes that closure synchronously — a later
  // declaration is a TDZ ReferenceError on any reopen with remembered pickers.
  const scheduleDraft = debounce(() => {
    if (idbAvailable()) idbSet(DRAFT_PREFIX + def.id, { ...state }).catch(() => {});
  }, 200);

  for (const f of def.fields) {
    const wrap = document.createElement('div');
    wrap.className = 'h-field';
    wrap.dataset.key = f.key;

    const labelHtml = `<div class="h-field-label">
        ${f.icon ? `<span class="h-field-icon">${f.icon}</span>` : ''}
        <span>${t(f.labelKey)}</span>
        <span class="h-field-en">${t(f.labelKey, 'en')}</span>
        <span class="h-tts" role="button" aria-label="speak">🔊</span>
      </div>`;

    let controlHtml = '';
    if (f.kind === 'picker') {
      controlHtml = `<button type="button" class="h-chooser">
          <span class="h-chooser-val h-placeholder">${t('choose')}</span>
          <span class="h-chooser-change">${t('change')}</span>
        </button>`;
    } else if (f.kind === 'select') {
      const opts = (f.options || []).map((o) => `<option value="${o.value}">${t(o.labelKey)}</option>`).join('');
      controlHtml = `<select class="h-select"><option value="">${t('choose')}</option>${opts}</select>`;
    } else if (f.kind === 'notes') {
      controlHtml = `<textarea class="h-textarea" rows="3"></textarea>`;
    } else {
      const num = f.kind === 'number';
      controlHtml = `<input class="h-input" type="${num ? 'text' : 'text'}"
        inputmode="${num ? 'numeric' : (f.inputmode || 'text')}"
        ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}>`;
    }

    wrap.innerHTML = labelHtml + controlHtml + `<div class="h-field-error">⚠️ <span></span></div>`;
    fieldsEl.appendChild(wrap);

    // Long-press / click TTS on the label.
    const ttsBtn = wrap.querySelector('.h-tts');
    ttsBtn.addEventListener('click', (e) => { e.preventDefault(); speak(f.labelKey); });
    bindLongPress(wrap.querySelector('.h-field-label'), () => speak(f.labelKey));

    // Wire control behaviour + value plumbing.
    if (f.kind === 'picker') {
      const chooser = wrap.querySelector('.h-chooser');
      const valEl = chooser.querySelector('.h-chooser-val');
      const setValue = (item) => {
        state[f.key] = item ? item.id : '';
        state[`${f.key}__label`] = item ? item.primary : '';
        valEl.textContent = item ? item.primary : t('choose');
        valEl.classList.toggle('h-placeholder', !item);
        scheduleDraft();
      };
      chooser.addEventListener('click', () => {
        const items = def.pickers?.[f.pickerKey]?.() || [];
        openPicker({ titleKey: f.labelKey, items, onPick: setValue });
      });
      fieldApi[f.key] = { setValue: (id) => {
        const items = def.pickers?.[f.pickerKey]?.() || [];
        setValue(items.find((i) => i.id === id) || null);
      } };
    } else {
      const ctrl = wrap.querySelector('.h-input, .h-select, .h-textarea');
      ctrl.addEventListener('input', () => { state[f.key] = ctrl.value; clearError(wrap); scheduleDraft(); });
      fieldApi[f.key] = { setValue: (v) => { ctrl.value = v ?? ''; state[f.key] = ctrl.value; } };
    }

    // Smart default from last submission of this form type (pre-fill entry point).
    if (lastVals[f.key] != null && lastVals[f.key] !== '') {
      fieldApi[f.key].setValue(lastVals[f.key]);
      wrap.classList.add('h-prefilled');
      const hint = document.createElement('div');
      hint.className = 'h-prefill-hint';
      hint.textContent = t('still_same');
      wrap.appendChild(hint);
    } else if (f.default != null) {
      // Declared default (value or fn of now) — e.g. the check-in slot
      // inferred from the clock. No prefill hint: this is the form's own
      // suggestion, not a memory of the last entry.
      const dv = typeof f.default === 'function' ? f.default() : f.default;
      if (dv != null && dv !== '') fieldApi[f.key].setValue(dv);
    }
  }

  await maybeResumeDraft(def, state, fieldApi);

  // --- Submit ---
  host.querySelector('.h-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstBad = validate(def, state, fieldsEl);
    if (firstBad) { signalError(t('required')); firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }

    // Sanity / σ net: an unusual (but not impossible) number gets a confirm
    // step; an impossible one is refused outright. Advisory, never a silent
    // drop — the Zod gate at transport is the deterministic backstop.
    // Production's quantity may be entered as rounds × round_size (no explicit
    // total); check the DERIVED total too so a fat-finger round_size that
    // multiplies out of band still prompts (mirrors transport's derivation).
    const flags = checkRecord(def.id, deriveSanityState(def.id, state), baselines);
    if (flags.length) {
      const proceed = await confirmSanity(def, flags);
      if (!proceed) { signalError(t('unusual_title')); return; }
    }

    const record = buildRecord(def, state, idempotencyKey);
    await enqueueWrite(record);
    await rememberLastVals(def, state);
    // Fold the DERIVED state (same view checkRecord judged — production's
    // rounds × round_size total lands under `quantity`, so the σ baseline
    // matures in rounds-mode too), and skip fields the user just confirmed
    // as unusual: folding a waved-through outlier inflates σ enough that the
    // next identical fat-finger passes silently.
    await updateBaselines(def, deriveSanityState(def.id, state), baselines,
      new Set(flags.map((f) => f.key)));
    await pushRecent({
      type: def.id,
      idempotencyKey,
      summary: summarize(def, state),
      ts: record.ts,
      status: 'queued',
    });
    clearDraft(def.id);
    confirmSaved();
    ctx.afterSubmit?.(record);
  });
}

function bindLongPress(el, fn) {
  let timer;
  const start = () => { timer = setTimeout(fn, 500); };
  const cancel = () => clearTimeout(timer);
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchmove', cancel);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
}

function validate(def, state, fieldsEl) {
  let first = null;
  for (const f of def.fields) {
    const wrap = fieldsEl.querySelector(`.h-field[data-key="${f.key}"]`);
    const val = state[f.key];
    let err = null;
    // `required` may be a function of the whole form state — e.g. production
    // quantity is required unless rounds × round_size carries the count.
    const required = typeof f.required === 'function' ? f.required(state) : f.required;
    if (required && (val == null || String(val).trim() === '')) err = t('required');
    else if (f.validate && val != null && String(val).trim() !== '') err = f.validate(val);
    if (err) {
      wrap.classList.add('h-invalid');
      wrap.querySelector('.h-field-error span').textContent = err;
      if (!first) first = wrap;
    } else clearError(wrap);
  }
  return first;
}

function clearError(wrap) { wrap.classList.remove('h-invalid'); }

function buildRecord(def, state, idempotencyKey) {
  const fields = {};
  for (const f of def.fields) {
    // Trim-aware: a whitespace-only entry is "left blank", not Number(' ')=0 —
    // an invisible space would otherwise queue an explicit zero total that the
    // transport permanently rejects despite valid rounds (round-2 trap class).
    if (state[f.key] != null && String(state[f.key]).trim() !== '') {
      fields[f.key] = f.kind === 'number' ? Number(state[f.key]) : state[f.key];
      if (state[`${f.key}__label`]) fields[`${f.key}__label`] = state[`${f.key}__label`];
    }
  }
  return { type: def.id, idempotencyKey, ts: Date.now(), fields };
}

function summarize(def, state) {
  const parts = [];
  for (const f of def.fields.slice(0, 3)) {
    const v = state[`${f.key}__label`] || state[f.key];
    if (v) parts.push(v);
  }
  return parts.join(' · ') || t(def.titleKey);
}

async function rememberLastVals(def, state) {
  if (!idbAvailable()) return;
  const keep = {};
  for (const f of def.fields) {
    if (f.remember && state[f.key] != null && state[f.key] !== '') keep[f.key] = state[f.key];
  }
  await idbSet(LASTVALS_PREFIX + def.id, keep).catch(() => {});
}

// Fold this submission's numeric fields into the rolling Welford baseline so
// the σ net sharpens over time. Runs only after a record is safely queued.
// `skipKeys`: fields that raised a confirm flag this submission — excluded so
// a confirmed outlier doesn't poison the very baseline it was flagged against.
// Stats are stored under statKey (unit-scoped: production per machine-group,
// stock forms per item) — the same key checkRecord reads, so a VAT pcs entry
// never pollutes the barrel-kg distribution.
async function updateBaselines(def, state, baselines, skipKeys = new Set()) {
  if (!idbAvailable()) return;
  const next = { ...baselines };
  let touched = false;
  for (const key of statFields(def.id)) {
    if (skipKeys.has(key)) continue;
    const v = state[key];
    if (v == null || String(v).trim() === '' || !Number.isFinite(Number(v))) continue;
    const sk = statKey(def.id, key, state);
    next[sk] = pushStat(next[sk] || emptyStats(), Number(v));
    touched = true;
  }
  if (touched) await idbSet(STATS_PREFIX + def.id, next).catch(() => {});
}

// Confirm step for sanity flags. A 'confirm' flag (unusual) offers proceed;
// a 'block' flag (impossible) offers only "go fix" — the value must change.
// Resolves true to submit, false to return to the form.
function confirmSanity(def, flags) {
  const labelFor = (key) => t(def.fields.find((f) => f.key === key)?.labelKey || key);
  const hasBlock = flags.some((f) => f.level === 'block');
  const rows = flags.map((f) =>
    `<li><strong>${labelFor(f.key)}</strong>: ${f.value} <span class="h-sanity-reason">(${f.reason})</span></li>`,
  ).join('');
  return new Promise((resolve) => {
    const actions = [{ label: t('go_fix'), kind: 'ghost', onClick: (close) => { close(); resolve(false); } }];
    if (!hasBlock) {
      // Proceed is the non-default (ghost) button so a reflexive tap doesn't
      // wave an unusual value straight through.
      actions.push({ label: t('confirm_correct'), kind: 'ghost', onClick: (close) => { close(); resolve(true); } });
    }
    showModal({ title: t('unusual_title'), bodyHtml: `<div>${t('unusual_ask')}</div><ul class="h-sanity-list">${rows}</ul>`, actions });
  });
}

function clearDraft(type) { if (idbAvailable()) idbDel(DRAFT_PREFIX + type).catch(() => {}); }

async function maybeResumeDraft(def, state, fieldApi) {
  if (!idbAvailable()) return;
  const draft = await idbGet(DRAFT_PREFIX + def.id).catch(() => null);
  if (!draft || !hasContent(def, draft)) return;
  await new Promise((resolve) => {
    showModal({
      title: t('resume_q'),
      bodyHtml: `<div>${summarize(def, draft)}</div>`,
      actions: [
        { label: t('yes'), kind: 'primary', onClick: (close) => {
          for (const f of def.fields) if (draft[f.key] != null) fieldApi[f.key]?.setValue(draft[f.key]);
          Object.assign(state, draft); close(); resolve();
        } },
        { label: t('no'), kind: 'ghost', onClick: (close) => { clearDraft(def.id); close(); resolve(); } },
      ],
    });
  });
}

function hasContent(def, draft) {
  return def.fields.some((f) => draft[f.key] != null && String(draft[f.key]).trim() !== '');
}
