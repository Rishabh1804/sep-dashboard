// Track 2 ignition — wires Firebase into the handler's existing seams.
//
// Dynamically imported from main.js AFTER first render, and every firebase/*
// import in here is dynamic too, so esbuild splits the Firebase SDK into an
// async chunk: the shell stays instant + offline-first (the SW runtime-caches
// the chunk after the first online load). If Firebase never loads (no signal,
// no config), the handler behaves exactly like Stage C: queue + honest chip.
//
// Auth: signInWithCustomToken via a #token=… URL fragment — the QR
// provisioning entry path (HANDLER_PROVISIONING.md). The SDK persists the
// session in IndexedDB, so the one-shot token survives restarts; the
// fragment is scrubbed from the URL immediately after sign-in.

import { bootFirebaseSession } from '../shared/firebase-session.js';
import { setTransport, clearTransport, flush } from './sync.js';
import { createTransport } from './transport.js';
import {
  setCache, customersToPickerItems, itemsToPickerItems, jobsToPickerItems,
} from './picker-cache.js';

const PICKER_LIMIT = 250;

export async function startFirebase({ onChange } = {}) {
  // Shared session boot (Stage F extraction): app + persistent-cache db +
  // auth + the #token URL-fragment sign-in, identical behaviour to the
  // 12 Jun live-verified path. Null = no config — Stage C behaviour holds.
  const session = await bootFirebaseSession();
  if (!session) return null;
  const { app, db, auth, fs, fbAuth } = session;

  let unsubscribers = [];
  let activeUid = null;
  fbAuth.onAuthStateChanged(auth, (user) => {
    if (user?.uid === activeUid) return; // same session settling — keep listeners
    unsubscribers.forEach((u) => { try { u(); } catch { /* ignore */ } });
    unsubscribers = [];
    activeUid = user?.uid || null;
    if (user) {
      setTransport(createTransport({ db, auth, fs }));
      unsubscribers = startPickerListeners({ db, fs, onChange });
      // flush() respects the pre-flush hold from boot — an unreviewed
      // leftover queue is never drained behind the confirmation modal.
      flush().then(() => onChange?.()).catch(() => {});
    } else {
      clearTransport(); // chip must not claim "syncing" against a dead auth
    }
    onChange?.();
  });

  // Drain whenever connectivity returns while signed in.
  globalThis.addEventListener?.('online', () => {
    if (auth.currentUser) flush().then(() => onChange?.()).catch(() => {});
  });

  return { app, db, auth };
}

// Live picker hydration: Firestore listeners → picker-cache (which persists
// to IndexedDB, so the picker stays populated offline). Reads require
// isAuthenticated() per the rules — only started post-sign-in.
function startPickerListeners({ db, fs, onChange }) {
  const q = (name) => fs.query(fs.collection(db, name), fs.limit(PICKER_LIMIT));
  const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const onErr = () => {}; // listener loss is non-fatal; cache snapshot persists

  return [
    fs.onSnapshot(q('customers'), (s) => { setCache('customer', customersToPickerItems(docs(s))); onChange?.(); }, onErr),
    fs.onSnapshot(q('items'), (s) => { setCache('part', itemsToPickerItems(docs(s))); onChange?.(); }, onErr),
    fs.onSnapshot(q('jobs'), (s) => { setCache('job', jobsToPickerItems(docs(s))); onChange?.(); }, onErr),
    fs.onSnapshot(q('suppliers'), (s) => {
      setCache('supplier', docs(s).map((d) => ({ id: d.id, primary: d.name || d.id })));
      onChange?.();
    }, onErr),
  ];
}
