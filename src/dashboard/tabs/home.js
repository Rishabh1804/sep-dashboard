// Home tab — top-level KPIs + alert banners.

import { loadJSON } from '../../shared/storage/storage.js';
import { K } from '../../shared/storage/keys.js';
import { getState } from '../../shared/storage/state.js';
import { getAttKey, calcDayWages } from '../../shared/utils/payroll.js';
import { getActivePermProd, getActiveCW, getAllProdWorkers, getGuards } from '../../shared/storage/workers.js';
import { getProdDay, getCfg } from '../../shared/storage/production.js';
import { getStock } from '../../shared/storage/stock.js';
import { isMonthLocked } from '../../shared/storage/lock.js';
import { isSunday } from '../../shared/utils/date.js';
import { monthOf } from '../../shared/utils/month.js';
import { formatCurrency } from '../../shared/utils/currency.js';
import { getCWPayDueAlerts, getAttendancePatternAlerts } from '../../components/alerts.js';

export function renderHome() {
  const date = getState().today;
  const allW = getAllProdWorkers();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});

  let permP = 0; let cwP = 0;
  getActivePermProd().forEach((w) => {
    const k = getAttKey('perm', w.id, date);
    if (peAtt[k] && (peAtt[k].status === 'P' || peAtt[k].status === 'OT')) permP++;
  });
  getActiveCW().forEach((w) => {
    const k = getAttKey('cw', w.id, date);
    if (cwAtt[k] && (cwAtt[k].status === 'P' || cwAtt[k].status === 'OT')) cwP++;
  });
  const totalP = permP + cwP;

  const prod = getProdDay(date);
  const totalPieces = prod?.totals?.pieces || 0;
  const areasActive = prod
    ? Object.values(prod.periods?.standard?.areas || {}).filter((a) => a.cap > 0).length
    : 0;

  const wageCost = calcDayWages({
    date,
    cfg: getCfg(),
    cwAtt, peAtt,
    activeCW: getActiveCW(),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
  });

  document.getElementById('homePresent').textContent = totalP;
  document.getElementById('homePresentDetail').textContent = `of ${allW.length} workers present`;
  document.getElementById('homeProd').textContent = totalPieces || '—';
  document.getElementById('homePerm').textContent = permP;
  document.getElementById('homeCW').textContent = cwP;
  document.getElementById('homeCost').textContent = formatCurrency(wageCost);
  document.getElementById('homeAreas').textContent = areasActive;

  renderHomeAlerts(date, totalP, allW.length);
}

function renderHomeAlerts(date, present, total) {
  const el = document.getElementById('homeAlerts');
  const alerts = [];

  if (present > 0 && present < total * 0.7) {
    alerts.push(`<div class="alert-banner alert-warning">⚠ Low attendance: ${present}/${total} workers present</div>`);
  }

  alerts.push(...getCWPayDueAlerts());
  alerts.push(...getAttendancePatternAlerts());

  const stock = getStock();
  const lowStock = stock.filter((s) => s.qty > 0 && s.qty <= s.threshold);
  if (lowStock.length) {
    alerts.push(`<div class="alert-banner alert-danger">📦 Low stock: ${lowStock.map((s) => s.name).join(', ')}</div>`);
  }

  const month = monthOf(date);
  if (isMonthLocked(month)) {
    alerts.push(`<div class="alert-banner alert-info">🔒 ${month} is locked — records are read-only</div>`);
  }

  if (isSunday(date)) {
    alerts.push(`<div class="alert-banner alert-info">📅 Sunday — Holiday shift pattern active</div>`);
  }

  if (alerts.length === 0) {
    el.innerHTML = `<div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">✓</div>
      <div class="empty-state-text">All clear</div>
      <div class="empty-state-sub">No alerts for today</div>
    </div></div>`;
  } else {
    el.innerHTML = alerts.join('');
  }
}
