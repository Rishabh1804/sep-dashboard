// Attendance tab — list workers + mark present/absent buttons,
// disabled when the month is locked.

import { loadJSON, saveJSON } from '../../shared/storage/storage.js';
import { K } from '../../shared/storage/keys.js';
import { getState, setState } from '../../shared/storage/state.js';
import { getAttKey } from '../../shared/utils/payroll.js';
import { getActivePermProd, getActiveCW, getPermWorkers } from '../../shared/storage/workers.js';
import { DEF_CFG } from '../../shared/config/wage.js';
import { isMonthLocked, requireUnlocked } from '../../shared/storage/lock.js';
import { monthOf } from '../../shared/utils/month.js';
import { tnow } from '../../shared/utils/date.js';
import { esc } from '../../shared/utils/format.js';
import { da } from '../../shared/utils/dom.js';
import { renderHome } from './home.js';

export function renderAttendance() {
  const date = getState().today;
  const monthLocked = isMonthLocked(monthOf(date));
  const perm = getActivePermProd();
  const cw = getActiveCW();
  const guard = getPermWorkers().filter((w) => DEF_CFG.guardIds.includes(w.id) && !w.inactive);
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const list = document.getElementById('workerList');

  const filter = getState().attFilter;
  const workers = [];
  if (filter === 'all' || filter === 'perm') {
    workers.push(...perm.map((w) => ({ ...w, type: 'perm' })));
    workers.push(...guard.map((w) => ({ ...w, type: 'perm' })));
  }
  if (filter === 'all' || filter === 'cw') {
    workers.push(...cw.map((w) => ({ ...w, type: 'cw' })));
  }

  if (workers.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">👷</div>
      <div class="empty-state-text">No workers to show</div>
      <div class="empty-state-sub">Check filter or add workers in Settings</div>
    </div>`;
  } else {
    list.innerHTML = workers.map((w) => {
      const attStore = w.type === 'perm' ? peAtt : cwAtt;
      const k = getAttKey(w.type, w.id, date);
      const rec = attStore[k];
      const status = rec?.status || '';
      const otHours = rec?.otHours || 0;
      const typeCls = w.type === 'perm' ? 'badge-perm' : 'badge-cw';
      const typeLabel = w.type === 'perm' ? 'P' : 'C';

      const otBadge = otHours > 0 ? `<span class="badge badge-warning">OT ${otHours}h</span>` : '';

      const statusBadge = monthLocked
        ? `<span class="badge ${status === 'A' ? 'badge-danger' : (status ? 'badge-attend' : 'badge-perm')}" data-attendance-locked-status>${status === 'A' ? 'Absent' : (status ? 'Present' : '—')}</span>`
        : `<button class="mark-btn present ${status === 'P' || status === 'OT' ? 'active' : ''}"
                  ${da('markAtt', w.id, w.type, 'P')}>✓</button>
          <button class="mark-btn absent ${status === 'A' ? 'active' : ''}"
                  ${da('markAtt', w.id, w.type, 'A')}>✗</button>`;

      return `<div class="worker-row">
        <div class="worker-avatar">${esc(w.name).charAt(0)}</div>
        <div class="worker-info">
          <div class="worker-name">${esc(w.name)} <span class="badge ${typeCls}">${typeLabel}</span> ${otBadge}</div>
          <div class="worker-detail">${esc(w.role || 'Contract Worker')}</div>
        </div>
        <div class="worker-status">${statusBadge}</div>
      </div>`;
    }).join('');
  }

  if (monthLocked) {
    list.insertAdjacentHTML('afterbegin',
      `<div class="alert-banner alert-info" data-attendance-locked-banner>🔒 ${monthOf(date)} is locked — attendance is read-only.</div>`);
  }

  let permP = 0; let cwP = 0;
  perm.forEach((w) => { const k = getAttKey('perm', w.id, date); if (peAtt[k] && (peAtt[k].status === 'P' || peAtt[k].status === 'OT')) permP++; });
  guard.forEach((w) => { const k = getAttKey('perm', w.id, date); if (peAtt[k] && (peAtt[k].status === 'P' || peAtt[k].status === 'OT')) permP++; });
  cw.forEach((w) => { const k = getAttKey('cw', w.id, date); if (cwAtt[k] && (cwAtt[k].status === 'P' || cwAtt[k].status === 'OT')) cwP++; });

  document.getElementById('attPresent').textContent = permP + cwP;
  document.getElementById('attPermBadge').textContent = `Perm: ${permP}`;
  document.getElementById('attCWBadge').textContent = `CW: ${cwP}`;
}

export function markAtt(workerId, type, status) {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'attendance changes')) return;
  const storeKey = type === 'perm' ? K.peAtt : K.cwAtt;
  const att = loadJSON(storeKey, {});
  const k = getAttKey(type, workerId, date);

  if (att[k] && att[k].status === status) {
    delete att[k];
  } else {
    att[k] = { status, time: tnow(), otHours: 0 };
  }
  saveJSON(storeKey, att);
  renderAttendance();
  if (getState().currentTab === 'home') renderHome();
}

export function initAttendanceFilter() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn || !btn.closest('#tab-attendance')) return;
    setState({ attFilter: btn.dataset.filter });
    btn.closest('.flex-center').querySelectorAll('.nb').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderAttendance();
  });
}
