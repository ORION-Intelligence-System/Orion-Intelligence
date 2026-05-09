// ─── ORION DB — IndexedDB Abstraction Layer ────────────────────────────────
const DB_NAME = 'orion_intelligence';
const DB_VERSION = 1;

let db = null;

const STORES = {
  persons:       { keyPath: 'id' },
  interactions:  { keyPath: 'id' },
  relationships: { keyPath: 'id' },
  files:         { keyPath: 'id' },
  ai_cache:      { keyPath: 'id' },
  settings:      { keyPath: 'key' },
};

export function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      for (const [name, opts] of Object.entries(STORES)) {
        if (!d.objectStoreNames.contains(name)) {
          const store = d.createObjectStore(name, { keyPath: opts.keyPath });
          if (name === 'interactions') store.createIndex('personId', 'personId');
          if (name === 'relationships') store.createIndex('fromId', 'fromId');
          if (name === 'files') store.createIndex('personId', 'personId');
          if (name === 'ai_cache') store.createIndex('personId', 'personId');
        }
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return db.transaction([storeName], mode).objectStore(storeName);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ─── Generic CRUD ──────────────────────────────────────────────────────────
export function put(store, obj) {
  if (!obj.id) obj.id = crypto.randomUUID();
  obj.updatedAt = new Date().toISOString();
  return promisify(tx(store, 'readwrite').put(obj)).then(() => obj);
}
export function get(store, id) {
  return promisify(tx(store).get(id));
}
export function getAll(store) {
  return promisify(tx(store).getAll());
}
export function del(store, id) {
  return promisify(tx(store, 'readwrite').delete(id));
}
export function getByIndex(store, indexName, value) {
  return promisify(tx(store).index(indexName).getAll(value));
}
export function getSetting(key, defaultVal = null) {
  return promisify(tx('settings').get(key)).then(r => r ? r.value : defaultVal);
}
export function setSetting(key, value) {
  return promisify(tx('settings', 'readwrite').put({ key, value }));
}

// ─── Exports ───────────────────────────────────────────────────────────────
export const Persons = {
  list: () => getAll('persons'),
  get:  (id) => get('persons', id),
  save: (p) => put('persons', p),
  del:  (id) => del('persons', id),
};
export const Interactions = {
  listByPerson: (pid) => getByIndex('interactions', 'personId', pid),
  listAll: () => getAll('interactions'),
  save: (i) => put('interactions', i),
  del:  (id) => del('interactions', id),
};
export const Relationships = {
  listFrom: (pid) => getByIndex('relationships', 'fromId', pid),
  listForPerson: async (pid) => {
    const all = await getAll('relationships');
    return all.filter(r => r.fromId === pid || r.toId === pid);
  },
  listAll: () => getAll('relationships'),
  save: (r) => put('relationships', r),
  del:  (id) => del('relationships', id),
};
export const Files = {
  listByPerson: (pid) => getByIndex('files', 'personId', pid),
  listAll: () => getAll('files'),
  save: (f) => put('files', f),
  del:  (id) => del('files', id),
};
export const AiCache = {
  getForPerson: (pid, type) =>
    getByIndex('ai_cache', 'personId', pid)
      .then(r => r.find(e => e.analysisType === type) || null),
  save: (entry) => put('ai_cache', entry),
};
