// Durable, encrypted persistence for user-created connections and app config.
//
// Only the sensitive credential fields (host, port, database, username) are
// encrypted via the AES-GCM master key; the rest of the connection metadata is
// stored in clear so the tree can render without decrypting everything.

import type { Connection, DriverCategory, DriverId } from './types'
import { decryptJson, encryptJson } from './crypto'
import {
  CONNECTION_STORE,
  META_STORE,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
} from './idb'

const CONFIG_KEY = 'app-config'

interface Credentials {
  host: string
  port: number
  database: string
  username: string
}

interface StoredConnection {
  id: string
  /** connection without credential fields */
  clear: Omit<Connection, 'host' | 'port' | 'database' | 'username'>
  /** encrypted credential blob (iv.ciphertext) */
  enc: string
}

export interface AppConfig {
  initialized: boolean
  systemStore: {
    driver: DriverId
    category: DriverCategory
  } | null
}

const DEFAULT_CONFIG: AppConfig = { initialized: false, systemStore: null }

export async function loadAppConfig(): Promise<AppConfig> {
  const cfg = await idbGet<AppConfig>(META_STORE, CONFIG_KEY)
  return cfg ?? DEFAULT_CONFIG
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  await idbPut(META_STORE, config, CONFIG_KEY)
}

/** Encrypt credentials and persist a single connection. */
export async function saveConnection(conn: Connection): Promise<void> {
  const { host, port, database, username, ...clear } = conn
  const creds: Credentials = { host, port, database, username }
  const enc = await encryptJson(creds)
  const stored: StoredConnection = { id: conn.id, clear, enc }
  await idbPut(CONNECTION_STORE, stored)
}

export async function deleteConnection(id: string): Promise<void> {
  await idbDelete(CONNECTION_STORE, id)
}

/** Load and decrypt every persisted connection. */
export async function loadConnections(): Promise<Connection[]> {
  const stored = await idbGetAll<StoredConnection>(CONNECTION_STORE)
  const out: Connection[] = []
  for (const s of stored) {
    try {
      const creds = await decryptJson<Credentials>(s.enc)
      out.push({ ...(s.clear as Connection), ...creds })
    } catch {
      // If a record can't be decrypted (e.g. key reset), skip it rather than
      // crashing the whole workspace.
    }
  }
  return out
}
