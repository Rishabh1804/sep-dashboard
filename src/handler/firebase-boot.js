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
import { eventMillis } from '../shared/utils/event-time.js';
import { OPEN_JOB_STATUSES } from '../shared/types/job-status.js';
import { setTransport, clearTransport, flush } from './sync.js';
import { createTransport } from './transport.js';
import {
  setCache, customersToPickerItems, itemsToPickerItems, jobsToPickerItems,
  customerNamesById,
} from './picker-cache.js';

const PICKER_LIMIT = 250;
// Jobs get a higher ceiling: the where-in query has NO orderBy (a composite
// index is the 2.1 fix), so Firestore truncates by doc id BEFORE the client's
// recency sort — a low limit would silently drop the newest receipts once
// open jobs exceed it (the seed alone holds hundreds). 1000 covers any
// realistic open book; revisit with the composite index.
const JOBS_PICKER_LIMIT = 1000;

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
//
// Job picker shape (dry-run feedback, 12 Jun): only jobs still on the floor
// (in-flight / ready — the floor never runs production on dispatched work),
// newest first, with the customer NAME resolved from the customers snapshot
// instead of a raw id. Equality-only filter → no composite index needed;
// recency sort happens client-side.
function startPickerListeners({ db, fs, onChange }) {
  const q = (name) => fs.query(fs.collection(db, name), fs.limit(PICKER_LIMIT));
  const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const onErr = () => {}; // listener loss is non-fatal; cache snapshot persists

  // Jobs join against customers; either snapshot may arrive first, so both
  // listeners recompute the job cache from the latest pair. lastJobs starts
  // null (NOT []) — until the jobs snapshot has fired at least once, the job
  // cache must not be written: the customers snapshot usually lands first
  // (served from the SDK's local cache) and an unguarded recompute would
  // persist [] over the offline snapshot hydrateCaches() just restored.
  let lastNames = {};
  let lastJobs = null;
  const recomputeJobs = () => {
    if (!lastJobs) return;
    const recentFirst = [...lastJobs].sort((a, b) => eventMillis(b) - eventMillis(a));
    setCache('job', jobsToPickerItems(recentFirst, lastNames));
    onChange?.();
  };

  const openJobsQ = fs.query(
    fs.collection(db, 'jobs'),
    fs.where('current_status', 'in', OPEN_JOB_STATUSES),
    fs.limit(JOBS_PICKER_LIMIT),
  );

  return [
    fs.onSnapshot(q('customers'), (s) => {
      const customers = docs(s);
      lastNames = customerNamesById(customers);
      setCache('customer', customersToPickerItems(customers));
      onChange?.();
      recomputeJobs();
    }, onErr),
    fs.onSnapshot(q('items'), (s) => { setCache('part', itemsToPickerItems(docs(s))); onChange?.(); }, onErr),
    fs.onSnapshot(openJobsQ, (s) => { lastJobs = docs(s); recomputeJobs(); }, onErr),
    fs.onSnapshot(q('suppliers'), (s) => {
      setCache('supplier', docs(s).map((d) => ({ id: d.id, primary: d.name || d.id })));
      onChange?.();
    }, onErr),
  ];
}
