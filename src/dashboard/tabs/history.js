// History tab — browse past dates; locked-month banner + summary card
// when viewing dates inside a closed month.

import { loadJSON } from '../../shared/storage/storage.js';
import { K } from '../../shared/storage/keys.js';
import { getState, setState } from '../../shared/storage/state.js';
import { localDateStr, formatDate } from '../../shared/utils/date.js';
import { monthOf } from '../../shared/utils/month.js';
import { formatCurrency } from '../../shared/utils/currency.js';
import { esc } from '../../shared/utils/format.js';
import { getAttKey, calcDayWages } from '../../shared/utils/payroll.js';
import { isMonthLocked, getMonthLocks } from '../../shared/storage/lock.js';
import { getAllProdWorkers, getActiveCW, getActivePermProd, getGuards } from '../../shared/storage/workers.js';
import { getProdDay, getCfg } from '../../shared/storage/production.js';

export function renderHistory() {
  const date = getState().histDate;
  const histMonth = monthOf(date);
  const histMonthLocked = isMonthLocked(histMonth);
  const lockSummary = histMonthLocked ? (getMonthLocks()[histMonth]?.summary) : null;
  document.getElementById('histDate').textContent = formatDate(date);

  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const prod = getProdDay(date);
  const dayWage = calcDayWages({
    date,
    cfg: getCfg(),
    cwAtt, peAtt,
    activeCW: getActiveCW(),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
  });

  let present = 0;
  getAllProdWorkers().forEach((w) => {
    const attStore = w.type === 'perm' ? peAtt : cwAtt;
    const k = getAttKey(w.type, w.id, date);
    if (attStore[k] && attStore[k].status !== 'A') present++;
  });
  document.getElementById('histSummary').textContent = present > 0 ? `${present} workers` : '—';

  const el = document.getElementById('histData');
  if (present === 0 && !prod && !histMonthLocked) {
    el.innerHTML = `<div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-text">No data for this date</div>
      <div class="empty-state-sub">Navigate to a date with recorded data</div>
    </div></div>`;
    return;
  }

  let html = '';

  if (histMonthLocked) {
    const lockedAt = getMonthLocks()[histMonth]?.lockedAt || '—';
    html += `<div class="card-base" data-history-locked-card>
      <div class="flex-between">
        <div class="lock-badge">🔒 ${histMonth} Locked</div>
        <span class="card-meta">Locked on ${lockedAt}</span>
      </div>`;
    if (lockSummary) {
      html += `<div class="mt-8 stat-grid">
        <div class="stat-pill"><span class="stat-pill-value text-cost ff-mono">${formatCurrency((lockSummary.permTotal || 0) + (lockSummary.cwTotal || 0) + (lockSummary.extraTotal || 0) + (lockSummary.snackTotal || 0))}</span><span class="stat-pill-label">Month wage cost</span></div>
        <div class="stat-pill"><span class="stat-pill-value ff-mono">${formatCurrency(lockSummary.invoiceTotal || 0)}</span><span class="stat-pill-label">Invoiced</span></div>
        <div class="stat-pill"><span class="stat-pill-value text-attend ff-mono">${lockSummary.presentDays || 0}</span><span class="stat-pill-label">Present-days</span></div>
        <div class="stat-pill"><span class="stat-pill-value text-danger ff-mono">${lockSummary.absentDays || 0}</span><span class="stat-pill-label">Absent-days</span></div>
      </div>`;
    }
    html += `<div class="card-meta mt-8">Records below are read-only — edit controls suppressed for locked months.</div>
    </div>`;
  }

  html += `<div class="card-base">
    <div class="card-title">Attendance</div>
    <div class="mt-8 stat-grid">
      <div class="stat-pill"><span class="stat-pill-value text-attend">${present}</span><span class="stat-pill-label">Present</span></div>
      <div class="stat-pill"><span class="stat-pill-value text-cost">${formatCurrency(dayWage)}</span><span class="stat-pill-label">Wage Cost</span></div>
    </div>
  </div>`;

  if (prod) {
    html += `<div class="card-base mt-12">
      <div class="card-title">Production</div>
      <div class="card-label mt-8">Pieces: ${prod.totals?.pieces || 0} | Weight: ${prod.totals?.weight || 0} kg</div>
      <div class="card-meta mt-4">Extra: ${formatCurrency(prod.totals?.extraCost || 0)} | Snack: ${formatCurrency(prod.totals?.snackCost || 0)}</div>
    </div>`;
  }

  html += `<div class="card-daily mt-12">
    <div class="card-title">Worker Details</div>`;
  getAllProdWorkers().forEach((w) => {
    const attStore = w.type === 'perm' ? peAtt : cwAtt;
    const k = getAttKey(w.type, w.id, date);
    const rec = attStore[k];
    if (!rec) return;
    const typeCls = w.type === 'perm' ? 'badge-perm' : 'badge-cw';
    const statusCls = rec.status === 'A' ? 'text-danger' : 'text-attend';
    html += `<div class="worker-row">
      <span class="worker-name">${esc(w.name)} <span class="badge ${typeCls}">${w.type === 'perm' ? 'P' : 'C'}</span></span>
      <span class="${statusCls}" style="margin-left:auto">${rec.status}${rec.otHours ? ' +' + rec.otHours + 'h OT' : ''}</span>
    </div>`;
  });
  html += `</div>`;

  el.innerHTML = html;
}

export function initHistoryNav() {
  document.getElementById('histPrev')?.addEventListener('click', () => {
    const d = new Date(getState().histDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setState({ histDate: localDateStr(d) });
    renderHistory();
  });
  document.getElementById('histNext')?.addEventListener('click', () => {
    const d = new Date(getState().histDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setState({ histDate: localDateStr(d) });
    renderHistory();
  });
}
