// Handler PWA shell — Phase 2.0 Stage C.
//
// The notebook-handler app: the primary data-ingestion surface. Three-
// layer screen hierarchy (HANDLER_UI_SHELL.md): a persistent top bar, a
// home form-picker, and per-form screens driven by the universal form
// engine. Built vanilla to match the dashboard idiom; no framework.
//
// Stage C scope: shell + universal form template + big-button pickers +
// offline queue/sync chip + i18n (Devanagari + TTS) + multi-modal
// confirmation. The Firestore transport is injected in Stage B; until
// then writes queue locally ("Saved on phone, not yet sent").

import { APP_VERSION } from '../shared/config/app.js';
import { t, getLang, setLang, LANGS, speak } from './i18n.js';
import { isMuted, setMuted } from './feedback.js';
import { renderChip, openSyncSheet, preFlushCheck, showModal } from './sync.js';
import { loadRecent, getRecent } from './recent.js';
import { FORMS, getForm } from './forms-registry.js';
import { renderForm } from './form.js';
import { hydrateCaches } from './picker-cache.js';

const NAME_KEY = 'sep_handler_name';
const root = () => document.getElementById('handler-root');

function handlerName() {
  try { return globalThis.localStorage?.getItem(NAME_KEY) || ''; } catch { return ''; }
}

// Shift derived from clock (matches v2.1 3-period model at shop level).
function currentShift() {
  const h = new Date().getHours();
  if (h < 9) return 'shift_m';
  if (h < 17) return 'shift_s';
  return 'shift_e';
}

function topBar() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const name = handlerName();
  return `<div class="h-topbar">
    <span class="h-clock">${time}</span>
    <span class="h-shift">· ${t(currentShift())}</span>
    ${name ? `<span class="h-who">· ${name}</span>` : ''}
    <span class="h-spacer"></span>
    <button class="h-chip" id="h-chip" data-state="synced" aria-label="${t('sync_status')}"></button>
    <button class="h-gear" id="h-gear" aria-label="${t('settings')}">⚙</button>
  </div>`;
}

function refreshChip() { renderChip(document.getElementById('h-chip')); }

// --- Home screen ---
function renderHome() {
  const tiles = FORMS.map((f) => `
    <button class="h-tile" data-form="${f.id}">
      <span class="h-tile-icon">${f.icon}</span>
      <span class="h-tile-label">${t(f.titleKey)}</span>
      <span class="h-tile-en">${t(f.titleKey, 'en')}</span>
    </button>`).join('');

  const recent = getRecent();
  const recentRows = recent.length
    ? recent.map((e) => `<div class="h-recent-row">
        <span class="h-recent-time">${new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span class="h-recent-text">${t(e.type)} · ${e.summary}</span>
        <span class="h-recent-status">${e.status === 'queued' ? '⏳' : '✓'}</span>
      </div>`).join('')
    : `<div class="h-empty">${t('no_recent')}</div>`;

  root().innerHTML = topBar() + `<div class="h-body">
    <div class="h-tiles">${tiles}</div>
    <div class="h-recent-h">${t('recent_entries')}</div>
    <div class="h-recent-list">${recentRows}</div>
  </div>`;

  root().querySelectorAll('.h-tile').forEach((tile) =>
    tile.addEventListener('click', () => openForm(tile.dataset.form)));
  wireTopBar();
  refreshChip();
}

// --- Form screen ---
function openForm(id) {
  const def = getForm(id);
  if (!def) return renderHome();
  root().innerHTML = topBar() + `<div class="h-body"><div id="h-form-host"></div></div>`;
  wireTopBar();
  refreshChip();
  renderForm(document.getElementById('h-form-host'), def, {
    onBack: renderHome,
    afterSubmit: () => { refreshChip(); if (def.mode === 'continue') openForm(id); else renderHome(); },
  });
}

function wireTopBar() {
  document.getElementById('h-gear')?.addEventListener('click', openSettings);
  document.getElementById('h-chip')?.addEventListener('click', () => openSyncSheet(refreshChip));
}

// --- Settings ---
function openSettings() {
  const lang = getLang();
  const muted = isMuted();
  const langSeg = LANGS.map((l) =>
    `<button data-lang="${l}" class="${l === lang ? 'active' : ''}">${l === 'hi' ? 'हिं' : 'EN'}</button>`).join('');

  const close = showModal({
    title: t('settings'),
    bodyHtml: `
      <div class="h-set-row">
        <span class="h-set-label">${t('language')}</span>
        <span class="h-seg" id="h-lang-seg">${langSeg}</span>
      </div>
      <div class="h-set-row">
        <span class="h-set-label">${t('sound')}</span>
        <span class="h-seg" id="h-sound-seg">
          <button data-mute="0" class="${muted ? '' : 'active'}">🔊</button>
          <button data-mute="1" class="${muted ? 'active' : ''}">🔇</button>
        </span>
      </div>
      <div class="h-set-row">
        <span class="h-set-label">${t('handler_name')}</span>
        <input class="h-input" id="h-name-input" style="max-width:160px" value="${handlerName()}">
      </div>
      <div class="h-set-row"><span class="h-set-label" style="color:var(--text-muted)">v${APP_VERSION}</span></div>`,
    actions: [{ label: t('back'), kind: 'primary', onClick: (c) => c() }],
  });

  document.getElementById('h-lang-seg')?.addEventListener('click', (e) => {
    const l = e.target.dataset?.lang; if (!l) return;
    setLang(l); speak('settings'); close(); renderHome(); openSettings();
  });
  document.getElementById('h-sound-seg')?.addEventListener('click', (e) => {
    const m = e.target.dataset?.mute; if (m == null) return;
    setMuted(m === '1'); close(); openSettings();
  });
  document.getElementById('h-name-input')?.addEventListener('change', (e) => {
    try { globalThis.localStorage?.setItem(NAME_KEY, e.target.value.trim()); } catch { /* ignore */ }
  });
}

// --- Boot ---
async function boot() {
  if (!root()) return;
  document.documentElement.lang = getLang();
  await loadRecent();
  // Restore the last persisted picker snapshot (customer/part/job/supplier).
  // Empty until Track 2 hydrates from Firestore; safe no-op meanwhile.
  await hydrateCaches().catch(() => {});
  renderHome();
  // Tick the top-bar clock each minute (update text only, no full re-render).
  setInterval(() => {
    const clock = document.querySelector('.h-topbar .h-clock');
    if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, 60000);
  // Pre-flush confirmation if writes were left queued from a prior session.
  preFlushCheck({ onReview: () => openSyncSheet(refreshChip) });
  // Keep the chip honest as connectivity changes.
  globalThis.addEventListener?.('online', refreshChip);
  globalThis.addEventListener?.('offline', refreshChip);
  // Register the handler-scoped service worker (best-effort).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw-handler.js', { scope: './' }).catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
