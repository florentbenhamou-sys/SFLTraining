// Persistent key/value store for imported sessions and edits.
// IndexedDB, not localStorage: a session's field diagrams weigh megabytes and Safari caps
// localStorage at ~5 MB per site, so imports past the first one were silently not saved.
const DB = 'training-sfl', OS = 'kv';
let dbp = null;

function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

export async function kvGet(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction(OS).objectStore(OS).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function kvSet(key, value) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(OS, 'readwrite');
    t.objectStore(OS).put(value, key);
    t.oncomplete = () => res();
    t.onerror = t.onabort = () => rej(t.error);
  });
}

// Reads `key`, moving any older copy kept in localStorage over to IndexedDB.
export async function loadKey(key, fallback) {
  let v;
  try { v = await kvGet(key); } catch (e) {}
  if (v === undefined) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) { v = JSON.parse(raw); await kvSet(key, v); localStorage.removeItem(key); }
    } catch (e) {}
  }
  return v === undefined ? fallback : v;
}

// Asks the browser not to evict the app's data when the phone runs low on space.
export function askPersist() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
}
