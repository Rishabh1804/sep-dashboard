// CSV cell escape: wrap in quotes, double internal quotes (RFC 4180).
export function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function csvDownload(filename, rows) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}
