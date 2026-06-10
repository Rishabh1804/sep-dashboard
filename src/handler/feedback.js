// Multi-modal submit confirmation (Phase 7 HIGH fix).
//
// A toast alone is invisible in dim, noisy, sweaty conditions, so every
// successful submit fires three independent channels:
//   1. Visual  — a toast (Devanagari "सेव हो गया")
//   2. Haptic  — a 50ms vibration (Vibration API, feature-detected)
//   3. Audio   — an 880Hz tone (Web Audio), a band that cuts through
//                ~85dB machine noise; mutable in settings.
// Each channel is independently feature-detected; any missing channel
// degrades silently rather than throwing.

import { t } from './i18n.js';

const MUTE_KEY = 'sep_handler_mute';

export function isMuted() {
  try { return globalThis.localStorage?.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function setMuted(on) {
  try { globalThis.localStorage?.setItem(MUTE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

let audioCtx = null;
function tone(freq = 880, ms = 120) {
  if (isMuted()) return;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  try {
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* audio unavailable */ }
}

function vibrate(pattern) {
  try { globalThis.navigator?.vibrate?.(pattern); } catch { /* unsupported */ }
}

// variant: 'ok' | 'warn' | 'bad'
export function toast(msg, variant = 'ok', ms = 2000) {
  if (typeof document === 'undefined') return;
  let wrap = document.querySelector('.h-toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'h-toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'h-toast' + (variant === 'warn' ? ' h-toast-warn' : variant === 'bad' ? ' h-toast-bad' : '');
  el.setAttribute('role', 'status');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// The canonical "it saved" signal fired after every successful submit.
export function confirmSaved(label) {
  toast(`✓ ${label || t('saved')}`, 'ok');
  vibrate(50);
  tone(880, 120);
}

export function signalError(msg) {
  toast(`⚠️ ${msg}`, 'bad');
  vibrate([40, 60, 40]);
  tone(220, 200);
}
