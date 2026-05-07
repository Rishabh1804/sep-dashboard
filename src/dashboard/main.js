// Dashboard app shell — orchestrates tab routing, swipe nav, init,
// and exposes the v2.1-compatible function surface on `window` so:
//   1. Inline onclick="fn()" handlers in JS-emitted templates resolve.
//   2. Existing Playwright tests calling window.fn() keep passing.
//
// Per Phase 2 audit, the architectural goal of the layer rule is met
// by the import graph (every module imports only from below); the
// `window.*` surface is a presentation-layer concern, not a layer
// violation. Future cleanup: replace template onclicks with delegated
// data-action handlers.

import { saveJSON } from '../shared/storage/storage.js';
import { K } from '../shared/storage/keys.js';
import { getState, setState } from '../shared/storage/state.js';
import { formatDate } from '../shared/utils/date.js';
import { DEF_PERM, DEF_CW } from '../shared/config/workers.js';
import { DEF_AREAS } from '../shared/config/areas.js';
import { DEF_CFG } from '../shared/config/wage.js';
import { DEF_STOCK } from '../shared/config/stock.js';
import { DEF_INV_CFG } from '../shared/config/invoice.js';
import { APP_VERSION } from '../shared/config/app.js';

import { initSaveDot } from '../components/save-dot.js';
import { toggleDarkMode, initDarkMode } from '../components/dark-mode.js';
import { toggleFab, closeFab, initFab } from '../components/fab.js';
import { openPicker, togglePickerWorker, closePicker } from '../components/worker-picker.js';
import {
  openSettings, closeSettings, addWorkerPrompt, toggleWorkerActive,
  getStorageUsed, exportData, importData, initSettingsBackHandler,
} from '../components/settings-panel.js';
import { printCWPay, printPermPay } from '../components/print-pay.js';
import {
  openInvoiceModal, closeInvModal, onInvClientChange, addInvLine,
  onRateSelect, recalcInvPreview, submitInvoiceForm,
} from '../components/invoice-form.js';
import { viewInvoice, closeInvDetail, markInvPaid, markInvPartial } from '../components/invoice-detail.js';

import { renderHome } from './tabs/home.js';
import { renderAttendance, markAtt, initAttendanceFilter } from './tabs/attendance.js';
import {
  renderProduction, lockProdAtt, unlockProdAtt, togglePeriod, setProdCap2,
  showProdConfirm, cancelConfirm, confirmProduction, logProdEntry,
  toggleHoliday, markAllPresent, addProdNote,
} from './tabs/production.js';
import {
  renderFinance, recordCWAdvance, markCWPaid, recordAdvance, markPermPaid,
  lockMonth, unlockMonth,
} from './tabs/finance.js';
import {
  renderInvoice, shiftGSTMonth, addClient, editClient, editClientRates,
  editInvConfig, exportGSTRegister, initInvoiceSubtabHandler,
} from './tabs/invoice.js';
import { renderStock, updateStock, editStockQty } from './tabs/stock.js';
import { renderHistory, initHistoryNav } from './tabs/history.js';
import { exportAttendanceCSV, exportPayrollCSV, exportCostsCSV } from './tabs/finance-export.js';

// Storage hooks invoked from finance.js record-advance flow (avoids cycle).
import { saveProdDay } from '../shared/storage/production.js';
import { initProdDay } from '../shared/utils/calc-prod.js';

// --- Tab routing ---

const TAB_ORDER = ['home', 'attendance', 'production', 'finance', 'invoice', 'stock', 'history'];

function switchTab(tabId) {
  setState({ currentTab: tabId });
  document.querySelectorAll('.tab-btn').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach((p) =>
    p.classList.toggle('active', p.id === `tab-${tabId}`));
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  renderTab(tabId);
}

function renderTab(tabId) {
  switch (tabId) {
    case 'home':       renderHome(); break;
    case 'attendance': renderAttendance(); break;
    case 'production': renderProduction(); break;
    case 'finance':    renderFinance(); break;
    case 'invoice':    renderInvoice(); break;
    case 'stock':      renderStock(); break;
    case 'history':    renderHistory(); break;
  }
}

function initTabRouting() {
  document.getElementById('tabBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  // Swipe navigation — touch-only.
  let swipeX = 0; let swipeY = 0; let swipeT = 0;
  const tabContent = document.querySelector('.tab-content');
  tabContent?.addEventListener('touchstart', (e) => {
    swipeX = e.changedTouches[0].screenX;
    swipeY = e.changedTouches[0].screenY;
    swipeT = Date.now();
  }, { passive: true });
  tabContent?.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - swipeX;
    const dy = e.changedTouches[0].screenY - swipeY;
    if (Date.now() - swipeT > 400 || Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const idx = TAB_ORDER.indexOf(getState().currentTab);
    if (dx < -80 && idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1]);
    else if (dx > 80 && idx > 0) switchTab(TAB_ORDER[idx - 1]);
  }, { passive: true });
}

// --- Default-data seed (idempotent; only writes if key absent). ---
function initData() {
  if (!localStorage.getItem(K.peEmp))     saveJSON(K.peEmp, DEF_PERM);
  if (!localStorage.getItem(K.cwEmp))     saveJSON(K.cwEmp, DEF_CW);
  if (!localStorage.getItem(K.prodAreas)) saveJSON(K.prodAreas, DEF_AREAS);
  if (!localStorage.getItem(K.prodCfg))   saveJSON(K.prodCfg, DEF_CFG);
  if (!localStorage.getItem(K.stock))     saveJSON(K.stock, DEF_STOCK);
  if (!localStorage.getItem(K.invCfg))    saveJSON(K.invCfg, DEF_INV_CFG);
}

// --- Data-action delegation (static markup) ---
//
// Static HTML markup uses data-action for header, FAB, and Confirm
// buttons. Template-emitted onclicks still target window.* functions
// (audit-deferred). The delegated dispatcher reads `data-action` and
// calls the registered window function with no args — buttons that
// need args use the inline-onclick path.
function initDataActionDelegation() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const fn = window[action];
    if (typeof fn === 'function') {
      e.preventDefault();
      fn();
    }
  });
}

function exposeWindowSurface() {
  Object.assign(window, {
    // App shell
    APP_VERSION,
    switchTab,
    renderTab,
    // Save indicator + dark mode
    toggleDarkMode,
    // Storage helpers used by some inline handlers
    saveProdDay,
    initProdDay,
    // FAB
    toggleFab,
    closeFab,
    // Picker
    openPicker, togglePickerWorker, closePicker,
    // Settings + data
    openSettings, closeSettings, addWorkerPrompt, toggleWorkerActive,
    getStorageUsed, exportData, importData,
    // Print
    printCWPay, printPermPay,
    // Invoice form
    openInvoiceModal, closeInvModal, onInvClientChange, addInvLine,
    onRateSelect, recalcInvPreview, submitInvoiceForm,
    // Invoice detail
    viewInvoice, closeInvDetail, markInvPaid, markInvPartial,
    // Tab renders (callable from FAB / cross-tab refresh)
    renderHome, renderAttendance, renderProduction, renderFinance,
    renderInvoice, renderStock, renderHistory,
    // Attendance + Production
    markAtt,
    lockProdAtt, unlockProdAtt, togglePeriod, setProdCap2,
    showProdConfirm, cancelConfirm, confirmProduction, logProdEntry,
    toggleHoliday, markAllPresent, addProdNote,
    // Finance
    recordCWAdvance, markCWPaid, recordAdvance, markPermPaid,
    lockMonth, unlockMonth,
    // Invoice tab CRUD
    shiftGSTMonth, addClient, editClient, editClientRates,
    editInvConfig, exportGSTRegister,
    // Stock
    updateStock, editStockQty,
    // Finance exports
    exportAttendanceCSV, exportPayrollCSV, exportCostsCSV,
  });
}

// --- Boot ---

function boot() {
  document.getElementById('headerDate').textContent = formatDate(getState().today);

  exposeWindowSurface();
  initSaveDot();
  initDarkMode();
  initData();
  initTabRouting();
  initAttendanceFilter();
  initInvoiceSubtabHandler();
  initHistoryNav();
  initSettingsBackHandler();
  initDataActionDelegation();

  // FAB action map — concrete handlers registered by their tabs.
  const fabAction = initFab({
    markAllPresent,
    goAttendance: () => switchTab('attendance'),
    goProduction: () => switchTab('production'),
    addNote: addProdNote,
    toggleHoliday,
  });
  window.fabAction = fabAction;

  renderTab('home');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
