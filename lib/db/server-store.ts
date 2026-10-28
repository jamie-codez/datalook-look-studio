import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { encryptServer, decryptServer } from './server-crypto'
import type { ConnectionConfig } from './types'
import type { DriverId } from '@/lib/types'
import { SYSTEM_CONNECTION_ID } from '@/lib/system-store'
import { SYSTEM_BACKEND_IS_POSTGRES } from '@/lib/env'
import {
  listConnectionRecords,
  getConnectionRecord,
  upsertConnectionRecord,
  deleteConnectionRecord,
  replaceConnectionGrants,
  type ConnectionAccessRole,
  type ConnectionRecord,
} from './system-db'

/**
 * Server-side connection store. Route Handlers read from here to get
 * credentials without ever sending them to the client.
 *
 *  - SYSTEM_BACKEND=postgres: records live in datalook.connections in the
 *    system database, so every replica and every user sees the same set.
 *    This is the only option that works on serverless hosts (Vercel), whose
 *    filesystem is read-only.
 *  - otherwise (browser demo): a JSON file under CONN_DATA_DIR, good enough
 *    for `pnpm dev` on a single machine.
 *
 * Both backends hold the same ConnectionRecord shape. Passwords and
 * connection strings are only ever inside `configEnc`, encrypted with
 * CONN_ENCRYPTION_KEY (lib/db/server-crypto.ts).
 */

/** Everything inside the encrypted blob. */
interface EncryptedCredentials {
  host: string
  port: number
  database: string
  username: string
  password: string
  connectionString?: string
}

export type ServerConnectionRecord = ConnectionRecord

export interface SaveServerConnectionInput {
  id: string
  driver: DriverId
  name?: string
  host: string
  port: number
  database: string
  username: string
  password: string
  readOnly?: boolean
  scope?: string
  ownerId?: string
  topology?: string | null
  replicaHosts?: unknown
  filePath?: string
  region?: string
  localDataCenter?: string
  tls?: boolean
  connectionString?: string
}

const DATA_DIR = process.env.CONN_DATA_DIR || join(process.cwd(), '.data')
const STORE_FILE = join(DATA_DIR, 'connections.json')

function usePostgres(): boolean {
  return SYSTEM_BACKEND_IS_POSTGRES && !!process.env.PGHOST
}

function loadFileStore(): Record<string, ServerConnectionRecord> {
  if (!existsSync(STORE_FILE)) return {}
  try {
    return JSON.parse(readFileSync(STORE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveFileStore(store: Record<string, ServerConnectionRecord>): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2))
}

async function getRecord(id: string): Promise<ServerConnectionRecord | null> {
  if (usePostgres()) return getConnectionRecord(id)
  return loadFileStore()[id] ?? null
}

async function listRecords(): Promise<ServerConnectionRecord[]> {
  if (usePostgres()) return listConnectionRecords()
  return Object.values(loadFileStore())
}

/** Non-secret options are kept in plain columns/JSON; credentials are not. */
function optionsFrom(input: SaveServerConnectionInput): Record<string, unknown> {
  const options: Record<string, unknown> = {}
  if (input.filePath !== undefined) options.filePath = input.filePath
  if (input.region !== undefined) options.region = input.region
  if (input.localDataCenter !== undefined) options.localDataCenter = input.localDataCenter
  if (input.tls !== undefined) options.tls = input.tls
  if (input.replicaHosts !== undefined) options.replicaHosts = input.replicaHosts
  return options
}

/** Save (create or replace) a connection record with encrypted credentials. */
export async function saveServerConnection(input: SaveServerConnectionInput): Promise<void> {
  const creds: EncryptedCredentials = {
    host: input.host,
    port: input.port,
    database: input.database,
    username: input.username,
    password: input.password,
    connectionString: input.connectionString,
  }
  const record: ServerConnectionRecord = {
    id: input.id,
    name: input.name || input.id,
    driver: input.driver,
    host: input.host,
    port: input.port,
    database: input.database,
    username: input.username,
    scope: input.scope === 'shared' ? 'shared' : 'personal',
    ownerId: input.ownerId || '',
    readOnly: input.readOnly ?? false,
    topology: input.topology ?? 'standalone',
    options: optionsFrom(input),
    configEnc: encryptServer(creds),
    grants: [],
  }

  if (usePostgres()) {
    // Grants are owned by replaceConnectionGrants, so keep whatever is stored.
    await upsertConnectionRecord(record)
    return
  }
  const store = loadFileStore()
  record.grants = store[input.id]?.grants ?? []
  store[input.id] = record
  saveFileStore(store)
}

/** Load a connection config with decrypted credentials. Route Handlers only. */
export async function loadServerConnection(id: string): Promise<ConnectionConfig | null> {
  const record = await getRecord(id)
  if (!record) {
    return id === SYSTEM_CONNECTION_ID ? systemConnectionConfig() : null
  }
  if (!record.configEnc) return null
  const creds = decryptServer<EncryptedCredentials>(record.configEnc)
  const options = record.options as Partial<ConnectionConfig>
  return {
    id: record.id,
    driver: record.driver as DriverId,
    host: creds.host,
    port: creds.port,
    database: creds.database,
    username: creds.username,
    password: creds.password,
    filePath: options.filePath,
    region: options.region,
    localDataCenter: options.localDataCenter,
    tls: options.tls,
    connectionString: creds.connectionString,
  }
}

/** Non-secret record fields, for access checks and the connection list. */
export async function loadServerConnectionRecord(id: string): Promise<ServerConnectionRecord | null> {
  return getRecord(id)
}

export async function listServerConnectionRecords(): Promise<ServerConnectionRecord[]> {
  return listRecords()
}

export async function setServerConnectionGrants(
  id: string,
  grants: { userId: string; role: ConnectionAccessRole }[],
): Promise<void> {
  if (usePostgres()) {
    await replaceConnectionGrants(id, grants)
    return
  }
  const store = loadFileStore()
  if (!store[id]) throw new Error(`Connection ${id} not found`)
  store[id].grants = grants
  saveFileStore(store)
}

/** Delete a server-side connection. */
export async function deleteServerConnection(id: string): Promise<void> {
  if (usePostgres()) {
    await deleteConnectionRecord(id)
    return
  }
  const store = loadFileStore()
  delete store[id]
  saveFileStore(store)
}

/**
 * The system store's own connection (conn-system) is never created through
 * the "New Connection" dialog — it's provisioned automatically from the
 * same PG* env vars scripts/init-db.ts uses, so that browsing it in the
 * navigator hits the real "datalook" schema instead of 404ing.
 */
function systemConnectionConfig(): ConnectionConfig | null {
  if (!process.env.PGHOST) return null
  return {
    id: SYSTEM_CONNECTION_ID,
    driver: 'postgres',
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.SYSTEM_DB_NAME || 'datalook-studio',
    username: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  }
}
