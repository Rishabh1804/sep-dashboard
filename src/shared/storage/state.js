// App state singleton with getState/setState accessors.
//
// Per PHASE_2_AUDIT cross-cutting finding 4 (Architect-locked), STATE
// lives in Layer 2 as a singleton; everything imports the accessors
// from here. No mutable export, no slippery slope, no pubsub overhead.
// Composes with the eventual Firebase migration as the storage-backend
// swap seam.

import { localDateStr } from '../utils/date.js';

const _state = {
  currentTab: 'home',
  today: localDateStr(),
  histDate: localDateStr(),
  attFilter: 'all', // all | perm | cw
  darkMode: false,
  settingsOpen: false,
  invTab: 'list',  // list | clients | gst
  invMonth: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })(),
  pickerPeriod: null,
  pickerArea: null,
};

export function getState() { return _state; }

export function setState(patch) {
  Object.assign(_state, patch);
  return _state;
}
