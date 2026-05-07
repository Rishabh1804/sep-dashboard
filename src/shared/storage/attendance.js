// Attendance store accessors. The att map is keyed by `${workerId}_${date}`
// (with hyphens replaced by underscores) — see getAttKey in utils/payroll.

import { loadJSON, saveJSON } from './storage.js';
import { K } from './keys.js';
import { getAttKey } from '../utils/payroll.js';

export { getAttKey };

export function getAttendance(type) {
  return loadJSON(type === 'perm' ? K.peAtt : K.cwAtt, {});
}

export function setAttendance(type, key, val) {
  const k = type === 'perm' ? K.peAtt : K.cwAtt;
  const data = loadJSON(k, {});
  data[key] = val;
  saveJSON(k, data);
}
