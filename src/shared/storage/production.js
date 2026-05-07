// Production-domain storage. Defaults from config/areas + config/wage
// are merged on top of saved data so new shift-config fields appear
// without a migration.

import { loadJSON, saveJSON } from './storage.js';
import { K } from './keys.js';
import { DEF_AREAS } from '../config/areas.js';
import { DEF_CFG } from '../config/wage.js';

export function getAreas() {
  return loadJSON(K.prodAreas, DEF_AREAS);
}

export function getCfg() {
  const saved = loadJSON(K.prodCfg, {});
  return {
    ...DEF_CFG,
    ...saved,
    standardShift:      { ...DEF_CFG.standardShift,      ...(saved.standardShift      || {}) },
    sundayHolidayShift: { ...DEF_CFG.sundayHolidayShift, ...(saved.sundayHolidayShift || {}) },
    morningOT:          { ...DEF_CFG.morningOT,          ...(saved.morningOT          || {}) },
    eveningOT:          { ...DEF_CFG.eveningOT,          ...(saved.eveningOT          || {}) },
  };
}

export function getProdLogs() { return loadJSON(K.prodLog, {}); }

export function getProdDay(date) {
  const logs = getProdLogs();
  return logs[date] || null;
}

export function saveProdDay(date, dayData) {
  const logs = getProdLogs();
  logs[date] = dayData;
  saveJSON(K.prodLog, logs);
}
