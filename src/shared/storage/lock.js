// Month-close lock — prevents writes against finalized months.
// Edit-guard returns true and surfaces a UX message if the month is
// locked (caller should early-return); false if the month is open.

import { loadJSON } from './storage.js';
import { K } from './keys.js';

export function getMonthLocks() { return loadJSON(K.monthLock, {}); }

export function isMonthLocked(month) {
  const locks = getMonthLocks();
  return locks[month]?.locked === true;
}

export function requireUnlocked(month, label) {
  if (isMonthLocked(month)) {
    alert(`🔒 ${month} is locked — ${label || 'this change'} is blocked. Unlock the month from the Finance tab to edit.`);
    return true;
  }
  return false;
}
