// Activity-stream formatters — pure, shared by the Live tab (activity stream)
// and the Edit tab (recent-by-category rows). Extracted from live.js in the
// Edit-UI session so both surfaces render a record identically; the per-
// collection icon + one-line summary lives in exactly one place.
//
// makeStreamFormatters(custName) takes a customer-id → name resolver (the
// Live/Edit listeners hydrate it from the customers collection) and returns a
// map keyed by collection name → { icon, fmt(doc) }. Pure given the resolver.

export function makeStreamFormatters(custName = (id) => id || '?') {
  return {
    production_entries: { icon: '🏭', fmt: (d) => `${d.machine_id || '?'} · ${d.qty_pcs ? d.qty_pcs + ' NOS' : (d.qty_kg || 0) + ' kg'}${d.rounds ? ` (${d.rounds}×${d.round_size || '?'})` : ''} · ${d.worker_id || ''}` },
    jobs: { icon: '📋', fmt: (d) => `Job · ${custName(d.customer_id)}${d.challan_no ? ` · Ch ${d.challan_no}` : ''} · ${d.received_kg ? d.received_kg + ' kg' : (d.received_pcs || 0) + ' NOS'}${d.current_status ? ` · ${d.current_status}` : ''}` },
    dft_measurements: { icon: '🔬', fmt: (d) => `DFT ${d.micron_value} µm · ${d.outcome}` },
    dispatch_events: { icon: '🚚', fmt: (d) => `Dispatch · ${d.job_id || ''}${d.weight_kg ? ` · ${d.weight_kg} kg` : ''}` },
    notes: { icon: '📝', fmt: (d) => `${d.priority === 'urgent' ? '🚨 ' : ''}${d.kind}: ${d.summary || ''}` },
    shifts: { icon: '⏱', fmt: (d) => `${(d.__path || '').split('/')[1] || '?'} ${d.direction === 'in' ? '→ in' : '→ out'}${d.slot ? ` · ${d.slot}` : ''}` },
    depletions: { icon: '📤', fmt: (d) => `${(d.__path || '').split('/')[1] || '?'} −${d.qty_depleted}${d.level_after != null ? ` (left: ${d.level_after})` : ''}` },
  };
}

// Timestamp → "14:32" (today) or "9 Jun" (older). Pure.
export function fmtTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// Elapsed millis → "6h" / "2d". Pure.
export function fmtAge(ms) {
  const h = Math.floor(ms / 3600000);
  return h >= 48 ? `${Math.floor(h / 24)}d` : `${h}h`;
}
