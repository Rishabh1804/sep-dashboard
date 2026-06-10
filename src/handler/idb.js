// Tiny zero-dependency IndexedDB key-value store for the handler PWA.
//
// HANDLER_UI_SHELL.md suggests idb-keyval, but we keep the offline
// bundle dependency-free (and the API surface we need is small): a
// single object store keyed by string, with prefix scans for drafts
// and the offline write queue.
//
// All ops resolve to plain values / arrays; IndexedDB is never exposed
// to callers. In a non-browser context (Jest/jsdom) `indexedDB` is
// absent, so callers should guard with `idbAvailable()` — pure logic
// lives elsewhere precisely so it stays testable without this layer.

const DB_NAME = 'sep-handler';
const STORE = 'kv';
const VERSION = 1;

let dbPromise = null;

export function idbAvailable() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out.value);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export function idbGet(key) {
  return tx('readonly', (store) => {
    const box = { value: undefined };
    store.get(key).onsuccess = (e) => { box.value = e.target.result; };
    return box;
  });
}

export function idbSet(key, val) {
  return tx('readwrite', (store) => {
    store.put(val, key);
    return { value: val };
  });
}

export function idbDel(key) {
  return tx('readwrite', (store) => {
    store.delete(key);
    return { value: undefined };
  });
}

// Return [{ key, value }] for all keys starting with `prefix` (sorted by key).
export function idbScan(prefix) {
  return tx('readonly', (store) => {
    const box = { value: [] };
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
        box.value.push({ key: cursor.key, value: cursor.value });
      }
      cursor.continue();
    };
    return box;
  });
}
