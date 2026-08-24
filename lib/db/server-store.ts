import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { encryptServer, decryptServer, type ServerCredentials } from './server-crypto'
import type { ConnectionConfig } from './types'
import type { DriverId } from '@/lib/types'

/**
 * Server-side connection store.
 * Persists connection configs (with encrypted credentials) to a JSON file
 * on the server filesystem. This is the server-side counterpart to the
 * client-side IndexedDB persistence — Route Handlers read from here to
 * get credentials without ever sending them to the client.
 */

interface StoredServerConnection {
  id: string
  driver: DriverId
  name: string
  host: string
  port: number
  database: string
  username: string
  /** encrypted credentials blob */
  enc: string
  readOnly: boolean
  scope: string
  ownerId: string
  filePath?: string
  region?: string
  localDataCenter?: string
  tls?: boolean
  connectionString?: string
}

const DATA_DIR = process.env.CONN_DATA_DIR || join(process.cwd(), '.data')
const STORE_FILE = join(DATA_DIR, 'connections.json')

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadStore(): Record<string, StoredServerConnection> {
  if (!existsSync(STORE_FILE)) return {}
  try {
    const raw = readFileSync(STORE_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveStore(store: Record<string, StoredServerConnection>): void {
  ensureDataDir()
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2))
}

/** Save a connection config with encrypted credentials. */
export function saveServerConnection(
  config: ConnectionConfig & { name?: string; readOnly?: boolean; scope?: string; ownerId?: string },
): void {
  const store = loadStore()
  const creds: ServerCredentials = {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
  }
  store[config.id] = {
    id: config.id,
    driver: config.driver,
    name: config.name || config.id,
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    enc: encryptServer(creds),
    readOnly: config.readOnly ?? false,
    scope: config.scope || 'personal',
    ownerId: config.ownerId || '',
    filePath: config.filePath,
    region: config.region,
    localDataCenter: config.localDataCenter,
    tls: config.tls,
    connectionString: config.connectionString,
  }
  saveStore(store)
}

/** Load a connection config with decrypted credentials. */
export function loadServerConnection(id: string): ConnectionConfig | null {
  const store = loadStore()
  const stored = store[id]
  if (!stored) return null
  const creds = decryptServer<ServerCredentials>(stored.enc)
  return {
    id: stored.id,
    driver: stored.driver,
    host: creds.host,
    port: creds.port,
    database: creds.database,
    username: creds.username,
    password: creds.password,
    filePath: stored.filePath,
    region: stored.region,
    localDataCenter: stored.localDataCenter,
    tls: stored.tls,
    connectionString: stored.connectionString,
  }
}

/** Delete a server-side connection. */
export function deleteServerConnection(id: string): void {
  const store = loadStore()
  delete store[id]
  saveStore(store)
}

/** List all server-side connection IDs. */
export function listServerConnectionIds(): string[] {
  return Object.keys(loadStore())
}
