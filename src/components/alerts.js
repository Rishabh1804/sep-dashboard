// Alert-banner producers (HTML strings) shown on Home tab. Pure
// readers — they consume storage helpers but produce only markup.

import { localDateStr, getWeekEnd, formatDateShort } from '../shared/utils/date.js';
import { loadJSON } from '../shared/storage/storage.js';
import { K } from '../shared/storage/keys.js';
import { getAttKey } from '../shared/utils/payroll.js';
import { esc } from '../shared/utils/format.js';
import { getAllProdWorkers, getPermWorkers } from '../shared/storage/workers.js';
import { getState } from '../shared/storage/state.js';
import { getCfg } from '../shared/storage/production.js';
import { rosterStatus } from '../shared/storage/seed-sync.js';
import { getAreas, getProdLogs } from '../shared/storage/production.js';
import { stillPrePriced } from '../shared/utils/calc-prod.js';

// Pay is only as good as the rates behind it. Rates that were never imported
// (a fresh install, or a device still holding an older build's seed) are said
// out loud on Home rather than priced silently (Castor C-B1).
// Days in [from, to] whose extra cost was priced before the roster import and
// still differs from today's card (Janus J-H1). A pay document covering such a
// day names them, so an imported card's date never vouches for an older price.
// Returns '' when there are none.
export function getPrePricedNote(from, to) {
  const cfg = getCfg();
  const dates = stillPrePriced({
    logs: getProdLogs(), areas: getAreas(), cfg, dates: cfg.rosterPrePricedDates, from, to,
  });
  return dates.length
    ? `Extra cost on ${dates.join(', ')} was priced before the rate card was imported and is kept as recorded.`
    : '';
}

export function getRosterStatusAlerts() {
  const status = rosterStatus(getCfg(), [...getPermWorkers(), ...loadJSON(K.cwEmp, [])]);
  if (status === 'held') return ['<div class="alert-banner alert-warning" data-roster-alert="held">⚠ Pay rates on this device were never imported and may be out of date. Settings → Import roster.</div>'];
  if (status === 'none') return ['<div class="alert-banner alert-warning" data-roster-alert="none">⚠ No pay rates loaded — wages read ₹0. Settings → Import roster.</div>'];
  return [];
}

export function getCWPayDueAlerts() {
  const alerts = [];
  const today = getState().today;
  const d = new Date(today + 'T00:00:00');
  const dow = d.getDay();
  const satDate = getWeekEnd(today);
  const paid = loadJSON(K.cwPay, {});
  const isPaid = paid[satDate]?.paid || false;

  if (!isPaid) {
    if (dow === 4 || dow === 5) {
      alerts.push(`<div class="alert-banner alert-warning">💰 CW pay due Saturday (${formatDateShort(satDate)})</div>`);
    } else if (dow === 6) {
      alerts.push(`<div class="alert-banner alert-danger">⚠ CW pay overdue — not yet marked paid for week ending ${formatDateShort(satDate)}</div>`);
    }
  }
  return alerts;
}

export function getAttendancePatternAlerts() {
  const alerts = [];
  const allWorkers = getAllProdWorkers();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const today = new Date(getState().today + 'T00:00:00');
  const permIds = new Set(getPermWorkers().map((p) => p.id));

  allWorkers.forEach((w) => {
    const isPerm = permIds.has(w.id);
    const store = isPerm ? peAtt : cwAtt;
    const type = isPerm ? 'perm' : 'cw';

    let absentLast7 = 0;
    let consecutiveAbsent = 0;
    let maxConsecutive = 0;

    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = localDateStr(d);
      const k = getAttKey(type, w.id, ds);
      const rec = store[k];
      const isAbsent = !rec || rec.status === 'A';
      if (isAbsent) {
        absentLast7++;
        consecutiveAbsent++;
        if (consecutiveAbsent > maxConsecutive) maxConsecutive = consecutiveAbsent;
      } else {
        consecutiveAbsent = 0;
      }
    }

    if (maxConsecutive >= 3) {
      alerts.push(`<div class="alert-banner alert-danger">🚨 ${esc(w.name)} absent ${maxConsecutive} consecutive days</div>`);
    } else if (absentLast7 >= 3) {
      alerts.push(`<div class="alert-banner alert-warning">⚠ ${esc(w.name)} absent ${absentLast7} of last 7 days</div>`);
    }
  });

  return alerts;
}
