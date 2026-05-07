// Monthly CSV exports — attendance / payroll / cost rollups.

import { loadJSON } from '../../shared/storage/storage.js';
import { K } from '../../shared/storage/keys.js';
import { getState } from '../../shared/storage/state.js';
import { sepRound } from '../../shared/utils/currency.js';
import { getWeekEnd } from '../../shared/utils/date.js';
import { monthOf, monthDates } from '../../shared/utils/month.js';
import { csvDownload } from '../../shared/utils/csv.js';
import { getAttKey, calcDayWages, calcCWWeeklyPay, calcPermMonthlyPay } from '../../shared/utils/payroll.js';
import { getActiveCW, getActivePermProd, getGuards, getPermWorkers } from '../../shared/storage/workers.js';
import { getCfg, getProdDay, getProdLogs } from '../../shared/storage/production.js';
import { DEF_CFG } from '../../shared/config/wage.js';

export function exportAttendanceCSV() {
  const month = monthOf(getState().today);
  const dates = monthDates(month);
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const cw = getActiveCW();
  const perm = getActivePermProd();
  const guard = getPermWorkers().filter((w) => DEF_CFG.guardIds.includes(w.id) && !w.inactive);
  const all = [
    ...perm.map((w) => ({ ...w, type: 'perm' })),
    ...guard.map((w) => ({ ...w, type: 'perm' })),
    ...cw.map((w) => ({ ...w, type: 'cw' })),
  ];

  const rows = [['Worker ID', 'Worker Name', 'Type', 'Date', 'Status', 'OT Hours']];
  let dataRowCount = 0;
  for (const w of all) {
    const store = w.type === 'perm' ? peAtt : cwAtt;
    for (const ds of dates) {
      const k = getAttKey(w.type, w.id, ds);
      const rec = store[k];
      if (!rec) continue;
      rows.push([w.id, w.name, w.type === 'perm' ? 'Perm' : 'CW', ds, rec.status || '', rec.otHours || 0]);
      dataRowCount++;
    }
  }

  if (dataRowCount === 0) { alert(`No attendance recorded for ${month}.`); return; }
  csvDownload(`SEP_attendance_${month}.csv`, rows);
}

export function exportPayrollCSV() {
  const month = monthOf(getState().today);
  const today = getState().today;

  const perm = calcPermMonthlyPay({
    date: today, today,
    cfg: getCfg(),
    peAtt: loadJSON(K.peAtt, {}),
    peAdv: loadJSON(K.peAdv, {}),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
    guardIds: DEF_CFG.guardIds,
  });

  const cwAggMap = {};
  const [y, m] = month.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const sat = getWeekEnd(ds);
    if (!sat.startsWith(month)) continue;
    if (cwAggMap[`__week_${sat}`]) continue;
    cwAggMap[`__week_${sat}`] = true;
    const wk = calcCWWeeklyPay({
      satDate: sat,
      cfg: getCfg(),
      cwAtt: loadJSON(K.cwAtt, {}),
      cwAdv: loadJSON(K.cwAdv, {}),
      prodLogs: getProdLogs(),
      permSnacks: loadJSON(K.permSnack, []),
      activeCW: getActiveCW(),
    });
    for (const w of wk.workers) {
      if (!cwAggMap[w.id]) cwAggMap[w.id] = { name: w.name, days: 0, otH: 0, wage: 0, advance: 0, net: 0 };
      const a = cwAggMap[w.id];
      a.days += w.days; a.otH += w.otH; a.wage += w.wage; a.advance += w.advance; a.net += w.net;
    }
  }

  const rows = [['Worker ID', 'Worker Name', 'Type', 'Days', 'Gross', 'OT Hours', 'Advance', 'Net']];
  for (const w of perm.workers) {
    if (w.days === 0 && w.advance === 0) continue;
    rows.push([w.id, w.name, 'Perm', w.days, sepRound(w.basePay + w.otPay), w.otH, w.advance, w.total]);
  }
  for (const wid of Object.keys(cwAggMap)) {
    if (wid.startsWith('__week_')) continue;
    const a = cwAggMap[wid];
    if (a.days === 0 && a.advance === 0) continue;
    rows.push([wid, a.name, 'CW', a.days, sepRound(a.wage), a.otH, a.advance, sepRound(a.net)]);
  }

  if (rows.length === 1) { alert(`No payroll data for ${month}.`); return; }
  csvDownload(`SEP_payroll_${month}.csv`, rows);
}

export function exportCostsCSV() {
  const month = monthOf(getState().today);
  const dates = monthDates(month);

  const rows = [['Date', 'Day Wages', 'Extra Cost', 'Snack Cost', 'OT Cost', 'Total']];
  let nonzeroCount = 0;
  for (const ds of dates) {
    const dayWage = calcDayWages({
      date: ds,
      cfg: getCfg(),
      cwAtt: loadJSON(K.cwAtt, {}),
      peAtt: loadJSON(K.peAtt, {}),
      activeCW: getActiveCW(),
      activePermProd: getActivePermProd(),
      guards: getGuards(),
    });
    const prod = getProdDay(ds);
    const extra = prod?.totals?.extraCost || 0;
    const snack = prod?.totals?.snackCost || 0;
    const cfg = getCfg();
    const cwAtt = loadJSON(K.cwAtt, {});
    const peAtt = loadJSON(K.peAtt, {});
    let otCost = 0;
    for (const w of getActiveCW()) {
      const k = getAttKey('cw', w.id, ds);
      const rec = cwAtt[k];
      if (rec?.otHours) otCost += sepRound(rec.otHours * cfg.hourRate);
    }
    for (const w of getActivePermProd()) {
      const k = getAttKey('perm', w.id, ds);
      const rec = peAtt[k];
      if (rec?.otHours) otCost += sepRound(rec.otHours * sepRound((cfg.permOtBaseRate / 8) * cfg.permOtMultiplier));
    }
    const total = dayWage + extra + snack + otCost;
    if (total === 0) continue;
    rows.push([ds, dayWage, extra, snack, otCost, total]);
    nonzeroCount++;
  }

  if (nonzeroCount === 0) { alert(`No cost data for ${month}.`); return; }
  csvDownload(`SEP_costs_${month}.csv`, rows);
}
