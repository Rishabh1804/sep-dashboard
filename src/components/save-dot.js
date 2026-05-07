// Save indicator — pulses on every successful saveJSON via the
// pubsub `data:saved` event (no upward dependency from Layer 2).

import { on } from '../shared/pubsub.js';

let saveDotTimer = null;

export function initSaveDot() {
  on('data:saved', () => {
    const dot = document.getElementById('saveDot');
    if (!dot) return;
    dot.classList.add('show');
    dot.classList.remove('unsaved');
    clearTimeout(saveDotTimer);
    saveDotTimer = setTimeout(() => dot.classList.remove('show'), 2000);
  });
}
