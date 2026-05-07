// Stock tab — chemical inventory with low/out/over-limit warnings.

import { saveJSON } from '../../shared/storage/storage.js';
import { K } from '../../shared/storage/keys.js';
import { getState } from '../../shared/storage/state.js';
import { tnow } from '../../shared/utils/date.js';
import { esc } from '../../shared/utils/format.js';
import { getStock, getStockLog } from '../../shared/storage/stock.js';
import { renderHome } from './home.js';

export function renderStock() {
  const stock = getStock();
  const listEl = document.getElementById('stockList');

  const lowCount = stock.filter((s) => s.qty > 0 && s.qty <= s.threshold).length;
  const outCount = stock.filter((s) => s.qty <= 0).length;
  const overCount = stock.filter((s) => s.maxQty && s.qty > s.maxQty).length;
  const statusEl = document.getElementById('stockStatus');
  const detailEl = document.getElementById('stockDetail');
  const alertCount = lowCount + outCount + overCount;

  if (alertCount > 0) {
    statusEl.textContent = `${alertCount} item${alertCount !== 1 ? 's' : ''} need attention`;
    statusEl.className = 'card-value-xl text-danger';
    const parts = [];
    if (lowCount) parts.push(`${lowCount} low`);
    if (outCount) parts.push(`${outCount} out`);
    if (overCount) parts.push(`${overCount} over limit`);
    detailEl.textContent = parts.join(', ');
  } else {
    statusEl.textContent = 'All OK';
    statusEl.className = 'card-value-xl text-attend';
    detailEl.textContent = `${stock.length} items tracked`;
  }

  listEl.innerHTML = stock.map((item) => {
    const pct = item.threshold > 0 ? (item.qty / item.threshold) : 1;
    const isOverLimit = item.maxQty && item.qty > item.maxQty;
    const color = isOverLimit ? 'text-danger' : item.qty <= 0 ? 'text-danger' : pct <= 1 ? 'text-warn' : 'text-attend';
    const limitInfo = item.maxQty ? ` | Max: ${item.maxQty} ${item.unit}` : '';
    return `<div class="card-base">
      <div class="flex-between">
        <div>
          <div class="card-title">${esc(item.name)}</div>
          <div class="card-meta mt-4">Min: ${item.threshold} ${item.unit}${limitInfo}</div>
          ${isOverLimit ? `<div class="card-meta text-danger mt-4">⚠ Over regulatory limit</div>` : ''}
        </div>
        <div class="text-right">
          <div class="card-value ff-mono ${color}">${item.qty}</div>
          <div class="card-label">${item.unit}</div>
        </div>
      </div>
      <div class="mt-8 flex-center gap-4">
        <button class="btn btn-secondary btn-sm" onclick="updateStock('${item.id}',-1)">−</button>
        <button class="btn btn-secondary btn-sm" onclick="updateStock('${item.id}',1)">+</button>
        <button class="btn btn-secondary btn-sm" onclick="editStockQty('${item.id}')">Set</button>
      </div>
    </div>`;
  }).join('');
}

export function updateStock(itemId, delta) {
  const stock = getStock();
  const item = stock.find((s) => s.id === itemId);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  saveJSON(K.stock, stock);

  const log = getStockLog();
  log.push({
    id: itemId, name: item.name, delta,
    newQty: item.qty, date: getState().today, time: tnow(),
  });
  saveJSON(K.stockLog, log);

  renderStock();
  if (getState().currentTab === 'home') renderHome();
}

export function editStockQty(itemId) {
  const stock = getStock();
  const item = stock.find((s) => s.id === itemId);
  if (!item) return;
  const val = prompt(`Set ${item.name} quantity (${item.unit}):`, item.qty);
  if (val === null) return;
  const n = parseFloat(val);
  if (isNaN(n) || n < 0) return;
  const oldQty = item.qty;
  item.qty = n;
  saveJSON(K.stock, stock);

  const log = getStockLog();
  log.push({
    id: itemId, name: item.name, delta: n - oldQty,
    newQty: n, date: getState().today, time: tnow(),
  });
  saveJSON(K.stockLog, log);

  renderStock();
}
