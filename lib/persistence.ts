// Durable, encrypted persistence for user-created connections and app config.
//
// Only the sensitive credential fields (host, port, database, username) are
// encrypted via the AES-GCM master key; the rest of the connection metadata is
// stored in clear so the tree can render without decrypting everything.

import type { AuditLogItem, Connection, DriverCategory, DriverId, User, CustomRole } from './types'
import { decryptJson, encryptJson } from './crypto'
import {
  AUDIT_STORE,
  CONNECTION_STORE,
  META_STORE,
  QUERY_STORE,
  USERS_STORE,
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

// ---------------------------------------------------------------------------
// Saved queries / pipelines — persisted per driver type
// ---------------------------------------------------------------------------

export interface SavedQuery {
  id: string
  /** driver this query/pipeline was written for */
  driver: DriverId
  /** connection id this query was saved from (optional) */
  connectionId?: string
  title: string
  /** the query text (SQL, Mongo pipeline, Redis command, etc.) */
  body: string
  /** when the query was saved (ISO timestamp) */
  savedAt: string
}

export async function saveSavedQuery(query: SavedQuery): Promise<void> {
  await idbPut(QUERY_STORE, query)
}

export async function deleteSavedQuery(id: string): Promise<void> {
  await idbDelete(QUERY_STORE, id)
}

export async function loadSavedQueries(): Promise<SavedQuery[]> {
  return idbGetAll<SavedQuery>(QUERY_STORE)
}

export async function loadSavedQueriesByDriver(driver: DriverId): Promise<SavedQuery[]> {
  const all = await idbGetAll<SavedQuery>(QUERY_STORE)
  return all.filter((q) => q.driver === driver)
}

// ---------------------------------------------------------------------------
// Audit log — persisted as JSON records, loaded at app startup
// ---------------------------------------------------------------------------

export async function saveAuditEntry(entry: AuditLogItem): Promise<void> {
  await idbPut(AUDIT_STORE, entry)
}

export async function loadAuditLog(): Promise<AuditLogItem[]> {
  const entries = await idbGetAll<AuditLogItem>(AUDIT_STORE)
  return entries.sort((a, b) => b.timestamp - a.timestamp)
}

export async function clearAuditLog(): Promise<void> {
  const entries = await idbGetAll<AuditLogItem>(AUDIT_STORE)
  for (const e of entries) {
    await idbDelete(AUDIT_STORE, e.id)
  }
}

// ---------------------------------------------------------------------------
// Users & custom roles — persisted so production survives page reloads
// ---------------------------------------------------------------------------

const USERS_KEY = 'users'
const CUSTOM_ROLES_KEY = 'custom-roles'
const ADMIN_PASSWORD_KEY = 'admin-password'

export async function loadPersistedUsers(): Promise<User[]> {
  return (await idbGet<User[]>(META_STORE, USERS_KEY)) ?? []
}

export async function savePersistedUsers(users: User[]): Promise<void> {
  await idbPut(META_STORE, users, USERS_KEY)
}

export async function loadPersistedCustomRoles(): Promise<CustomRole[]> {
  return (await idbGet<CustomRole[]>(META_STORE, CUSTOM_ROLES_KEY)) ?? []
}

export async function savePersistedCustomRoles(roles: CustomRole[]): Promise<void> {
  await idbPut(META_STORE, roles, CUSTOM_ROLES_KEY)
}

export async function loadAdminPassword(): Promise<string | undefined> {
  return idbGet<string>(META_STORE, ADMIN_PASSWORD_KEY)
}

export async function saveAdminPassword(password: string): Promise<void> {
  await idbPut(META_STORE, password, ADMIN_PASSWORD_KEY)
}
