// Finance tab — daily/monthly cost snapshot, CW Weekly + Perm Monthly
// pay cards, advance recording, month-close lock UI.

import { loadJSON, saveJSON } from '../../shared/storage/storage.js';
import { K } from '../../shared/storage/keys.js';
import { getState } from '../../shared/storage/state.js';
import { sepRound, formatCurrency } from '../../shared/utils/currency.js';
import { getWeekEnd, formatDateShort } from '../../shared/utils/date.js';
import { monthOf } from '../../shared/utils/month.js';
import { isMonthLocked, requireUnlocked, getMonthLocks } from '../../shared/storage/lock.js';
import { getAttKey, calcDayWages, calcMonthWages, calcCWWeeklyPay, calcPermMonthlyPay } from '../../shared/utils/payroll.js';
import { getActiveCW, getActivePermProd, getGuards, getPermWorkers, getAllProdWorkers } from '../../shared/storage/workers.js';
import { getCfg, getProdDay, getProdLogs } from '../../shared/storage/production.js';
import { getInvoices } from '../../shared/storage/invoice.js';
import { DEF_CFG } from '../../shared/config/wage.js';
import { esc } from '../../shared/utils/format.js';
import { da } from '../../shared/utils/dom.js';

function cwWeekly(satDate) {
  return calcCWWeeklyPay({
    satDate,
    cfg: getCfg(),
    cwAtt: loadJSON(K.cwAtt, {}),
    cwAdv: loadJSON(K.cwAdv, {}),
    prodLogs: getProdLogs(),
    permSnacks: loadJSON(K.permSnack, []),
    activeCW: getActiveCW(),
  });
}

function permMonthly(date) {
  return calcPermMonthlyPay({
    date,
    today: getState().today,
    cfg: getCfg(),
    peAtt: loadJSON(K.peAtt, {}),
    peAdv: loadJSON(K.peAdv, {}),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
    guardIds: DEF_CFG.guardIds,
  });
}

function dayWages(date) {
  return calcDayWages({
    date,
    cfg: getCfg(),
    cwAtt: loadJSON(K.cwAtt, {}),
    peAtt: loadJSON(K.peAtt, {}),
    activeCW: getActiveCW(),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
  });
}

function monthWages(date) {
  return calcMonthWages({
    date, today: getState().today,
    cfg: getCfg(),
    cwAtt: loadJSON(K.cwAtt, {}),
    peAtt: loadJSON(K.peAtt, {}),
    activeCW: getActiveCW(),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
  });
}

export { dayWages as calcDayWages, cwWeekly, permMonthly };

export function renderFinance() {
  const date = getState().today;
  const dayWage = dayWages(date);
  const prod = getProdDay(date);
  const extraCost = prod?.totals?.extraCost || 0;
  const snackCost = prod?.totals?.snackCost || 0;

  document.getElementById('finCost').textContent = formatCurrency(dayWage + extraCost + snackCost);
  document.getElementById('finMonth').textContent = formatCurrency(monthWages(date));

  document.getElementById('finWage').textContent = formatCurrency(dayWage);
  document.getElementById('finExtra').textContent = formatCurrency(extraCost);
  document.getElementById('finSnack').textContent = formatCurrency(snackCost);

  // OT cost for today
  const cfg = getCfg();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  let otCost = 0;
  getActiveCW().forEach((w) => {
    const k = getAttKey('cw', w.id, date);
    const rec = cwAtt[k];
    if (rec?.otHours) otCost += sepRound(rec.otHours * cfg.hourRate);
  });
  getActivePermProd().forEach((w) => {
    const k = getAttKey('perm', w.id, date);
    const rec = peAtt[k];
    if (rec?.otHours) otCost += sepRound(rec.otHours * sepRound((cfg.permOtBaseRate / 8) * cfg.permOtMultiplier));
  });
  document.getElementById('finOT').textContent = formatCurrency(otCost);

  renderCWPayCard();
  renderPermPayCard();
  renderMonthLock();

  const exMonthEl = document.getElementById('finExportMonth');
  if (exMonthEl) {
    const month = monthOf(getState().today);
    const monthLabel = new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    exMonthEl.textContent = `Export ${monthLabel} attendance / payroll / cost data as CSV.`;
  }
}

function renderCWPayCard() {
  const satDate = getWeekEnd(getState().today);
  const data = cwWeekly(satDate);
  const el = document.getElementById('finCWCard');
  const paid = loadJSON(K.cwPay, {});
  const isPaid = paid[satDate]?.paid || false;
  const periodLocked = isMonthLocked(monthOf(satDate));

  document.getElementById('finCWWeek').textContent = `${formatDateShort(data.monDate)}–${formatDateShort(data.satDate)}`;

  let html = `<div class="card-meta mb-8">Week: ${formatDateShort(data.monDate)} – ${formatDateShort(data.satDate)}</div>`;

  // Spec A2 #2: warn — don't block — when advance > gross.
  data.workers.filter((w) => w.days > 0).forEach((w) => {
    const overAdv = w.advance > w.wage;
    const overBadge = overAdv ? ` <span class="badge badge-danger" data-over-advance title="Advance ₹${w.advance} exceeds wage ₹${w.wage}">⚠ over-advance</span>` : '';
    html += `<div class="worker-row"${overAdv ? ' data-over-advance-row' : ''}>
      <span class="worker-name">${esc(w.name)}${overBadge}</span>
      <div class="text-right">
        <div class="card-label">${w.days}d ${w.otH ? '+ ' + w.otH + 'h OT' : ''}${w.advance ? ' | Adv: ' + formatCurrency(w.advance) : ''}</div>
        <div class="card-title ff-mono${overAdv ? ' text-danger' : ''}">${formatCurrency(w.net)}</div>
      </div>
    </div>`;
  });

  const cwAdvTotal = data.workers.reduce((s, w) => s + w.advance, 0);

  html += `<div class="mt-8" style="border-top:1px solid var(--border);padding-top:var(--sp-8)">
    <div class="flex-between"><span class="card-label">CW Wages</span><span class="card-title ff-mono">${formatCurrency(data.cwWageTotal)}</span></div>
    ${cwAdvTotal ? `<div class="flex-between mt-4"><span class="card-label">CW Advances</span><span class="card-title ff-mono text-danger">−${formatCurrency(cwAdvTotal)}</span></div>` : ''}
    ${data.extraTotal ? `<div class="flex-between mt-4"><span class="card-label">Extra (shortfall)</span><span class="card-title ff-mono text-cost">${formatCurrency(data.extraTotal)}</span></div>` : ''}
    ${data.snackTotal ? `<div class="flex-between mt-4"><span class="card-label">Snack (CW)</span><span class="card-title ff-mono">${formatCurrency(data.snackTotal)}</span></div>` : ''}
    ${data.permSnackTotal ? `<div class="flex-between mt-4"><span class="card-label">Snack (Perm)</span><span class="card-title ff-mono">${formatCurrency(data.permSnackTotal)}</span></div>` : ''}
    <div class="flex-between mt-8"><span class="card-title">Total</span><span class="card-value text-cost">${formatCurrency(data.grandTotal)}</span></div>
  </div>`;

  html += `<div class="flex-center gap-8 mt-12">`;
  if (periodLocked) {
    html += `<span class="badge badge-warning" data-cw-pay-locked>🔒 Week is in a locked month</span>`;
  } else if (!isPaid) {
    html += `<button class="btn btn-secondary" ${da('recordCWAdvance', satDate)}>Record Advance</button>
      <button class="btn btn-primary" style="flex:1" ${da('markCWPaid', satDate, data.grandTotal)}>Mark as Paid (${formatCurrency(data.grandTotal)})</button>`;
  } else {
    html += `<span class="badge badge-attend">Paid on ${paid[satDate].date}</span>`;
  }
  html += `<button class="btn btn-secondary" ${da('printCWPay')}>Print</button></div>`;

  el.innerHTML = html;
}

export function recordCWAdvance(satDate) {
  if (requireUnlocked(monthOf(satDate), 'CW advance')) return;
  const cw = getActiveCW();
  const names = cw.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
  const choice = prompt('Select CW worker number:\n' + names);
  if (!choice) return;
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= cw.length) { alert('Invalid selection.'); return; }
  const worker = cw[idx];
  const amt = prompt(`Enter advance amount for ${worker.name} (₹):`);
  if (!amt) return;
  const amount = parseInt(amt);
  if (isNaN(amount) || amount <= 0) { alert('Invalid amount.'); return; }

  const cwAdv = loadJSON(K.cwAdv, {});
  const advKey = `${worker.id}_${satDate}`;
  cwAdv[advKey] = (cwAdv[advKey] || 0) + amount;
  saveJSON(K.cwAdv, cwAdv);

  // Log to today's production timeline.
  const today = getState().today;
  let prod = getProdDay(today);
  if (!prod) {
    // initProdDay imported lazily to avoid a Layer 5↔Layer 5 cycle.
    prod = (window.initProdDay ? window.initProdDay() : { timeline: [] });
  }
  prod.timeline = prod.timeline || [];
  prod.timeline.push({
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    type: 'advance',
    text: `CW Advance ₹${amount} for ${worker.name} (week ${formatDateShort(satDate)})`,
  });
  // Save through production storage helper
  if (window.saveProdDay) window.saveProdDay(today, prod);

  renderFinance();
}

export function markCWPaid(satDate, amount) {
  if (requireUnlocked(monthOf(satDate), 'CW pay')) return;
  const paid = loadJSON(K.cwPay, {});
  paid[satDate] = { paid: true, amount: sepRound(amount), date: formatDateShort(getState().today) };
  saveJSON(K.cwPay, paid);
  renderFinance();
}

function renderPermPayCard() {
  const data = permMonthly(getState().today);
  const el = document.getElementById('finPermCard');
  const paid = loadJSON(K.pePay, {});
  const isPaid = paid[data.month]?.paid || false;
  const periodLocked = isMonthLocked(data.month);

  const monthLabel = new Date(data.month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  document.getElementById('finPermMonth').textContent = monthLabel;

  let html = `<div class="card-meta mb-8">${monthLabel} (up to today)</div>`;

  data.workers.filter((w) => w.days > 0).forEach((w) => {
    const gross = w.basePay + w.otPay;
    const overAdv = w.advance > gross;
    const overBadge = overAdv ? ` <span class="badge badge-danger" data-over-advance title="Advance ₹${w.advance} exceeds gross ₹${gross}">⚠ over-advance</span>` : '';
    html += `<div class="worker-row"${overAdv ? ' data-over-advance-row' : ''}>
      <div class="worker-info">
        <span class="worker-name">${esc(w.name)}${overBadge}</span>
        <span class="worker-detail">${esc(w.role || '')} — ${w.days}d${w.otH ? ' +' + w.otH + 'h OT' : ''}</span>
      </div>
      <div class="text-right">
        <div class="card-label">${w.advance ? 'Adv: ' + formatCurrency(w.advance) : ''}</div>
        <div class="card-title ff-mono${overAdv ? ' text-danger' : ''}">${formatCurrency(w.total)}</div>
      </div>
    </div>`;
  });

  html += `<div class="mt-8" style="border-top:1px solid var(--border);padding-top:var(--sp-8)">
    <div class="flex-between"><span class="card-title">Total</span><span class="card-value text-cost">${formatCurrency(data.grandTotal)}</span></div>
  </div>`;

  html += `<div class="flex-center gap-8 mt-12">`;
  if (periodLocked) {
    html += `<span class="badge badge-warning" data-perm-pay-locked>🔒 ${data.month} is locked</span>`;
  } else if (!isPaid) {
    html += `<button class="btn btn-secondary" ${da('recordAdvance')}>Record Advance</button>
      <button class="btn btn-primary" style="flex:1" ${da('markPermPaid', data.month, data.grandTotal)}>Mark as Paid (${formatCurrency(data.grandTotal)})</button>`;
  } else {
    html += `<span class="badge badge-attend">Paid on ${paid[data.month].date}</span>`;
  }
  html += `<button class="btn btn-secondary" ${da('printPermPay')}>Print</button></div>`;

  el.innerHTML = html;
}

export function recordAdvance() {
  const today = getState().today;
  if (requireUnlocked(monthOf(today), 'Perm advance')) return;
  const perm = getActivePermProd();
  const guard = getPermWorkers().filter((w) => DEF_CFG.guardIds.includes(w.id) && !w.inactive);
  const all = [...perm, ...guard];
  const names = all.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
  const choice = prompt('Select worker number:\n' + names);
  if (!choice) return;
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= all.length) { alert('Invalid selection.'); return; }
  const worker = all[idx];

  const amt = prompt(`Enter advance amount for ${worker.name} (₹):`);
  if (!amt) return;
  const amount = parseInt(amt);
  if (isNaN(amount) || amount <= 0) { alert('Invalid amount.'); return; }

  const d = new Date(today + 'T00:00:00');
  const advKey = `${worker.id}_${d.getFullYear()}_${d.getMonth() + 1}`;
  const advances = loadJSON(K.peAdv, {});
  advances[advKey] = (advances[advKey] || 0) + amount;
  saveJSON(K.peAdv, advances);

  let prod = getProdDay(today);
  if (!prod) prod = (window.initProdDay ? window.initProdDay() : { timeline: [] });
  prod.timeline = prod.timeline || [];
  prod.timeline.push({
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    type: 'advance',
    text: `Advance ₹${amount} recorded for ${worker.name} (total: ₹${advances[advKey]})`,
  });
  if (window.saveProdDay) window.saveProdDay(today, prod);

  renderFinance();
}

export function markPermPaid(month, amount) {
  if (requireUnlocked(month, 'Perm pay')) return;
  const paid = loadJSON(K.pePay, {});
  paid[month] = { paid: true, amount: sepRound(amount), date: formatDateShort(getState().today) };
  saveJSON(K.pePay, paid);
  renderFinance();
}

// --- Month-close lock UI ---
function renderMonthLock() {
  const el = document.getElementById('finMonthLock');
  if (!el) return;
  const today = getState().today;
  const d = new Date(today + 'T00:00:00');
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const dayOfMonth = d.getDate();
  const locks = getMonthLocks();

  if (locks[month]?.locked) {
    el.innerHTML = `<div class="card-base">
      <div class="flex-between">
        <div>
          <div class="lock-badge">🔒 Month Locked</div>
          <div class="card-meta mt-4">Locked on ${locks[month].lockedAt || '—'}</div>
        </div>
        <button class="btn btn-secondary btn-sm" ${da('unlockMonth', month)}>Unlock</button>
      </div>
    </div>`;
    return;
  }

  if (dayOfMonth >= 28) {
    el.innerHTML = `<div class="card-base">
      <div class="flex-between">
        <div>
          <div class="card-title">Month-End Close</div>
          <div class="card-meta mt-4">Lock ${month} to finalize records</div>
        </div>
        <button class="btn btn-primary btn-sm" ${da('lockMonth', month)}>Lock Month</button>
      </div>
    </div>`;
  } else {
    el.innerHTML = '';
  }
}

export function lockMonth(month) {
  const data = permMonthly(month + '-15');
  const cwSat = getWeekEnd(month + '-28');
  const cwData = cwWeekly(cwSat);

  const peAtt = loadJSON(K.peAtt, {});
  const cwAtt = loadJSON(K.cwAtt, {});
  const [y, m] = month.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  let presentDays = 0; let absentDays = 0;
  const allProd = getAllProdWorkers();
  for (let i = 1; i <= dim; i++) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    allProd.forEach((w) => {
      const type = getPermWorkers().find((p) => p.id === w.id) ? 'perm' : 'cw';
      const store = type === 'perm' ? peAtt : cwAtt;
      const k = getAttKey(type, w.id, ds);
      if (store[k] && (store[k].status === 'P' || store[k].status === 'OT')) presentDays++;
      else absentDays++;
    });
  }

  const prodLogs = getProdLogs();
  let monthExtra = 0; let monthSnack = 0;
  Object.keys(prodLogs).filter((d) => d.startsWith(month)).forEach((d) => {
    monthExtra += prodLogs[d]?.totals?.extraCost || 0;
    monthSnack += prodLogs[d]?.totals?.snackCost || 0;
  });

  const invoices = getInvoices();
  const monthInvs = invoices.filter((inv) => inv.date.startsWith(month));
  const invoiceTotal = monthInvs.reduce((s, inv) => s + (inv.total || 0), 0);

  const summary = {
    permTotal: data.grandTotal,
    cwTotal: cwData.cwWageTotal,
    extraTotal: monthExtra,
    snackTotal: monthSnack,
    invoiceTotal,
    presentDays, absentDays,
  };

  const msg = `Lock ${month}?\n\nPerm wages: ${formatCurrency(summary.permTotal)}\nCW wages: ${formatCurrency(summary.cwTotal)}\nExtra cost: ${formatCurrency(summary.extraTotal)}\nSnack cost: ${formatCurrency(summary.snackTotal)}\nInvoiced: ${formatCurrency(summary.invoiceTotal)}\nPresent days: ${summary.presentDays}\nAbsent days: ${summary.absentDays}\n\nAttendance and production will become read-only for this month.`;

  if (!confirm(msg)) return;

  const locks = getMonthLocks();
  locks[month] = {
    locked: true,
    lockedAt: formatDateShort(getState().today),
    summary,
  };
  saveJSON(K.monthLock, locks);
  renderFinance();
}

export function unlockMonth(month) {
  if (!confirm(`Unlock ${month}? Records will become editable again.`)) return;
  const locks = getMonthLocks();
  delete locks[month];
  saveJSON(K.monthLock, locks);
  renderFinance();
}
