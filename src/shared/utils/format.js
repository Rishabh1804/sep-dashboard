// HTML-escape a string for safe interpolation into innerHTML (text context).
export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export const escHtml = esc;

// Escape for an HTML attribute value (e.g. value="..."). esc() deliberately
// leaves quotes intact (fine for text content); inside a quoted attribute an
// unescaped " or ' breaks out → injection. Use this for any attribute that
// interpolates non-static / user-entered text.
export function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
