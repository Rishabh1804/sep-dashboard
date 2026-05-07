// HTML-escape a string for safe interpolation into innerHTML.
export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export const escHtml = esc;
