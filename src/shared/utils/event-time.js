// When did this event happen? — Layer 1, pure.
//
// Firestore docs in this system carry created_at in THREE shapes:
//   - a Firestore Timestamp (live client writes via serverTimestamp())
//   - an ISO string (the 2,494-doc FY27 seed: the importer stamps an ISO
//     string and seed-staging writes it verbatim)
//   - null (a local snapshot of an offline write whose serverTimestamp
//     is still pending — the SDK reads it back as null until the ack)
// client_ts (Date.now() at form submit, stamped by the transport envelope)
// is the fallback that keeps a just-submitted offline record sorting as
// NEWEST instead of dropping to timestamp 0.
//
// Duck-typed on .toMillis so this stays Firebase-import-free (Layer 1).
export function eventMillis(doc) {
  const t = doc?.created_at;
  if (t && typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t === 'string') {
    const ms = Date.parse(t);
    if (!Number.isNaN(ms)) return ms;
  }
  return typeof doc?.client_ts === 'number' ? doc.client_ts : 0;
}
