// Invoice detail overlay — read-only view + payment-mark actions.

import { saveJSON } from '../shared/storage/storage.js';
import { K } from '../shared/storage/keys.js';
import { getClients, getInvoices, getInvCfg } from '../shared/storage/invoice.js';
import { formatCurrency } from '../shared/utils/currency.js';
import { formatDate, formatDateShort } from '../shared/utils/date.js';
import { getState } from '../shared/storage/state.js';
import { esc } from '../shared/utils/format.js';
import { da, overlayClose } from '../shared/utils/dom.js';

export function viewInvoice(invId) {
  const invoices = getInvoices();
  const inv = invoices.find((i) => i.id === invId);
  if (!inv) return;
  history.pushState({ popup: 'invoice' }, '');
  const client = getClients().find((c) => c.id === inv.clientId);
  const cfg = getInvCfg();

  const linesHtml = inv.lineItems.map((li) =>
    `<div class="worker-row">
      <div class="worker-info">
        <div class="worker-name">${esc(li.desc)}</div>
        <div class="worker-detail">${li.qty} ${li.unit} × ₹${li.rate}/${li.unit}</div>
      </div>
      <div class="text-right"><div class="card-title ff-mono">${formatCurrency(li.amount)}</div></div>
    </div>`).join('');

  const payClass = inv.payStatus === 'paid' ? 'badge-attend' : inv.payStatus === 'partial' ? 'badge-warning' : 'badge-absent';
  const payLabel = inv.payStatus === 'paid' ? 'Paid' : inv.payStatus === 'partial' ? 'Partial' : 'Unpaid';

  const html = `<div class="settings-overlay" ${overlayClose('closeInvDetail')}>
    <div class="settings-panel">
      <div class="flex-between" style="padding:var(--sp-12) var(--sp-16);border-bottom:1px solid var(--border)">
        <span class="card-title">Invoice Detail</span>
        <button class="header-btn" ${da('closeInvDetail')}>✕</button>
      </div>
      <div class="settings-body">
        <div class="section-zone">
          <div class="card-hero">
            <div class="card-label">${esc(cfg.companyName)}</div>
            <div class="card-value-xl text-cost mt-4">${esc(inv.invNo)}</div>
            <div class="card-meta mt-8">${formatDate(inv.date)}</div>
          </div>
        </div>
        <div class="section-zone">
          <div class="section-label">Bill To</div>
          <div class="card-base">
            <div class="card-title">${esc(client?.name || inv.clientName)}</div>
            <div class="card-meta mt-4">GSTIN: ${esc(inv.clientGstin || '—')}</div>
            <div class="card-meta">SAC: ${esc(inv.sac)} | ${inv.supplyType === 'inter' ? 'Inter-state' : 'Intra-state'}</div>
          </div>
        </div>
        <div class="section-zone">
          <div class="section-label">Line Items</div>
          <div class="card-action">${linesHtml}</div>
        </div>
        <div class="section-zone">
          <div class="section-label">Tax Summary</div>
          <div class="card-base">
            <div class="flex-between"><span class="card-label">Taxable Value</span><span class="card-title ff-mono">${formatCurrency(inv.taxableValue)}</span></div>
            ${inv.cgst ? `<div class="flex-between mt-4"><span class="card-label">CGST @${cfg.gstRate / 2}%</span><span class="card-title ff-mono">${formatCurrency(inv.cgst)}</span></div>` : ''}
            ${inv.sgst ? `<div class="flex-between mt-4"><span class="card-label">SGST @${cfg.gstRate / 2}%</span><span class="card-title ff-mono">${formatCurrency(inv.sgst)}</span></div>` : ''}
            ${inv.igst ? `<div class="flex-between mt-4"><span class="card-label">IGST @${cfg.gstRate}%</span><span class="card-title ff-mono">${formatCurrency(inv.igst)}</span></div>` : ''}
            <div class="flex-between mt-8" style="border-top:1px solid var(--border);padding-top:var(--sp-8)">
              <span class="card-title">Total</span><span class="card-value text-cost">${formatCurrency(inv.total)}</span>
            </div>
          </div>
        </div>
        <div class="section-zone">
          <div class="flex-between">
            <span class="badge ${payClass}">${payLabel}</span>
            ${inv.payStatus !== 'paid' ? `<div class="flex-center gap-4">
              <button class="btn btn-secondary btn-sm" ${da('markInvPartial', inv.id)}>Partial</button>
              <button class="btn btn-attend btn-sm" ${da('markInvPaid', inv.id)}>Mark Paid</button>
            </div>` : `<span class="card-meta">Paid on ${inv.payDate || '—'}</span>`}
          </div>
        </div>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

export function closeInvDetail() {
  const el = document.querySelector('.settings-overlay');
  if (el) el.remove();
}

export function markInvPaid(invId) {
  const invoices = getInvoices();
  const inv = invoices.find((i) => i.id === invId);
  if (!inv) return;
  inv.payStatus = 'paid';
  inv.payDate = formatDateShort(getState().today);
  inv.payAmount = inv.total;
  saveJSON(K.invoices, invoices);
  closeInvDetail();
  if (typeof window.renderInvoice === 'function') window.renderInvoice();
}

export function markInvPartial(invId) {
  const invoices = getInvoices();
  const inv = invoices.find((i) => i.id === invId);
  if (!inv) return;
  const amt = prompt(`Amount received (of ${formatCurrency(inv.total)}):`);
  if (!amt) return;
  const amount = parseInt(amt);
  if (isNaN(amount) || amount <= 0) return;
  inv.payStatus = amount >= inv.total ? 'paid' : 'partial';
  inv.payDate = formatDateShort(getState().today);
  inv.payAmount = amount;
  saveJSON(K.invoices, invoices);
  closeInvDetail();
  if (typeof window.renderInvoice === 'function') window.renderInvoice();
}
