// Print-friendly pay statement renderers. Each opens a child window
// with inline CSS and triggers print(). Isolated from main app DOM.

import { getWeekEnd } from '../shared/utils/date.js';
import { formatCurrency } from '../shared/utils/currency.js';
import { formatDateShort } from '../shared/utils/date.js';
import { getState } from '../shared/storage/state.js';
import { getInvCfg } from '../shared/storage/invoice.js';
import { esc } from '../shared/utils/format.js';
import { calcCWWeeklyPay, calcPermMonthlyPay } from '../shared/utils/payroll.js';
import { loadJSON } from '../shared/storage/storage.js';
import { K } from '../shared/storage/keys.js';
import { DEF_CFG } from '../shared/config/wage.js';
import { getActiveCW, getActivePermProd, getGuards, getPermWorkers } from '../shared/storage/workers.js';
import { getCfg, getProdLogs } from '../shared/storage/production.js';

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

const PRINT_CSS = `body{font-family:Arial,sans-serif;padding:20px;color:#000} .print-header{text-align:center;border-bottom:2px solid #000;padding-bottom:8pt;margin-bottom:12pt} .print-footer{margin-top:24pt;border-top:1px solid #999;padding-top:8pt} .print-sig{display:flex;justify-content:space-between;margin-top:32pt} .print-sig div{border-top:1px solid #000;padding-top:4pt;width:30%;text-align:center;font-size:9pt}`;

export function printCWPay() {
  const satDate = getWeekEnd(getState().today);
  const data = cwWeekly(satDate);
  const cfg = getInvCfg();

  let html = `<div class="print-header"><h2>${esc(cfg.companyName)}</h2>
    <p>CW Weekly Pay — ${formatDateShort(data.monDate)} to ${formatDateShort(data.satDate)}</p></div>`;
  html += '<table style="width:100%;border-collapse:collapse;font-size:10pt;margin-top:12pt">';
  html += '<tr style="border-bottom:2px solid #000"><th style="text-align:left;padding:4pt">Name</th><th>Days</th><th>OT Hrs</th><th>Gross</th><th>Advance</th><th style="text-align:right">Net</th></tr>';
  data.workers.filter((w) => w.days > 0).forEach((w) => {
    html += `<tr style="border-bottom:1px solid #ccc"><td style="padding:4pt">${esc(w.name)}</td><td style="text-align:center">${w.days}</td><td style="text-align:center">${w.otH || 0}</td><td style="text-align:right;font-family:monospace">${formatCurrency(w.wage)}</td><td style="text-align:right;font-family:monospace">${w.advance ? formatCurrency(w.advance) : '—'}</td><td style="text-align:right;font-family:monospace;font-weight:600">${formatCurrency(w.net)}</td></tr>`;
  });
  const advTotal = data.workers.reduce((s, w) => s + w.advance, 0);
  html += `<tr style="border-top:2px solid #000;font-weight:700"><td colspan="3" style="padding:4pt">Total</td><td style="text-align:right;font-family:monospace">${formatCurrency(data.cwWageTotal)}</td><td style="text-align:right;font-family:monospace">${formatCurrency(advTotal)}</td><td style="text-align:right;font-family:monospace">${formatCurrency(data.grandTotal)}</td></tr>`;
  html += '</table>';
  if (data.extraTotal) html += `<p style="font-size:9pt;margin-top:8pt">Extra (shortfall): ${formatCurrency(data.extraTotal)} | Snack: ${formatCurrency(data.snackTotal + data.permSnackTotal)}</p>`;
  html += `<div class="print-footer"><div class="print-sig"><div>Prepared By</div><div>Verified By</div><div>Approved By</div></div></div>`;

  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) { alert('Popup blocked.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>CW Pay - ${data.satDate}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.print();
}

export function printPermPay() {
  const data = permMonthly(getState().today);
  const cfg = getInvCfg();
  const monthLabel = new Date(data.month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  let html = `<div class="print-header"><h2>${esc(cfg.companyName)}</h2>
    <p>Permanent Staff Monthly Pay — ${monthLabel}</p></div>`;
  html += '<table style="width:100%;border-collapse:collapse;font-size:10pt;margin-top:12pt">';
  html += '<tr style="border-bottom:2px solid #000"><th style="text-align:left;padding:4pt">Name</th><th>Role</th><th>Days</th><th>OT Hrs</th><th>Base</th><th>OT Pay</th><th>Advance</th><th style="text-align:right">Net</th></tr>';
  data.workers.filter((w) => w.days > 0).forEach((w) => {
    html += `<tr style="border-bottom:1px solid #ccc"><td style="padding:4pt">${esc(w.name)}</td><td style="font-size:9pt">${esc(w.role || '')}</td><td style="text-align:center">${w.days}</td><td style="text-align:center">${w.otH || 0}</td><td style="text-align:right;font-family:monospace">${formatCurrency(w.basePay)}</td><td style="text-align:right;font-family:monospace">${formatCurrency(w.otPay)}</td><td style="text-align:right;font-family:monospace">${w.advance ? formatCurrency(w.advance) : '—'}</td><td style="text-align:right;font-family:monospace;font-weight:600">${formatCurrency(w.total)}</td></tr>`;
  });
  html += `<tr style="border-top:2px solid #000;font-weight:700"><td colspan="7" style="padding:4pt">Total</td><td style="text-align:right;font-family:monospace">${formatCurrency(data.grandTotal)}</td></tr>`;
  html += '</table>';
  html += `<div class="print-footer"><div class="print-sig"><div>Prepared By</div><div>Verified By</div><div>Approved By</div></div></div>`;

  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) { alert('Popup blocked.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Perm Pay - ${data.month}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.print();
}

// Suppress lint about unused import (used implicitly via templates).
void getPermWorkers;
