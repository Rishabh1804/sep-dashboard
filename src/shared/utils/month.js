// YYYY-MM-DD → YYYY-MM (Build Rule 8: localDateStr always emits this shape).
export function monthOf(dateStr) { return dateStr.slice(0, 7); }

// Iterate every YYYY-MM-DD inside a YYYY-MM month string.
export function monthDates(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const out = [];
  for (let d = 1; d <= days; d++) {
    out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}
