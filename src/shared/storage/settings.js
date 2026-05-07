import { loadJSON } from './storage.js';
import { K } from './keys.js';

export function getSettings() {
  return loadJSON(K.settings, { darkMode: false, swipeTabs: true });
}
