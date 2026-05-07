// New-invoice modal — bottom-sheet with client/date/line-items form
// + live tax preview. Tests bypass UI by setting input values then
// calling submitInvoiceForm() directly.

import { saveJSON } from '../shared/storage/storage.js';
import { K } from '../shared/storage/keys.js';
import { getState } from '../shared/storage/state.js';
import { getClients, getRates, getInvCfg, getInvoices, getClientRates, genInvNumber } from '../shared/storage/invoice.js';
import { sepRound, formatCurrency } from '../shared/utils/currency.js';
import { tnow } from '../shared/utils/date.js';
import { esc } from '../shared/utils/format.js';
import { da, overlayClose } from '../shared/utils/dom.js';

export function openInvoiceModal() {
  const clients = getClients().filter((c) => !c.inactive);
  if (clients.length === 0) {
    alert('Add a client first (go to Clients tab).');
    return;
  }

  const clientOpts = clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  const html = `<div class="inv-modal-overlay" id="invModalOverlay" ${overlayClose('closeInvModal')}>
    <div class="inv-modal">
      <div class="flex-between mb-16">
        <div class="card-title" style="font-size:var(--fs-lg)">New Invoice</div>
        <button class="header-btn" ${da('closeInvModal')} style="font-size:var(--fs-lg)">✕</button>
      </div>

      <div class="form-group">
        <label>Client</label>
        <select id="invFormClient" onchange="onInvClientChange()">
          <option value="">— Select client —</option>
          ${clientOpts}
        </select>
      </div>

      <div class="form-group">
        <label>Invoice Date</label>
        <input type="date" id="invFormDate" value="${getState().today}">
      </div>

      <div class="form-group">
        <label>Line Items</label>
        <div id="invFormLines"></div>
        <button class="btn btn-secondary btn-sm mt-8" ${da('addInvLine')}>+ Add Line</button>
      </div>

      <div class="inv-tax-preview" id="invTaxPreview">
        <div class="card-meta">Select a client and add items to see totals</div>
      </div>

      <div class="flex-center gap-8 mt-16">
        <button class="btn btn-secondary" style="flex:1" ${da('closeInvModal')}>Cancel</button>
        <button class="btn btn-primary" style="flex:2" ${da('submitInvoiceForm')}>Create Invoice</button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  addInvLine();
}

export function closeInvModal() {
  const el = document.getElementById('invModalOverlay');
  if (el) el.remove();
}

export function onInvClientChange() {
  const clientId = document.getElementById('invFormClient').value;
  if (!clientId) return;
  const lines = document.querySelectorAll('.inv-line-item');
  lines.forEach((line) => {
    const sel = line.querySelector('.inv-rate-select');
    if (sel) updateRateDropdown(sel, clientId);
  });
  recalcInvPreview();
}

export function updateRateDropdown(sel, clientId) {
  const rates = getClientRates(clientId);
  let opts = '<option value="">Custom item</option>';
  rates.forEach((r) => {
    opts += `<option value="${r.id}">${esc(r.material)} — ₹${r.rate}/${r.unit}</option>`;
  });
  sel.innerHTML = opts;
}

export function addInvLine() {
  const container = document.getElementById('invFormLines');
  const clientId = document.getElementById('invFormClient').value;
  const lineNum = container.children.length + 1;
  const rates = clientId ? getClientRates(clientId) : [];

  let rateOpts = '<option value="">Custom item</option>';
  rates.forEach((r) => {
    rateOpts += `<option value="${r.id}">${esc(r.material)} — ₹${r.rate}/${r.unit}</option>`;
  });

  const lineHtml = `<div class="inv-line-item" data-line="${lineNum}">
    <div class="line-row">
      <select class="inv-rate-select" style="flex:2" onchange="onRateSelect(this)">
        ${rateOpts}
      </select>
      <input type="text" class="inv-desc" placeholder="Description" style="flex:2">
    </div>
    <div class="line-row">
      <input type="number" class="inv-qty" placeholder="Qty" step="any" min="0" style="flex:1" oninput="recalcInvPreview()">
      <input type="number" class="inv-rate" placeholder="Rate (₹)" step="any" min="0" style="flex:1" oninput="recalcInvPreview()">
      <select class="inv-unit" style="flex:1">
        <option value="kg">kg</option>
        <option value="pc">pc</option>
      </select>
    </div>
    ${lineNum > 1 ? `<div class="inv-line-remove" ${da('removeInvLine')}>Remove</div>` : ''}
  </div>`;

  container.insertAdjacentHTML('beforeend', lineHtml);
}

// Invoked from a `data-action="removeInvLine"` button on an invoice
// line. Dispatcher binds `this` to the clicked element.
export function removeInvLine() {
  this.parentElement.remove();
  recalcInvPreview();
}

export function onRateSelect(sel) {
  const line = sel.closest('.inv-line-item');
  const rateId = sel.value;
  if (!rateId) {
    line.querySelector('.inv-desc').value = '';
    line.querySelector('.inv-rate').value = '';
    return;
  }
  const r = getRates().find((x) => x.id === rateId);
  if (r) {
    line.querySelector('.inv-desc').value = r.material;
    line.querySelector('.inv-rate').value = r.rate;
    line.querySelector('.inv-unit').value = r.unit;
    recalcInvPreview();
  }
}

export function recalcInvPreview() {
  const el = document.getElementById('invTaxPreview');
  const clientId = document.getElementById('invFormClient').value;
  if (!clientId) { el.innerHTML = '<div class="card-meta">Select a client to see totals</div>'; return; }

  const client = getClients().find((c) => c.id === clientId);
  const cfg = getInvCfg();
  const isInter = client.stateCode !== cfg.stateCode;

  let taxable = 0;
  document.querySelectorAll('.inv-line-item').forEach((line) => {
    const qty = parseFloat(line.querySelector('.inv-qty').value) || 0;
    const rate = parseFloat(line.querySelector('.inv-rate').value) || 0;
    taxable += sepRound(qty * rate);
  });

  let cgst = 0; let sgst = 0; let igst = 0;
  if (isInter) { igst = sepRound(taxable * cfg.gstRate / 100); }
  else { cgst = sepRound(taxable * cfg.gstRate / 200); sgst = sepRound(taxable * cfg.gstRate / 200); }
  const total = taxable + cgst + sgst + igst;

  el.innerHTML = `<div class="flex-between"><span class="card-label">Taxable</span><span class="card-title ff-mono">${formatCurrency(taxable)}</span></div>
    ${isInter
      ? `<div class="flex-between mt-4"><span class="card-label">IGST @${cfg.gstRate}%</span><span class="card-title ff-mono">${formatCurrency(igst)}</span></div>`
      : `<div class="flex-between mt-4"><span class="card-label">CGST @${cfg.gstRate / 2}%</span><span class="card-title ff-mono">${formatCurrency(cgst)}</span></div>
         <div class="flex-between mt-4"><span class="card-label">SGST @${cfg.gstRate / 2}%</span><span class="card-title ff-mono">${formatCurrency(sgst)}</span></div>`}
    <div class="flex-between mt-8" style="border-top:1px solid var(--border);padding-top:var(--sp-8)">
      <span class="card-title">Total</span><span class="card-value text-cost">${formatCurrency(total)}</span>
    </div>
    <div class="card-meta mt-4">${isInter ? 'Inter' : 'Intra'}-state supply</div>`;
}

export function submitInvoiceForm() {
  const clientId = document.getElementById('invFormClient').value;
  if (!clientId) { alert('Please select a client.'); return; }

  const invDate = document.getElementById('invFormDate').value;
  if (!invDate) { alert('Please select a date.'); return; }

  const client = getClients().find((c) => c.id === clientId);
  const cfg = getInvCfg();
  const isInter = client.stateCode !== cfg.stateCode;

  const lineItems = [];
  document.querySelectorAll('.inv-line-item').forEach((line) => {
    const desc = line.querySelector('.inv-desc').value.trim();
    const qty = parseFloat(line.querySelector('.inv-qty').value) || 0;
    const rate = parseFloat(line.querySelector('.inv-rate').value) || 0;
    const unit = line.querySelector('.inv-unit').value;
    if (desc && qty > 0 && rate > 0) {
      lineItems.push({ desc, unit, rate, qty, amount: sepRound(qty * rate) });
    }
  });

  if (lineItems.length === 0) { alert('Add at least one valid line item.'); return; }

  const taxableValue = lineItems.reduce((s, li) => s + li.amount, 0);
  let cgst = 0; let sgst = 0; let igst = 0;
  if (isInter) { igst = sepRound(taxableValue * cfg.gstRate / 100); }
  else { cgst = sepRound(taxableValue * cfg.gstRate / 200); sgst = sepRound(taxableValue * cfg.gstRate / 200); }
  const total = taxableValue + cgst + sgst + igst;

  // Generate invoice number using the invoice's date for FY calculation
  // (not today). Restore state.today afterward.
  const state = getState();
  const origToday = state.today;
  state.today = invDate;
  const invNo = genInvNumber();
  state.today = origToday;

  // Spec A2 #1: warn-don't-block on duplicate invoice numbers.
  const existingInv = getInvoices().find((i) => i.invNo === invNo);
  if (existingInv && !confirm(`⚠ Invoice ${invNo} already exists (${existingInv.clientName || '?'}, ${existingInv.date}, total ${formatCurrency(existingInv.total || 0)}).\n\nSave anyway with the same number?`)) return;

  if (!confirm(`Create invoice ${invNo} for ${client.name}?\n\nItems: ${lineItems.length}\nTaxable: ${formatCurrency(taxableValue)}\nTotal: ${formatCurrency(total)}`)) return;

  const inv = {
    id: 'inv_' + Date.now().toString(36),
    invNo,
    date: invDate,
    clientId: client.id,
    clientName: client.name,
    clientGstin: client.gstin,
    sac: cfg.sac,
    lineItems,
    taxableValue,
    cgst, sgst, igst,
    total,
    supplyType: isInter ? 'inter' : 'intra',
    payStatus: 'unpaid',
    payDate: null,
    payAmount: 0,
    createdAt: tnow(),
  };
  const invoices = getInvoices();
  invoices.push(inv);
  saveJSON(K.invoices, invoices);

  cfg.nextNumber = (cfg.nextNumber || 1) + 1;
  saveJSON(K.invCfg, cfg);

  closeInvModal();
  if (typeof window.renderInvoice === 'function') window.renderInvoice();
}
