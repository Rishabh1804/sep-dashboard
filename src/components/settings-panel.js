// Settings sidebar — overlay containing General/Workers/Invoice/Data
// sections. Uses native prompt/confirm for adds and edits, matching
// v2.1 UX. Tests rely on prompt-flow inputs to script CRUD operations.

import { loadJSON, saveJSON } from '../shared/storage/storage.js';
import { K } from '../shared/storage/keys.js';
import { getPermWorkers, getCWWorkers } from '../shared/storage/workers.js';
import { getSettings } from '../shared/storage/settings.js';
import { getCfg } from '../shared/storage/production.js';
import { getInvCfg } from '../shared/storage/invoice.js';
import { esc } from '../shared/utils/format.js';
import { formatDateShort } from '../shared/utils/date.js';
import { PLAIN_PAY_MODEL } from '../shared/utils/payroll.js';
import { applyRosterImport, rosterStatus, ROSTER_STAMP } from '../shared/storage/seed-sync.js';
import { repriceUnpriced } from '../shared/utils/calc-prod.js';
import { getAreas, getProdLogs } from '../shared/storage/production.js';
import { isMonthLocked } from '../shared/storage/lock.js';

import { getState } from '../shared/storage/state.js';
import { APP_VERSION } from '../shared/config/app.js';

// A rate that has not arrived through the roster import says so, rather than
// rendering ₹null or a zero that reads like a real figure.
// A HELD rate (on the device, never imported) is labelled as such: it may be a
// superseded figure seeded by an older build, and must not read like a loaded one.
let RATE_STATUS = 'none';
function rateOrMissing(v, unit) {
  if (!(typeof v === 'number' && Number.isFinite(v))) return 'not imported — Import roster';
  return RATE_STATUS === 'held' ? `₹${v}${unit} · held, not imported` : `₹${v}${unit}`;
}
export function rateStatusLine(status, cfg) {
  if (status === 'imported') return `Rate card imported (as of ${esc(String(cfg[ROSTER_STAMP]))})`;
  if (status === 'held') return 'Rates on this device were never imported and may be superseded — Import roster';
  return 'No rates loaded: pay reads ₹0 — Import roster';
}

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

// The roster import door (Director's sensitive-data rule, 24 Sep 2026): pay
// data never ships in this public repo, so each person's rate and the rate
// card arrive here, from the file soma-internal generates. Matched by worker
// id; rate fields only; unknown ids are skipped and reported, never created.
export function importRoster() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    try {
      const doc = JSON.parse(await e.target.files[0].text());
      const res = applyRosterImport({
        perm: getPermWorkers(), cw: getCWWorkers(), cfg: loadJSON(K.prodCfg, {}),
      }, doc);
      saveJSON(K.peEmp, res.perm);
      saveJSON(K.cwEmp, res.cw);
      saveJSON(K.prodCfg, res.cfg);
      // Days recorded before any rate was loaded carry a ₹0 extra / snack cost;
      // price them now (unlocked months, unpriced figures only — Janus J-H2).
      const logs = getProdLogs(); const snacks = loadJSON(K.permSnack, []);
      const rp = repriceUnpriced({ logs, snacks, areas: getAreas(), cfg: getCfg(), isLocked: isMonthLocked });
      if (rp.days) saveJSON(K.prodLog, logs);
      if (rp.snackEntries) saveJSON(K.permSnack, snacks);
      const { stats } = res;
      alert(`Roster imported${doc.asOf ? ` (as of ${doc.asOf})` : ''}: ${stats.workers} workers, ${stats.cfg} rate-card values.`
        + (stats.unknown.length ? `\nSkipped — not on this device: ${stats.unknown.join(', ')}` : '')
        + (stats.rejected.length ? `\nRejected: ${stats.rejected.join(', ')}` : '')
        + (stats.unpriced.length ? `\nStill unpriced — not in the file: ${stats.unpriced.join(', ')}` : '')
        + (rp.days || rp.snackEntries ? `\nRepriced ${rp.days} production day(s) and ${rp.snackEntries} snack entr(ies) recorded before any rate was loaded.` : '')
        + (rp.otherRateDays ? `\n${rp.otherRateDays} production day(s) in unlocked months carry extra costs priced at an older rate; kept as recorded.` : ''));
      closeSettings();
      if (typeof window.renderActiveTab === 'function') window.renderActiveTab();
      openSettings();
    } catch (err) {
      alert('Roster import failed: ' + err.message);
    }
  };
  input.click();
}

export function openSettings() {
  if (document.querySelector('.settings-overlay')) return;
  history.pushState({ popup: 'settings' }, '');

  const perm = getPermWorkers();
  const cw = getCWWorkers();
  const _settings = getSettings();
  const cfg = getCfg();
  const invCfg = getInvCfg();
  RATE_STATUS = rosterStatus(cfg, [...perm, ...cw]);

  const html = `<div class="settings-overlay" onclick="closeSettings()">
    <div class="settings-panel" onclick="event.stopPropagation()">
      <div class="flex-between" style="padding:var(--sp-12) var(--sp-16);border-bottom:1px solid var(--border)">
        <span class="card-title">Settings</span>
        <button class="header-btn" onclick="closeSettings()">✕</button>
      </div>
      <div class="settings-body">

        <div class="section-zone">
          <div class="section-label-md">General</div>
          <div class="card-info">
            <div class="settings-row"><span class="card-label">Version</span><span class="card-meta">v${APP_VERSION}</span></div>
            <div class="settings-row"><span class="card-label">Rate card</span><span class="card-meta" data-roster-status="${RATE_STATUS}">${rateStatusLine(RATE_STATUS, cfg)}</span></div>
            <div class="settings-row"><span class="card-label">CW Hour Rate</span><span class="card-meta">${rateOrMissing(cfg.hourRate, '/hr')}</span></div>
            <div class="settings-row"><span class="card-label">Snack Rate</span><span class="card-meta">${rateOrMissing(cfg.snackRate, ' per head per OT day')}</span></div>
            <div class="settings-row"><span class="card-label">Perm OT</span><span class="card-meta">min(daily, cap) ÷ 8 × ${cfg.permOtMultiplier} · cap ${rateOrMissing(cfg.permOtBaseRate, '/day')}</span></div>
            <div class="settings-row"><span class="card-label">Non-floor staff</span><span class="card-meta">(monthly ÷ days in month) ÷ shift hours (12, confirmed) · no multiplier · an option for any non-floor staff</span></div>
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
              <span class="card-meta">${w.monthlyWage ? rateOrMissing(w.monthlyWage, '/mo') : rateOrMissing(w.dailyRate, '/day')}</span>
            </div>`).join('')}
          </div>
          <button class="btn btn-secondary btn-sm mt-8" onclick="addWorkerPrompt('perm')">+ Add Perm Worker</button>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Contract Workers (${cw.filter((w) => !w.inactive).length} active)</div>
          <div class="card-info">
            ${cw.filter((w) => !w.inactive).map((w) => `<div class="settings-row">
              <span class="card-label">${esc(w.name)}</span>
              <button class="btn btn-sm" style="color:var(--danger)" onclick="toggleWorkerActive('cw','${w.id}')">Deactivate</button>
            </div>`).join('')}
            ${cw.filter((w) => w.inactive).length ? `<div class="card-meta mt-8">Inactive: ${cw.filter((w) => w.inactive).map((w) => `${w.name}${w.deactivatedOn ? ' (' + formatDateShort(w.deactivatedOn) + ')' : ''}`).join(', ')}</div>
            <div class="mt-4">${cw.filter((w) => w.inactive).map((w) => `<button class="btn btn-sm btn-secondary mt-4" onclick="toggleWorkerActive('cw','${w.id}')">Reactivate ${esc(w.name)}</button>`).join(' ')}</div>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm mt-8" onclick="addWorkerPrompt('cw')">+ Add CW Worker</button>
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
          <button class="btn btn-secondary btn-sm mt-8" onclick="editInvConfig()">Edit Invoice Config</button>
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
            <button class="btn btn-secondary btn-sm" onclick="exportData()">Export JSON</button>
            <button class="btn btn-secondary btn-sm" onclick="importData()">Import JSON</button>
            <button class="btn btn-secondary btn-sm" onclick="importRoster()">Import roster</button>
          </div>
          <button class="btn btn-danger btn-sm mt-8 btn-full" onclick="if(confirm('Reset ALL data? This cannot be undone.')){localStorage.clear();location.reload();}">Reset All Data</button>
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
    // Non-floor staff may carry the plain monthly pay model (BM, 24 Sep 2026):
    // monthly wage ÷ days in the month ÷ shift hours, no 1.1×, off the
    // production roster. Floor staff keep a daily rate and the permanent OT rule.
    const nonFloor = confirm('Non-floor staff on a monthly wage (guard, office)?\n\nOK = monthly wage: hourly = wage ÷ days in the month ÷ shift hours, no 1.1×.\nCancel = floor worker on a daily rate.\n\nNote: the CA-approved hours exemption covers the gate only, not other staff (soma-internal T-HU).');
    const role = prompt('Role:', nonFloor ? 'Non-floor' : 'Worker');
    const workers = getPermWorkers();
    // A blank or invalid amount leaves the rate OFF the row, so Settings shows
    // "not imported" and pay reads a visible zero, never a typed-in ₹0 that
    // looks deliberate (Janus J-M1).
    const amount = (label) => {
      const v = Number(prompt(label, ''));
      return Number.isFinite(v) && v > 0 ? v : undefined;
    };
    const row = { id, name: name.trim(), role: role || (nonFloor ? 'Non-floor' : 'Worker'), inactive: false };
    if (nonFloor) {
      const shiftHours = parseInt(prompt('Standard shift (hours):', '12')) || 12;
      Object.assign(row, { shiftHours, payModel: PLAIN_PAY_MODEL });
      const monthlyWage = amount('Monthly wage (₹) — leave blank to import it:');
      if (monthlyWage) row.monthlyWage = monthlyWage;
    } else {
      const dailyRate = amount('Daily rate (₹) — leave blank to import it:');
      if (dailyRate) row.dailyRate = dailyRate;
    }
    workers.push(row);
    if (!row.monthlyWage && !row.dailyRate) {
      alert(`${row.name} added with no rate. Pay reads ₹0 until a rate is set or imported.`);
    }
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
