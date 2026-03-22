const DB_NAME = 'skye_split_engine_db';
const DB_VERSION = 2;
const STORES = ['contacts', 'splits', 'snapshots', 'settings', 'activity', 'templates', 'deals', 'receipts'];

function createBaseStores(db) {
  if (!db.objectStoreNames.contains('contacts')) {
    const store = db.createObjectStore('contacts', { keyPath: 'id' });
    store.createIndex('updatedAt', 'updatedAt');
  }
  if (!db.objectStoreNames.contains('splits')) {
    const store = db.createObjectStore('splits', { keyPath: 'id' });
    store.createIndex('updatedAt', 'updatedAt');
  }
  if (!db.objectStoreNames.contains('snapshots')) {
    const store = db.createObjectStore('snapshots', { keyPath: 'id' });
    store.createIndex('createdAt', 'createdAt');
  }
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('activity')) {
    const store = db.createObjectStore('activity', { keyPath: 'id' });
    store.createIndex('createdAt', 'createdAt');
  }
  if (!db.objectStoreNames.contains('templates')) {
    const store = db.createObjectStore('templates', { keyPath: 'id' });
    store.createIndex('updatedAt', 'updatedAt');
    store.createIndex('nextRunDate', 'nextRunDate');
  }
  if (!db.objectStoreNames.contains('deals')) {
    const store = db.createObjectStore('deals', { keyPath: 'id' });
    store.createIndex('updatedAt', 'updatedAt');
    store.createIndex('status', 'status');
  }
  if (!db.objectStoreNames.contains('receipts')) {
    const store = db.createObjectStore('receipts', { keyPath: 'id' });
    store.createIndex('updatedAt', 'updatedAt');
    store.createIndex('settlementDate', 'settlementDate');
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      createBaseStores(db);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function txStore(name, mode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(name, mode);
  return { db, tx, store: tx.objectStore(name) };
}

export async function getAll(storeName) {
  const { db, tx, store } = await txStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getOne(storeName, id) {
  const { db, tx, store } = await txStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function putOne(storeName, value) {
  const { db, tx, store } = await txStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteOne(storeName, id) {
  const { db, tx, store } = await txStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearStore(storeName) {
  const { db, tx, store } = await txStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function batchPut(storeName, values) {
  const { db, tx, store } = await txStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    values.forEach((value) => store.put(value));
    tx.oncomplete = () => {
      db.close();
      resolve(values);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function exportAll() {
  const result = {};
  for (const store of STORES) {
    result[store] = await getAll(store);
  }
  return result;
}

export async function replaceAll(data = {}) {
  for (const store of STORES) {
    await clearStore(store);
    if (Array.isArray(data[store]) && data[store].length) {
      await batchPut(store, data[store]);
    }
  }
}

export { STORES };
