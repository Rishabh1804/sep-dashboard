// Worker assignment picker — bottom-sheet overlay listing all
// present workers grouped by perm/CW. Clicking a row toggles
// the worker in/out of the active period+area assignment list.

import { getProdDay, saveProdDay, getAreas } from '../shared/storage/production.js';
import { findWorker } from '../shared/storage/workers.js';
import { getState, setState } from '../shared/storage/state.js';
import { isMonthLocked, requireUnlocked } from '../shared/storage/lock.js';
import { monthOf } from '../shared/utils/month.js';
import { recalcExtra } from '../shared/utils/calc-prod.js';
import { getCfg } from '../shared/storage/production.js';
import { esc } from '../shared/utils/format.js';
import { da, overlayClose } from '../shared/utils/dom.js';

export function openPicker(periodKey, areaId) {
  if (document.querySelector('.picker-overlay')) return;
  history.pushState({ popup: 'picker' }, '');
  setState({ pickerPeriod: periodKey, pickerArea: areaId });

  const date = getState().today;
  const prod = getProdDay(date);
  const areas = getAreas();
  const area = areas.find((a) => a.id === areaId);
  const period = prod.periods[periodKey];
  const pa = period.areas[areaId] || { assigned: [] };
  const present = prod.present || [];

  const perm = present.map((id) => findWorker(id)).filter((w) => w.type === 'perm');
  const cw = present.map((id) => findWorker(id)).filter((w) => w.type === 'cw');

  function workerRow(w) {
    const isAssigned = pa.assigned.includes(w.id);
    let otherAreaName = '';
    if (!isAssigned) {
      for (const [aid, aData] of Object.entries(period.areas || {})) {
        if (aid !== areaId && aData.assigned?.includes(w.id)) {
          otherAreaName = areas.find((a) => a.id === aid)?.name || aid;
          break;
        }
      }
    }
    const disabled = otherAreaName ? 'disabled' : '';
    const checked = isAssigned ? 'checked' : '';
    return `<div class="picker-worker ${checked} ${disabled}" ${da('togglePickerWorker', w.id)}>
      <div class="picker-check">✓</div>
      <span class="picker-name">${esc(w.name)}</span>
      ${otherAreaName ? `<span class="picker-where">→ ${esc(otherAreaName)}</span>` : ''}
    </div>`;
  }

  const html = `<div class="picker-overlay" ${overlayClose('closePicker')}>
    <div class="picker-sheet">
      <div class="picker-header">
        <span class="card-title">${esc(area?.name || areaId)} — Workers</span>
        <button class="header-btn" ${da('closePicker')}>✕</button>
      </div>
      <div class="picker-body" id="pickerBody">
        <div class="picker-section-label">Permanent Staff</div>
        ${perm.map((w) => workerRow(w)).join('')}
        <div class="picker-section-label">Contract Workers</div>
        ${cw.map((w) => workerRow(w)).join('')}
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

export function togglePickerWorker(workerId) {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), 'worker assignment')) return;
  const prod = getProdDay(date);
  const period = prod.periods[getState().pickerPeriod];
  const pa = period.areas[getState().pickerArea];
  if (!pa) return;

  const idx = pa.assigned.indexOf(workerId);
  if (idx >= 0) pa.assigned.splice(idx, 1);
  else pa.assigned.push(workerId);

  recalcExtra(prod, getAreas(), getCfg());
  saveProdDay(date, prod);

  closePicker();
  openPicker(getState().pickerPeriod, getState().pickerArea);
  // Re-render the production tab.
  if (typeof window.renderProduction === 'function') window.renderProduction();
}

export function closePicker() {
  const el = document.querySelector('.picker-overlay');
  if (el) el.remove();
}
