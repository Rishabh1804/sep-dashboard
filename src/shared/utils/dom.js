// Helpers for emitting `data-action` attributes from HTML template
// strings. The document-level click delegator in dashboard/main.js
// reads these attributes and dispatches to the corresponding window
// function — replacing the v2.1 inline `onclick="fn(...)"` pattern.
//
// Usage:
//   `<button ${da('markAtt', w.id, w.type, 'P')}>✓</button>`
//   `<div class="picker-overlay" ${overlayClose('closePicker')}>...`
//
// Args are JSON-encoded so booleans, numbers, and strings round-trip
// through the attribute. Embedded `"` is escaped to `&quot;` so the
// resulting attribute is a single double-quoted HTML attribute that
// the browser parses cleanly.

export function da(action, ...args) {
  if (args.length === 0) return `data-action="${action}"`;
  const json = JSON.stringify(args).replaceAll('"', '&quot;');
  return `data-action="${action}" data-args="${json}"`;
}

export function overlayClose(action) {
  return `data-overlay-close="${action}"`;
}
