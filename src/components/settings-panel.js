// Settings sidebar — overlay containing General/Workers/Invoice/Data
// sections. Uses native prompt/confirm for adds and edits, matching
// v2.1 UX. Tests rely on prompt-flow inputs to script CRUD operations.

import { loadJSON, saveJSON } from '../shared/storage/storage.js';
import { K } from '../shared/storage/keys.js';
import { getPermWorkers, getCWWorkers } from '../shared/storage/workers.js';
import { getSettings } from '../shared/storage/settings.js';
import { getCfg } from '../shared/storage/production.js';
import { getInvCfg } from '../shared/storage/invoice.js';
import { sepRound } from '../shared/utils/currency.js';
import { esc } from '../shared/utils/format.js';
import { formatDateShort } from '../shared/utils/date.js';
import { getState } from '../shared/storage/state.js';
import { APP_VERSION } from '../shared/config/app.js';
import { da, overlayClose } from '../shared/utils/dom.js';

export function getStorageUsed() {
  let total = 0;
  Object.values(K).forEach((key) => {
    if (typeof key === 'function') return;
    const v = localStorage.getItem(key);
    if (v) total += key.length + v.length;
  });
  return (total * 2 / 1024).toFixed(1) + ' KB';
}

export function exportData() {
  const data = {};
  Object.entries(K).forEach(([_label, key]) => {
    if (typeof key === 'function') return;
    const v = localStorage.getItem(key);
    if (v) data[key] = JSON.parse(v);
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = getState().today;
  a.href = url; a.download = `SEP_Backup_${today}.json`;
  a.click(); URL.revokeObjectURL(url);
}

export function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    try {
      const text = await e.target.files[0].text();
      const data = JSON.parse(text);
      Object.entries(data).forEach(([key, val]) => {
        localStorage.setItem(key, JSON.stringify(val));
      });
      alert('Import successful. Reloading...');
      location.reload();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  input.click();
}

export function resetAllData() {
  if (!confirm('Reset ALL data? This cannot be undone.')) return;
  localStorage.clear();
  location.reload();
}

export function openSettings() {
  if (document.querySelector('.settings-overlay')) return;
  history.pushState({ popup: 'settings' }, '');

  const perm = getPermWorkers();
  const cw = getCWWorkers();
  const _settings = getSettings();
  const cfg = getCfg();
  const invCfg = getInvCfg();

  const html = `<div class="settings-overlay" ${overlayClose('closeSettings')}>
    <div class="settings-panel">
      <div class="flex-between" style="padding:var(--sp-12) var(--sp-16);border-bottom:1px solid var(--border)">
        <span class="card-title">Settings</span>
        <button class="header-btn" ${da('closeSettings')}>✕</button>
      </div>
      <div class="settings-body">

        <div class="section-zone">
          <div class="section-label-md">General</div>
          <div class="card-info">
            <div class="settings-row"><span class="card-label">Version</span><span class="card-meta">v${APP_VERSION}</span></div>
            <div class="settings-row"><span class="card-label">CW Hour Rate</span><span class="card-meta">₹${cfg.hourRate}/hr</span></div>
            <div class="settings-row"><span class="card-label">Snack Rate</span><span class="card-meta">₹${cfg.snackRate}/day</span></div>
            <div class="settings-row"><span class="card-label">Perm OT Base</span><span class="card-meta">₹${cfg.permOtBaseRate}/day → ₹${sepRound(cfg.permOtBaseRate / 8 * cfg.permOtMultiplier)}/hr</span></div>
          </div>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Permanent Staff (${perm.length})</div>
          <div class="card-info">
            ${perm.map((w) => `<div class="settings-row">
              <div>
                <span class="card-label">${esc(w.name)}</span>
                <span class="card-meta"> — ${w.role || 'Worker'}${w.inactive ? ' (inactive)' : ''}</span>
              </div>
              <span class="card-meta">₹${w.dailyRate}/day</span>
            </div>`).join('')}
          </div>
          <button class="btn btn-secondary btn-sm mt-8" ${da('addWorkerPrompt', 'perm')}>+ Add Perm Worker</button>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Contract Workers (${cw.filter((w) => !w.inactive).length} active)</div>
          <div class="card-info">
            ${cw.filter((w) => !w.inactive).map((w) => `<div class="settings-row">
              <span class="card-label">${esc(w.name)}</span>
              <button class="btn btn-sm" style="color:var(--danger)" ${da('toggleWorkerActive', 'cw', w.id)}>Deactivate</button>
            </div>`).join('')}
            ${cw.filter((w) => w.inactive).length ? `<div class="card-meta mt-8">Inactive: ${cw.filter((w) => w.inactive).map((w) => `${w.name}${w.deactivatedOn ? ' (' + formatDateShort(w.deactivatedOn) + ')' : ''}`).join(', ')}</div>
            <div class="mt-4">${cw.filter((w) => w.inactive).map((w) => `<button class="btn btn-sm btn-secondary mt-4" ${da('toggleWorkerActive', 'cw', w.id)}>Reactivate ${esc(w.name)}</button>`).join(' ')}</div>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm mt-8" ${da('addWorkerPrompt', 'cw')}>+ Add CW Worker</button>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Invoice Settings</div>
          <div class="card-info">
            <div class="settings-row"><span class="card-label">Company</span><span class="card-meta">${esc(invCfg.companyName)}</span></div>
            <div class="settings-row"><span class="card-label">GSTIN</span><span class="card-meta">${esc(invCfg.gstin || 'Not set')}</span></div>
            <div class="settings-row"><span class="card-label">State Code</span><span class="card-meta">${invCfg.stateCode}</span></div>
            <div class="settings-row"><span class="card-label">SAC</span><span class="card-meta">${invCfg.sac}</span></div>
            <div class="settings-row"><span class="card-label">GST Rate</span><span class="card-meta">${invCfg.gstRate}%</span></div>
            <div class="settings-row"><span class="card-label">Next Invoice #</span><span class="card-meta">${invCfg.seriesPrefix}/.../​${String(invCfg.nextNumber).padStart(4, '0')}</span></div>
          </div>
          <button class="btn btn-secondary btn-sm mt-8" ${da('editInvConfig')}>Edit Invoice Config</button>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Data Management</div>
          <div class="card-info">
            <div class="settings-row">
              <span class="card-label">Storage Used</span>
              <span class="card-meta">${getStorageUsed()}</span>
            </div>
          </div>
          <div class="flex-center gap-8 mt-8">
            <button class="btn btn-secondary btn-sm" ${da('exportData')}>Export JSON</button>
            <button class="btn btn-secondary btn-sm" ${da('importData')}>Import JSON</button>
          </div>
          <button class="btn btn-danger btn-sm mt-8 btn-full" ${da('resetAllData')}>Reset All Data</button>
        </div>

      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

export function closeSettings() {
  const el = document.querySelector('.settings-overlay');
  if (el) el.remove();
}

export function addWorkerPrompt(type) {
  const name = prompt(`Enter ${type === 'perm' ? 'permanent' : 'contract'} worker name:`);
  if (!name || !name.trim()) return;
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36).slice(-4);

  if (type === 'perm') {
    const rate = prompt('Daily rate (₹):', '496');
    const dailyRate = parseInt(rate) || 496;
    const role = prompt('Role:', 'Worker');
    const workers = getPermWorkers();
    workers.push({ id, name: name.trim(), role: role || 'Worker', dailyRate, inactive: false });
    saveJSON(K.peEmp, workers);
  } else {
    const workers = getCWWorkers();
    workers.push({ id, name: name.trim(), inactive: false });
    saveJSON(K.cwEmp, workers);
  }
  closeSettings();
  openSettings();
}

export function toggleWorkerActive(type, id) {
  const key = type === 'perm' ? K.peEmp : K.cwEmp;
  const workers = loadJSON(key, []);
  const w = workers.find((x) => x.id === id);
  if (!w) return;
  if (!w.inactive) {
    const reason = prompt('Reason for deactivation (optional):', '') || '';
    if (!confirm(`Deactivate ${w.name}?`)) return;
    w.inactive = true;
    w.deactivatedOn = getState().today;
    w.deactivateReason = reason;
  } else {
    if (!confirm(`Reactivate ${w.name}?`)) return;
    w.inactive = false;
    w.reactivatedOn = getState().today;
  }
  saveJSON(key, workers);
  closeSettings();
  openSettings();
}

// Settings closes on browser back-button.
export function initSettingsBackHandler() {
  window.addEventListener('popstate', () => { closeSettings(); });
}
