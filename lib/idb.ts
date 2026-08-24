// Minimal promise-based IndexedDB wrapper used for encrypted-at-rest storage.
// Two object stores:
//   - "meta":        key-value bag (crypto key, app config)
//   - "connections": user-created connections, keyed by id
//
// Everything is client-only and guarded so it no-ops safely during SSR.

const DB_NAME = 'datalook-studio'
const DB_VERSION = 2
export const META_STORE = 'meta'
export const CONNECTION_STORE = 'connections'
export const QUERY_STORE = 'queries'
export const AUDIT_STORE = 'audit'

let dbPromise: Promise<IDBDatabase> | null = null

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }
      if (!db.objectStoreNames.contains(CONNECTION_STORE)) {
        db.createObjectStore(CONNECTION_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(QUERY_STORE)) {
        db.createObjectStore(QUERY_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(AUDIT_STORE)) {
        db.createObjectStore(AUDIT_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const req = run(transaction.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  if (!isAvailable()) return undefined
  return tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>)
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  if (!isAvailable()) return []
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

export async function idbPut(
  store: string,
  value: unknown,
  key?: IDBValidKey,
): Promise<void> {
  if (!isAvailable()) return
  await tx(store, 'readwrite', (s) =>
    key !== undefined ? s.put(value, key) : s.put(value),
  )
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  if (!isAvailable()) return
  await tx(store, 'readwrite', (s) => s.delete(key))
}
