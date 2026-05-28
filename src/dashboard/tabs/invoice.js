// Invoice tab — three sub-tabs: list, clients, GST register.
// Hosts invoice client/rate-card CRUD and the GST month register.

import { saveJSON } from '../../shared/storage/storage.js';
import { K } from '../../shared/storage/keys.js';
import { getState, setState } from '../../shared/storage/state.js';
import { formatCurrency } from '../../shared/utils/currency.js';
import { formatDateShort } from '../../shared/utils/date.js';
import { csvDownload } from '../../shared/utils/csv.js';
import { esc } from '../../shared/utils/format.js';
import { da } from '../../shared/utils/dom.js';
import { getClients, getRates, getInvoices, getInvCfg, getClientRates } from '../../shared/storage/invoice.js';

export function renderInvoice() {
  const invoices = getInvoices();
  const clients = getClients();
  const invMonth = getState().invMonth;

  const monthInvs = invoices.filter((inv) => inv.date.startsWith(invMonth));
  const monthTotal = monthInvs.reduce((s, inv) => s + (inv.total || 0), 0);
  const unpaid = invoices.filter((inv) => inv.payStatus === 'unpaid');
  const unpaidTotal = unpaid.reduce((s, inv) => s + (inv.total || 0), 0);

  document.getElementById('invMonthTotal').textContent = formatCurrency(monthTotal);
  document.getElementById('invMonthCount').textContent = `${monthInvs.length} invoices`;
  document.getElementById('invReceivables').textContent = formatCurrency(unpaidTotal);
  document.getElementById('invReceivableCount').textContent = `${unpaid.length} unpaid`;

  const panel = document.getElementById('invSubPanel');
  switch (getState().invTab) {
    case 'list':    renderInvList(panel, invoices, clients); break;
    case 'clients': renderClientList(panel, clients); break;
    case 'gst':     renderGSTRegister(panel, invoices, clients); break;
  }
}

function renderInvList(el, invoices, clients) {
  if (invoices.length === 0) {
    el.innerHTML = `<div class="section-zone">
      <div class="card-info"><div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <div class="empty-state-text">No invoices yet</div>
        <div class="empty-state-sub">Tap "+ New Invoice" to create one</div>
      </div></div>
    </div>`;
    return;
  }

  const sorted = [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.invNo.localeCompare(a.invNo));

  let html = '<div class="section-zone"><div class="section-label-md">Recent Invoices</div><div class="card-group">';
  sorted.slice(0, 20).forEach((inv) => {
    const client = clients.find((c) => c.id === inv.clientId);
    const payClass = inv.payStatus === 'paid' ? 'badge-attend' : inv.payStatus === 'partial' ? 'badge-warning' : 'badge-absent';
    const payLabel = inv.payStatus === 'paid' ? 'Paid' : inv.payStatus === 'partial' ? 'Partial' : 'Unpaid';
    html += `<div class="card-daily" ${da('viewInvoice', inv.id)}>
      <div class="flex-between">
        <div>
          <div class="card-title">${esc(inv.invNo)}</div>
          <div class="card-meta mt-4">${esc(client?.name || 'Unknown')} — ${formatDateShort(inv.date)}</div>
        </div>
        <div class="text-right">
          <div class="card-title ff-mono">${formatCurrency(inv.total)}</div>
          <span class="badge ${payClass} mt-4">${payLabel}</span>
        </div>
      </div>
    </div>`;
  });
  html += '</div></div>';
  el.innerHTML = html;
}

function renderClientList(el, clients) {
  let html = '<div class="section-zone"><div class="flex-between"><div class="section-label-md" style="margin-bottom:0">Clients</div>';
  html += `<button class="btn btn-secondary btn-sm" ${da('addClient')}>+ Add Client</button></div></div>`;

  if (clients.length === 0) {
    html += `<div class="section-zone"><div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">🏢</div>
      <div class="empty-state-text">No clients yet</div>
      <div class="empty-state-sub">Add clients to start invoicing</div>
    </div></div></div>`;
    el.innerHTML = html;
    return;
  }

  html += '<div class="section-zone"><div class="card-group">';
  clients.forEach((c) => {
    const rates = getClientRates(c.id);
    const supplyType = c.stateCode === getInvCfg().stateCode ? 'Intra-state' : 'Inter-state';
    html += `<div class="card-base">
      <div class="flex-between">
        <div>
          <div class="card-title">${esc(c.name)}</div>
          <div class="card-meta mt-4">GSTIN: ${esc(c.gstin || '—')} | ${supplyType}</div>
          <div class="card-meta">${c.billingPref || 'Per dispatch'} | ${rates.length} rate${rates.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="flex-center gap-4">
          <button class="btn btn-secondary btn-sm" ${da('editClientRates', c.id)}>Rates</button>
          <button class="btn btn-secondary btn-sm" ${da('editClient', c.id)}>Edit</button>
        </div>
      </div>
    </div>`;
  });
  html += '</div></div>';
  el.innerHTML = html;
}

function renderGSTRegister(el, invoices, clients) {
  const invMonth = getState().invMonth;
  let html = `<div class="section-zone">
    <div class="flex-between">
      <div class="section-label-md" style="margin-bottom:0">GST Register</div>
      <div class="flex-center gap-4">
        <button class="btn btn-secondary btn-sm" ${da('shiftGSTMonth', -1)}>← Prev</button>
        <span class="card-label ff-mono">${invMonth}</span>
        <button class="btn btn-secondary btn-sm" ${da('shiftGSTMonth', 1)}>Next →</button>
      </div>
    </div>
  </div>`;

  const monthInvs = invoices.filter((inv) => inv.date.startsWith(invMonth))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (monthInvs.length === 0) {
    html += `<div class="section-zone"><div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-text">No invoices for ${invMonth}</div>
    </div></div></div>`;
    el.innerHTML = html;
    return;
  }

  const totTaxable = monthInvs.reduce((s, inv) => s + (inv.taxableValue || 0), 0);
  const totCgst = monthInvs.reduce((s, inv) => s + (inv.cgst || 0), 0);
  const totSgst = monthInvs.reduce((s, inv) => s + (inv.sgst || 0), 0);
  const totTotal = monthInvs.reduce((s, inv) => s + (inv.total || 0), 0);

  html += `<div class="section-zone"><div class="stat-grid">
    <div class="stat-pill"><span class="stat-pill-value text-cost">${formatCurrency(totTaxable)}</span><span class="stat-pill-label">Taxable</span></div>
    <div class="stat-pill"><span class="stat-pill-value text-attend">${formatCurrency(totCgst)}</span><span class="stat-pill-label">CGST</span></div>
    <div class="stat-pill"><span class="stat-pill-value text-attend">${formatCurrency(totSgst)}</span><span class="stat-pill-label">SGST</span></div>
    <div class="stat-pill"><span class="stat-pill-value text-prod">${formatCurrency(totTotal)}</span><span class="stat-pill-label">Total</span></div>
  </div></div>`;

  html += '<div class="section-zone"><div class="card-group">';
  monthInvs.forEach((inv) => {
    const client = clients.find((c) => c.id === inv.clientId);
    const supplyType = inv.igst > 0 ? 'Inter' : 'Intra';
    html += `<div class="card-daily">
      <div class="flex-between">
        <div>
          <div class="card-label">${esc(inv.invNo)}</div>
          <div class="card-meta">${formatDateShort(inv.date)} | ${esc(client?.name || '—')} | ${supplyType}</div>
        </div>
        <div class="text-right">
          <div class="card-title ff-mono">${formatCurrency(inv.total)}</div>
          <div class="card-meta">Tax: ${formatCurrency((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0))}</div>
        </div>
      </div>
    </div>`;
  });
  html += '</div></div>';

  html += `<div class="section-zone"><button class="btn btn-secondary btn-full" ${da('exportGSTRegister')}>Export GST Register (CSV)</button></div>`;

  el.innerHTML = html;
}

export function shiftGSTMonth(delta) {
  const invMonth = getState().invMonth;
  const [y, m] = invMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  setState({ invMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  renderInvoice();
}

export function addClient() {
  const name = prompt('Client name:');
  if (!name || !name.trim()) return;
  const gstin = prompt('GSTIN (15 chars, leave blank if unknown):', '') || '';
  const stateCode = prompt('State code (20=Jharkhand, 27=Maharashtra, etc):', '20') || '20';
  const billingPref = prompt('Billing preference (per dispatch / weekly / monthly):', 'per dispatch') || 'per dispatch';

  const clients = getClients();
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36).slice(-4);
  clients.push({
    id, name: name.trim(),
    gstin: gstin.trim().toUpperCase(),
    stateCode, billingPref, inactive: false,
  });
  saveJSON(K.clients, clients);
  renderInvoice();
}

export function editClient(clientId) {
  const clients = getClients();
  const c = clients.find((x) => x.id === clientId);
  if (!c) return;
  const name = prompt('Client name:', c.name);
  if (!name) return;
  c.name = name.trim();
  c.gstin = (prompt('GSTIN:', c.gstin) || '').trim().toUpperCase();
  c.stateCode = prompt('State code:', c.stateCode) || c.stateCode;
  c.billingPref = prompt('Billing preference:', c.billingPref) || c.billingPref;
  saveJSON(K.clients, clients);
  renderInvoice();
}

export function editClientRates(clientId) {
  const clients = getClients();
  const client = clients.find((c) => c.id === clientId);
  if (!client) return;
  const rates = getRates();
  const clientRates = rates.filter((r) => r.clientId === clientId);

  const rateListText = clientRates.length
    ? clientRates.map((r, i) => `${i + 1}. ${r.material} — ₹${r.rate}/${r.unit}`).join('\n')
    : '(none)';

  const action = prompt(`Rates for ${client.name}:\n${rateListText}\n\nType:\n  "add" to add a rate\n  "del N" to delete rate N\n  or cancel`);
  if (!action) return;

  if (action.trim().toLowerCase() === 'add') {
    const material = prompt('Material type (e.g. "Hex bolts", "MS parts"):');
    if (!material) return;
    // Spec A2 #5: BLOCK duplicate (clientId, material) pairs (case-insensitive).
    const dup = clientRates.find((r) => r.material.trim().toLowerCase() === material.trim().toLowerCase());
    if (dup) {
      alert(`Rate for "${material.trim()}" already exists for ${client.name} (₹${dup.rate}/${dup.unit}). Delete the existing rate first ("del N"), then add the new one.`);
      return;
    }
    const unit = prompt('Unit (kg or pc):', 'kg') || 'kg';
    const rate = parseFloat(prompt('Rate per ' + unit + ' (₹):', '10'));
    if (isNaN(rate) || rate <= 0) { alert('Invalid rate.'); return; }
    const rateId = `${clientId}_${Date.now().toString(36).slice(-4)}`;
    rates.push({ id: rateId, clientId, material: material.trim(), unit, rate, effectiveFrom: getState().today });
    saveJSON(K.rates, rates);
  } else if (action.trim().toLowerCase().startsWith('del')) {
    const idx = parseInt(action.trim().slice(3)) - 1;
    if (isNaN(idx) || idx < 0 || idx >= clientRates.length) { alert('Invalid number.'); return; }
    const delId = clientRates[idx].id;
    const filtered = rates.filter((r) => r.id !== delId);
    saveJSON(K.rates, filtered);
  }
  renderInvoice();
}

export function editInvConfig() {
  const cfg = getInvCfg();
  const companyName = prompt('Company name:', cfg.companyName);
  if (!companyName) return;
  cfg.companyName = companyName.trim();
  cfg.gstin = (prompt('GSTIN (15 chars):', cfg.gstin) || '').trim().toUpperCase();
  cfg.stateCode = prompt('State code (20=Jharkhand):', cfg.stateCode) || cfg.stateCode;
  cfg.sac = prompt('SAC code:', cfg.sac) || cfg.sac;
  const gstRate = parseInt(prompt('GST rate %:', cfg.gstRate));
  if (!isNaN(gstRate) && gstRate > 0) cfg.gstRate = gstRate;
  cfg.seriesPrefix = prompt('Invoice series prefix:', cfg.seriesPrefix) || cfg.seriesPrefix;
  const nextNum = parseInt(prompt('Next invoice number:', cfg.nextNumber));
  if (!isNaN(nextNum) && nextNum > 0) cfg.nextNumber = nextNum;
  cfg.bankName = prompt('Bank name:', cfg.bankName || '') || '';
  cfg.bankAccount = prompt('Bank account no:', cfg.bankAccount || '') || '';
  cfg.bankIFSC = prompt('IFSC code:', cfg.bankIFSC || '') || '';
  saveJSON(K.invCfg, cfg);
  // Settings panel is open when this is invoked from there.
  if (typeof window.closeSettings === 'function') window.closeSettings();
  if (typeof window.openSettings === 'function') window.openSettings();
}

export function exportGSTRegister() {
  const invoices = getInvoices();
  const clients = getClients();
  const invMonth = getState().invMonth;
  const monthInvs = invoices.filter((inv) => inv.date.startsWith(invMonth))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (monthInvs.length === 0) { alert('No invoices for this month.'); return; }

  const headers = ['Invoice No', 'Date', 'Client Name', 'Client GSTIN', 'SAC', 'Supply Type', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total', 'Payment Status'];
  const dataRows = monthInvs.map((inv) => {
    const client = clients.find((c) => c.id === inv.clientId);
    return [
      inv.invNo, inv.date, client?.name || inv.clientName, inv.clientGstin || '',
      inv.sac, inv.supplyType === 'inter' ? 'Inter-state' : 'Intra-state',
      inv.taxableValue, inv.cgst || 0, inv.sgst || 0, inv.igst || 0, inv.total,
      inv.payStatus,
    ];
  });

  csvDownload(`SEP_GST_Register_${invMonth}.csv`, [headers, ...dataRows]);
}

export function initInvoiceSubtabHandler() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-invtab]');
    if (!btn || !btn.closest('#tab-invoice')) return;
    setState({ invTab: btn.dataset.invtab });
    btn.closest('.flex-center').querySelectorAll('.nb').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderInvoice();
  });
}
