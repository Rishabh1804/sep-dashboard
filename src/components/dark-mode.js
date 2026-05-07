import { saveJSON } from '../shared/storage/storage.js';
import { K } from '../shared/storage/keys.js';
import { getSettings } from '../shared/storage/settings.js';
import { getState, setState } from '../shared/storage/state.js';

export function toggleDarkMode() {
  const next = !getState().darkMode;
  setState({ darkMode: next });
  document.documentElement.classList.toggle('dark', next);
  const s = getSettings();
  s.darkMode = next;
  saveJSON(K.settings, s);
}

export function initDarkMode() {
  const dark = getSettings().darkMode || false;
  setState({ darkMode: dark });
  document.documentElement.classList.toggle('dark', dark);
}
