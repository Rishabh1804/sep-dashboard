// Production tab — 3-period flow (Morning OT / Standard / Evening OT)
// with attendance lock + capacity buttons + worker picker + confirm.
//
// This is the largest tab module by volume. The pure-math helpers
// (`getReq`, `recalcExtra`, `initProdDay`) live in utils/calc-prod.js;
// this module owns view rendering and storage writes.

import { loadJSON, saveJSON } from '../../shared/storage/storage.js';
import { K } from '../../shared/storage/keys.js';
import { getState } from '../../shared/storage/state.js';
import { getAttKey } from '../../shared/utils/payroll.js';
import { getAllProdWorkers, findWorker, getGuards } from '../../shared/storage/workers.js';
import { getAreas, getCfg, getProdDay, saveProdDay } from '../../shared/storage/production.js';
import { isMonthLocked, requireUnlocked } from '../../shared/storage/lock.js';
import { monthOf } from '../../shared/utils/month.js';
import { isSunday, tnow, getWeekEnd } from '../../shared/utils/date.js';
import { formatCurrency, sepRound } from '../../shared/utils/currency.js';
import { esc } from '../../shared/utils/format.js';
import { da, overlayClose } from '../../shared/utils/dom.js';
import { initProdDay, getReq, recalcExtra } from '../../shared/utils/calc-prod.js';
import { renderHome } from './home.js';
import { markAtt } from './attendance.js';

export function renderProduction() {
  const date = getState().today;
  const monthLocked = isMonthLocked(monthOf(date));
  let prod = getProdDay(date);
  if (!prod) { prod = initProdDay(); saveProdDay(date, prod); }
  const areas = getAreas();
  const cfg = getCfg();
  document.getElementById('tab-production').setAttribute('data-month-locked', monthLocked ? 'true' : 'false');

  document.getElementById('prodTotal').textContent = prod.totals?.pieces || '—';
  const extraTotal = (prod.totals?.extraCost || 0) + (prod.totals?.snackCost || 0);
  document.getElementById('prodExtraCost').textContent = formatCurrency(extraTotal);
  const shortfall = prod.totals?.extraHours || 0;
  document.getElementById('prodExtraDetail').textContent = shortfall > 0
    ? `${shortfall}h shortfall + ${prod.totals?.snackCost ? 'snack' : 'no snack'}`
    : 'no shortfall';

  renderShiftBanner(date);
  renderProdAttendance(date, prod);
  renderProdPeriods(date, prod, areas, cfg);

  const confirmEl = document.getElementById('prodConfirmSection');
  confirmEl.style.display = (!monthLocked && prod.attLocked && !prod.confirmed) ? 'block' : 'none';

  const lockBadge = document.getElementById('prodLockBadge');
  if (prod.confirmed) { lockBadge.textContent = 'Confirmed'; lockBadge.className = 'badge badge-attend'; }
  else if (prod.attLocked) { lockBadge.textContent = 'Locked'; lockBadge.className = 'badge badge-warning'; }
  else { lockBadge.textContent = 'Unlocked'; lockBadge.className = 'badge badge-neutral'; }

  renderProdLog(date, prod);
}

function renderProdAttendance(date, prod) {
  const el = document.getElementById('prodAttSection');
  const monthLocked = isMonthLocked(monthOf(date));
  const allW = getAllProdWorkers();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});

  if (prod.attLocked) {
    const present = prod.present || [];
    const perm = present.filter((id) => findWorker(id).type === 'perm');
    const cw = present.filter((id) => findWorker(id).type === 'cw');
    el.innerHTML = `
      <div class="flex-between">
        <div>
          <div class="card-value text-attend">${present.length}</div>
          <div class="card-label">workers locked in</div>
        </div>
        <div class="flex-center gap-4">
          <span class="badge badge-perm">P: ${perm.length}</span>
          <span class="badge badge-cw">C: ${cw.length}</span>
        </div>
      </div>
      ${!prod.confirmed && !monthLocked ? `<button class="btn btn-secondary btn-sm mt-12" ${da('unlockProdAtt')}>Unlock to Edit</button>` : ''}
    `;
    return;
  }

  if (monthLocked) {
    el.innerHTML = `<div class="alert-banner alert-info" data-prod-locked-banner>🔒 ${monthOf(date)} is locked — production controls are disabled.</div>`;
    return;
  }

  let html = '<div class="period-area-card">';
  const presentIds = [];
  allW.forEach((w) => {
    const attStore = w.type === 'perm' ? peAtt : cwAtt;
    const k = getAttKey(w.type, w.id, date);
    if (attStore[k] && attStore[k].status !== 'A') presentIds.push(w.id);
  });

  html += allW.map((w) => {
    const isPresent = presentIds.includes(w.id);
    const typeCls = w.type === 'perm' ? 'badge-perm' : 'badge-cw';
    return `<div class="worker-row">
      <div class="worker-avatar">${esc(w.name).charAt(0)}</div>
      <div class="worker-info">
        <div class="worker-name">${esc(w.name)} <span class="badge ${typeCls}">${w.type === 'perm' ? 'P' : 'C'}</span></div>
      </div>
      <div class="worker-status">
        <button class="mark-btn present ${isPresent ? 'active' : ''}" ${da('markAttFromProduction', w.id, w.type, 'P')}>✓</button>
        <button class="mark-btn absent ${!isPresent && presentIds.length > 0 ? 'active' : ''}" ${da('markAttFromProduction', w.id, w.type, 'A')}>✗</button>
      </div>
    </div>`;
  }).join('');

  html += `</div>
    <button class="btn btn-primary btn-full mt-8" ${da('lockProdAtt')}>Lock Attendance (${presentIds.length} present)</button>`;
  el.innerHTML = html;
}

export function lockProdAtt() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'production lock')) return;
  let prod = getProdDay(date) || initProdDay();
  const allW = getAllProdWorkers();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});

  const present = [];
  allW.forEach((w) => {
    const attStore = w.type === 'perm' ? peAtt : cwAtt;
    const k = getAttKey(w.type, w.id, date);
    if (attStore[k] && attStore[k].status !== 'A') present.push(w.id);
  });

  if (present.length === 0) { alert('Mark at least one worker present.'); return; }

  prod.attLocked = true;
  prod.present = present;
  prod.lockedAt = tnow();

  autoAssignRosters(prod, 'standard', present);

  prod.timeline = prod.timeline || [];
  prod.timeline.push({ time: tnow(), type: 'system', text: `Attendance locked: ${present.length} workers` });

  recalcExtra(prod, getAreas(), getCfg());

  saveProdDay(date, prod);
  renderProduction();
}

export function unlockProdAtt() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'production unlock')) return;
  const prod = getProdDay(date);
  if (!prod) return;
  prod.attLocked = false;
  prod.confirmed = false;
  prod.timeline.push({ time: tnow(), type: 'system', text: 'Attendance unlocked for editing' });
  saveProdDay(date, prod);
  renderProduction();
}

function autoAssignRosters(prod, periodKey, present) {
  const areas = getAreas();
  const period = prod.periods[periodKey];
  if (!period.areas) period.areas = {};

  areas.forEach((area) => {
    if (!period.areas[area.id]) {
      period.areas[area.id] = {
        cap: periodKey === 'standard' ? (area.dep ? 0 : (area.caps[area.caps.length - 1]?.l || 0)) : 0,
        assigned: [],
      };
    }
    const pa = period.areas[area.id];
    if (pa.cap === 0 && !area.dep) return;

    const rosterPresent = area.roster.filter((id) => present.includes(id));
    pa.assigned = rosterPresent;
  });

  autoPickling(prod, periodKey);
}

function autoPickling(prod, periodKey) {
  const areas = getAreas();
  const period = prod.periods[periodKey];

  areas.filter((a) => a.dep).forEach((pa) => {
    if (!period.areas[pa.id]) period.areas[pa.id] = { cap: 0, assigned: [] };
    const depCaps = pa.depOn.map((did) => period.areas[did]?.cap || 0);
    if (depCaps.every((c) => c === 0)) {
      period.areas[pa.id].cap = 0;
      period.areas[pa.id].assigned = [];
    } else {
      const present = prod.present || [];
      period.areas[pa.id].cap = 1;
      period.areas[pa.id].assigned = pa.roster.filter((id) => present.includes(id));
    }
  });
}

function renderProdPeriods(date, prod, areas, cfg) {
  const container = document.getElementById('prodPeriodsContainer');
  if (!prod.attLocked) {
    container.innerHTML = '<div class="card-info section-zone"><div class="empty-state"><div class="empty-state-text">Lock attendance to configure production</div></div></div>';
    return;
  }

  const periods = [
    { key: 'morningOT', label: 'Morning OT',     time: `${cfg.morningOT.start}–${cfg.morningOT.end}`,           hours: cfg.morningOT.hours,     isOT: true  },
    { key: 'standard',  label: 'Standard Shift', time: `${cfg.standardShift.start}–${cfg.standardShift.end}`,   hours: cfg.standardShift.hours, isOT: false },
    { key: 'eveningOT', label: 'Evening OT',     time: `${cfg.eveningOT.start}–${cfg.eveningOT.end}`,           hours: cfg.eveningOT.hours,     isOT: true  },
  ];

  const isHolidayShift = isShiftSunday(date);

  container.innerHTML = periods.map((p) => {
    const period = prod.periods[p.key];
    const isActive = p.key === 'standard' || period?.active;

    if (!isActive && p.isOT) {
      if (isHolidayShift) {
        return `<div class="period-card">
          <div class="card-info" style="padding:var(--sp-10) var(--sp-12)">
            <div class="flex-between">
              <div>
                <span class="card-label">${p.label}</span>
                <span class="card-meta"> ${p.time}</span>
              </div>
              <button class="btn btn-sm" style="color:var(--text-muted);font-size:var(--fs-2xs)" ${da('togglePeriod', p.key, true)}>Add OT anyway</button>
            </div>
          </div>
        </div>`;
      }
      return `<div class="period-card">
        <div class="card-info" style="padding:var(--sp-10) var(--sp-12)">
          <div class="flex-between">
            <div>
              <span class="card-label">${p.label}</span>
              <span class="card-meta"> ${p.time}</span>
            </div>
            <button class="btn btn-secondary btn-sm" ${da('togglePeriod', p.key, true)}>+ Enable</button>
          </div>
        </div>
      </div>`;
    }

    let areaHtml = '';
    areas.filter((a) => !a.dep).forEach((area) => {
      const pa = period?.areas?.[area.id] || { cap: 0, assigned: [] };
      const cap = pa.cap;
      const assigned = pa.assigned || [];
      const req = getReq(area.id, p.key, prod, areas);
      const statusColor = cap === 0 ? 'text-muted' : assigned.length >= req ? 'text-attend' : 'text-danger';

      const capBtns = area.caps.map((c) =>
        `<button class="nb ${cap === c.l ? 'active' : ''}" ${da('setProdCap2', p.key, area.id, c.l)}>${c.lb}</button>`,
      ).join('');

      const workerChips = assigned.map((wid) => {
        const w = findWorker(wid);
        const cls = w.type === 'perm' ? 'badge-perm' : 'badge-cw';
        return `<span class="badge ${cls}">${esc(w.name)}</span>`;
      }).join(' ');

      areaHtml += `<div class="card-base period-area-card">
        <div class="flex-between">
          <div class="card-title">${esc(area.name)}</div>
          <span class="${statusColor} area-count ff-mono">${assigned.length}/${req}</span>
        </div>
        <div class="mt-8 chip-row">${capBtns}</div>
        <div class="mt-8 chip-row">${workerChips || '<span class="card-meta">No workers assigned</span>'}</div>
        ${cap > 0 && !prod.confirmed ? `<button class="btn btn-secondary btn-sm mt-8" ${da('openPicker', p.key, area.id)}>Edit Workers</button>` : ''}
      </div>`;
    });

    areas.filter((a) => a.dep).forEach((area) => {
      const pa = period?.areas?.[area.id] || { cap: 0, assigned: [] };
      const req = getReq(area.id, p.key, prod, areas);
      if (req === 0) return;
      const assigned = pa.assigned || [];
      const statusColor = assigned.length >= req ? 'text-attend' : 'text-danger';
      const workerChips = assigned.map((wid) => {
        const w = findWorker(wid);
        return `<span class="badge ${w.type === 'perm' ? 'badge-perm' : 'badge-cw'}">${esc(w.name)}</span>`;
      }).join(' ');

      areaHtml += `<div class="card-daily period-area-card">
        <div class="flex-between">
          <div class="card-label">${esc(area.name)}</div>
          <span class="${statusColor} area-count-sm ff-mono">${assigned.length}/${req}</span>
        </div>
        <div class="mt-4 chip-row">${workerChips || '<span class="card-meta">Auto-assigned</span>'}</div>
        ${!prod.confirmed ? `<button class="btn btn-secondary btn-sm mt-4" ${da('openPicker', p.key, area.id)}>Edit</button>` : ''}
      </div>`;
    });

    return `<div class="period-card">
      <div class="section-zone">
        <div class="flex-between mb-10">
          <div>
            <span class="section-label-md" style="margin-bottom:0;display:inline">${p.label}</span>
            <span class="card-meta"> ${p.time} (${p.hours}h)</span>
          </div>
          ${p.isOT ? `<button class="btn btn-sm" style="color:var(--danger)" ${da('togglePeriod', p.key, false)}>Disable</button>` : ''}
        </div>
        ${areaHtml}
      </div>
    </div>`;
  }).join('');
}

export function togglePeriod(periodKey, enable) {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'period toggle')) return;
  let prod = getProdDay(date) || initProdDay();
  prod.periods[periodKey].active = enable;
  if (enable) {
    prod.periods[periodKey].expanded = true;
    if (prod.present) autoAssignRosters(prod, periodKey, prod.present);
    prod.timeline.push({ time: tnow(), type: 'system', text: `${periodKey === 'morningOT' ? 'Morning' : 'Evening'} OT enabled` });
  } else {
    prod.periods[periodKey].expanded = false;
    prod.timeline.push({ time: tnow(), type: 'system', text: `${periodKey === 'morningOT' ? 'Morning' : 'Evening'} OT disabled` });
  }
  recalcExtra(prod, getAreas(), getCfg());
  saveProdDay(date, prod);
  renderProduction();
}

export function setProdCap2(periodKey, areaId, level) {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'capacity change')) return;
  let prod = getProdDay(date) || initProdDay();
  const period = prod.periods[periodKey];
  if (!period.areas) period.areas = {};
  if (!period.areas[areaId]) period.areas[areaId] = { cap: 0, assigned: [] };
  period.areas[areaId].cap = Number(level);

  autoPickling(prod, periodKey);
  recalcExtra(prod, getAreas(), getCfg());
  saveProdDay(date, prod);
  renderProduction();
}

export function showProdConfirm() {
  const date = getState().today;
  const prod = getProdDay(date);
  const present = prod.present || [];
  const perm = present.filter((id) => findWorker(id).type === 'perm');
  const cw = present.filter((id) => findWorker(id).type === 'cw');
  const extraCost = (prod.totals?.extraCost || 0) + (prod.totals?.snackCost || 0);

  const otMap = {};
  ['morningOT', 'eveningOT'].forEach((pk) => {
    const period = prod.periods[pk];
    if (!period?.active) return;
    const hours = period.hours || 3;
    const workerSet = new Set();
    Object.values(period.areas || {}).forEach((pa) => (pa.assigned || []).forEach((id) => workerSet.add(id)));
    workerSet.forEach((id) => { otMap[id] = (otMap[id] || 0) + hours; });
  });

  const html = `<div class="confirm-overlay" ${overlayClose('cancelConfirm')}>
    <div class="confirm-dialog">
      <div class="confirm-icon">✓</div>
      <div class="confirm-title">Confirm ${present.length} Workers?</div>
      <div class="confirm-desc">Attendance + OT will be written to records. Extra cost: ${formatCurrency(extraCost)}</div>
      <div class="confirm-breakdown">
        <span class="badge badge-perm">${perm.length} Perm → peAtt</span>
        <span class="badge badge-cw">${cw.length} CW → cwAtt</span>
      </div>
      ${Object.keys(otMap).length > 0 ? `<div class="card-meta mb-12">OT: ${Object.entries(otMap).map(([id, h]) => `${findWorker(id).name} ${h}h`).join(', ')}</div>` : ''}
      <div class="confirm-btns">
        <button class="btn btn-secondary" ${da('cancelConfirm')}>Cancel</button>
        <button class="btn btn-attend" ${da('confirmProduction')}>Confirm</button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

export function cancelConfirm() {
  const el = document.querySelector('.confirm-overlay');
  if (el) el.remove();
}

export function confirmProduction() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'production confirm')) return;
  const prod = getProdDay(date);
  if (!prod || !prod.present || prod.present.length === 0) {
    if (!confirm('⚠ No workers are marked present for this date.\n\nConfirm production anyway?')) return;
  }
  const cfg = getCfg();

  const otMap = {};
  ['morningOT', 'eveningOT'].forEach((pk) => {
    const period = prod.periods[pk];
    if (!period?.active) return;
    const hours = period.hours || 3;
    Object.values(period.areas || {}).forEach((pa) =>
      (pa.assigned || []).forEach((id) => { otMap[id] = (otMap[id] || 0) + hours; }),
    );
  });

  const present = prod.present || [];
  present.forEach((id) => {
    const w = findWorker(id);
    const storeKey = w.type === 'perm' ? K.peAtt : K.cwAtt;
    const att = loadJSON(storeKey, {});
    const k = getAttKey(w.type, id, date);
    att[k] = {
      status: otMap[id] ? 'OT' : 'P',
      otHours: otMap[id] || 0,
      time: prod.lockedAt || tnow(),
    };
    saveJSON(storeKey, att);
  });

  if (prod.periods.eveningOT?.active) {
    const snackLog = loadJSON(K.permSnack, []);
    const evWorkers = new Set();
    Object.values(prod.periods.eveningOT.areas || {}).forEach((pa) =>
      (pa.assigned || []).forEach((id) => evWorkers.add(id)),
    );
    prod.periods.eveningOT.workers = [...evWorkers];
    evWorkers.forEach((id) => {
      const w = findWorker(id);
      if (w.type === 'perm') {
        snackLog.push({
          empId: id, date,
          otHours: prod.periods.eveningOT.hours,
          snack: cfg.snackRate,
          week: getWeekEnd(date),
        });
      }
    });
    saveJSON(K.permSnack, snackLog);
  }

  prod.confirmed = true;
  prod.confirmedAt = tnow();
  recalcExtra(prod, getAreas(), getCfg());
  prod.timeline.push({
    time: tnow(), type: 'confirm',
    text: `Production confirmed: ${present.length} workers, OT for ${Object.keys(otMap).length}`,
  });

  saveProdDay(date, prod);
  cancelConfirm();
  renderProduction();
  if (getState().currentTab === 'home') renderHome();
}

function renderProdLog(date, prod) {
  const el = document.getElementById('prodLog');
  if (!prod || !prod.timeline || prod.timeline.length === 0) {
    el.innerHTML = `<div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-text">No entries yet</div>
      <div class="empty-state-sub">Production entries appear as you work</div>
    </div></div>`;
    return;
  }
  el.innerHTML = prod.timeline.map((entry) =>
    `<div class="card-daily">
      <div class="flex-between">
        <span class="card-label">${entry.time || ''}</span>
        <span class="card-meta">${entry.type || 'note'}</span>
      </div>
      <div class="card-title mt-4">${esc(entry.text || '')}</div>
    </div>`).join('');
}

export function logProdEntry() {
  const pieces = parseInt(document.getElementById('prodPiecesInput')?.value) || 0;
  const weight = parseFloat(document.getElementById('prodWeightInput')?.value) || 0;
  if (pieces === 0 && weight === 0) return;

  const date = getState().today;
  let prod = getProdDay(date) || initProdDay();
  prod.totals = prod.totals || { pieces: 0, weight: 0 };
  prod.totals.pieces = (prod.totals.pieces || 0) + pieces;
  prod.totals.weight = Math.round(((prod.totals.weight || 0) + weight) * 10) / 10;

  prod.timeline = prod.timeline || [];
  const parts = [];
  if (pieces) parts.push(`${pieces} pcs`);
  if (weight) parts.push(`${weight} kg`);
  prod.timeline.push({
    time: tnow(), type: 'production',
    text: `Logged: ${parts.join(' / ')} → Total: ${prod.totals.pieces} pcs / ${prod.totals.weight} kg`,
  });

  saveProdDay(date, prod);

  const pInput = document.getElementById('prodPiecesInput');
  const wInput = document.getElementById('prodWeightInput');
  if (pInput) pInput.value = '';
  if (wInput) wInput.value = '';

  renderProduction();
}

// --- Sunday / Holiday shift ---
export function isTodayHoliday() {
  const prod = getProdDay(getState().today);
  return prod?.isHoliday || false;
}

export function isShiftSunday(date) {
  return isSunday(date) || (getProdDay(date)?.isHoliday || false);
}

export function toggleHoliday() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'holiday toggle')) return;
  let prod = getProdDay(date) || initProdDay();
  prod.isHoliday = !prod.isHoliday;
  prod.timeline = prod.timeline || [];
  prod.timeline.push({
    time: tnow(), type: 'system',
    text: prod.isHoliday ? 'Marked as Holiday shift' : 'Holiday shift removed',
  });
  saveProdDay(date, prod);
  renderProduction();
}

function renderShiftBanner(date) {
  const el = document.getElementById('prodShiftBanner');
  if (!el) return;
  const cfg = getCfg();
  const sunday = isSunday(date);
  const prod = getProdDay(date);
  const holiday = prod?.isHoliday || false;
  const isSpecial = sunday || holiday;

  if (!isSpecial) { el.innerHTML = ''; return; }

  const shift = cfg.sundayHolidayShift;
  el.innerHTML = `<div class="alert-banner alert-info mb-12">
    📅 ${sunday ? 'Sunday' : 'Holiday'} shift: ${shift.start}–${shift.end} (${shift.hours}h, no lunch)
    ${!sunday ? `<button class="btn btn-sm" style="margin-left:auto;color:var(--danger)" ${da('toggleHoliday')}>Remove</button>` : ''}
  </div>`;
}

// --- FAB actions ---

export function markAllPresent() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'mark-all-present')) return;
  const allW = getAllProdWorkers();
  const guard = getGuards();

  allW.forEach((w) => {
    const storeKey = w.type === 'perm' ? K.peAtt : K.cwAtt;
    const att = loadJSON(storeKey, {});
    const k = getAttKey(w.type, w.id, date);
    if (!att[k] || att[k].status === 'A') {
      att[k] = { status: 'P', time: tnow(), otHours: 0 };
      saveJSON(storeKey, att);
    }
  });
  guard.forEach((w) => {
    const att = loadJSON(K.peAtt, {});
    const k = getAttKey('perm', w.id, date);
    if (!att[k]) {
      att[k] = { status: 'P', time: tnow(), otHours: 0 };
      saveJSON(K.peAtt, att);
    }
  });

  if (typeof window.renderTab === 'function') {
    window.renderTab(getState().currentTab);
  }
}

// Production-tab attendance row mark — toggles attendance, then
// re-renders production so the lock/unlock state reflects the change.
export function markAttFromProduction(workerId, type, status) {
  markAtt(workerId, type, status);
  renderProduction();
}

export function addProdNote() {
  const note = prompt('Add production note:');
  if (!note || !note.trim()) return;
  const date = getState().today;
  let prod = getProdDay(date) || initProdDay();
  prod.timeline = prod.timeline || [];
  prod.timeline.push({ time: tnow(), type: 'note', text: note.trim() });
  saveProdDay(date, prod);
  if (getState().currentTab === 'production') renderProduction();
}

// Suppress lint about implicit `sepRound` import (used inside calc-prod).
void sepRound;
