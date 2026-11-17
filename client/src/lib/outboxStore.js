const DB_NAME = 'boardcollab-offline';
const STORE = 'operations';
const DB_VERSION = 1;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const keyOf = (roomId, op) => `${roomId}:${op.id}:${op.clock?.[0] ?? 0}:${op.clock?.[1] ?? ''}`;

export async function savePendingOps(roomId, ops) {
  const db = await openDb();
  if (!db || !ops.length) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    ops.forEach((op) => store.put({ key: keyOf(roomId, op), roomId, op }));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

export async function loadPendingOps(roomId) {
  const db = await openDb();
  if (!db) return [];
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.filter((row) => row.roomId === roomId).map((row) => row.op);
}

export async function removePendingOps(roomId, ops) {
  const db = await openDb();
  if (!db || !ops.length) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    ops.forEach((op) => store.delete(keyOf(roomId, op)));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
