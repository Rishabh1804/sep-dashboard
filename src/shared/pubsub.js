// Tiny pub/sub bus. Used to break upward dependencies — Layer 2 emits
// `data:saved` (consumed by save-dot in Layer 4); tabs emit
// `tab:changed` events for cross-tab refresh without storage→UI imports.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((fn) => {
    try { fn(payload); } catch (e) { console.error('[pubsub]', event, e); }
  });
}
