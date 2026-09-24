// Worker-domain storage helpers. Domain-specific accessors that
// compose loadJSON + key + default-config; tabs import from here,
// never directly from storage.js.

import { loadJSON } from './storage.js';
import { K } from './keys.js';
import { DEF_PERM, DEF_CW } from '../config/workers.js';
import { DEF_CFG } from '../config/wage.js';
import { usesPlainRate } from '../utils/payroll.js';

// Non-floor staff: guards, plus anyone carrying the plain monthly pay model
// (BM, 24 Sep 2026: "Have it as an option for non-floor staff"). One definition,
// used by every list below and by the tabs.
export function isNonFloor(w) {
  return usesPlainRate(DEF_CFG, w);
}

export function getPermWorkers() { return loadJSON(K.peEmp, DEF_PERM); }
export function getCWWorkers()   { return loadJSON(K.cwEmp, DEF_CW);   }

export function getActivePermProd() {
  return getPermWorkers().filter(
    (w) => !w.inactive
      && !isNonFloor(w)
      && !DEF_CFG.excludedIds.includes(w.id),
  );
}

export function getActiveCW() {
  return getCWWorkers().filter((w) => !w.inactive);
}

export function getGuards() {
  return getPermWorkers().filter(
    (w) => isNonFloor(w) && !w.inactive,
  );
}

export function getAllProdWorkers() {
  const perm = getActivePermProd().map((w) => ({ ...w, type: 'perm' }));
  const cw = getActiveCW().map((w) => ({ ...w, type: 'cw' }));
  return [...perm, ...cw];
}

export function findWorker(id) {
  const all = [
    ...getPermWorkers().map((w) => ({ ...w, type: 'perm' })),
    ...getCWWorkers().map((w) => ({ ...w, type: 'cw' })),
  ];
  return all.find((w) => w.id === id) || { id, name: id, type: 'cw' };
}
