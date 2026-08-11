// Single read/write boundary for localStorage. Per Session 11 charter,
// this is the integration seam where Firebase will eventually plug in
// (the synchronous facade stays; the backend swaps out behind it).

import { emit } from '../pubsub.js';

export function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

// Returns TRUE on a confirmed write, FALSE if it failed. It used to swallow
// the exception and return void, which meant a caller could not know its write
// had failed — and the extraCost migration then marked itself applied against
// an uncorrected log (Janus BLOCKER-1, reproduced against a quota-throwing
// store). Existing callers ignore the return value and are unaffected.
export function saveJSON(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    emit('data:saved', { key });
    return true;
  } catch (e) {
    console.error('Save error:', e);
    return false;
  }
}
