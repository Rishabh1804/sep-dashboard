// Date helpers — Build Rule 8: never use toISOString(); always
// emit YYYY-MM-DD via local-time getters so timezone shifts don't
// silently re-bucket records.

export function localDateStr(d) {
  const dt = d ? new Date(d) : new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
}

export function tnow() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function isSunday(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay() === 0;
}

export function getWeekEnd(dateStr) {
  // Saturday of the week containing dateStr.
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? 6 : 6 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}
