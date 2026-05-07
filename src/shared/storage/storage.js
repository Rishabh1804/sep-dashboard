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

export function saveJSON(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    emit('data:saved', { key });
  } catch (e) {
    console.error('Save error:', e);
  }
}
