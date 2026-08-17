// Tiny promise-based IndexedDB helper — used for:
//  - offline cache of the whole DB (so app works without internet)
//  - blob cache of photos/voice (view while offline)
//  - pending write queue (auto-sync when internet returns)

const DB_NAME = 'hisabkitab'
const DB_VERSION = 1

export interface IDBStoreSchema {
  cache: string // key = collection name, value = JSON string
  blobs: string // key = fileId, value = Blob
  queue: string // key = auto id, value = JSON string (pending op)
  meta: string // key = string, value = string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const store of ['cache', 'blobs', 'queue', 'meta'] as const) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDB()
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const idb = {
  set(store: 'cache' | 'blobs' | 'queue' | 'meta', key: string, value: unknown): Promise<void> {
    return tx(store, 'readwrite', (s) => s.put(value, key)).then(() => undefined)
  },
  get<T>(store: 'cache' | 'blobs' | 'queue' | 'meta', key: string): Promise<T | undefined> {
    return tx(store, 'readonly', (s) => s.get(key)) as Promise<T | undefined>
  },
  del(store: 'cache' | 'blobs' | 'queue' | 'meta', key: string): Promise<void> {
    return tx(store, 'readwrite', (s) => s.delete(key)).then(() => undefined)
  },
  keys(store: 'cache' | 'blobs' | 'queue' | 'meta'): Promise<string[]> {
    return tx(store, 'readonly', (s) => s.getAllKeys()).then((k) => (k as unknown[]).map(String))
  },
  clear(store: 'cache' | 'blobs' | 'queue' | 'meta'): Promise<void> {
    return tx(store, 'readwrite', (s) => s.clear()).then(() => undefined)
  },
}

export async function idbGetAll<T>(store: 'queue'): Promise<Array<{ key: string; value: T }>> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, 'readonly')
    const os = t.objectStore(store)
    const keysReq = os.getAllKeys()
    const valsReq = os.getAll()
    t.oncomplete = () => {
      const keys = (keysReq.result as unknown[]).map(String)
      const vals = valsReq.result as T[]
      resolve(keys.map((key, i) => ({ key, value: vals[i] })))
    }
    t.onerror = () => reject(t.error)
  })
}
