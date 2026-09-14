import { Pool, Client, type PoolClient } from 'pg'
import type { User, CustomRole, AuditLogItem, AuditStatus, Role, Permission, QueryHistoryItem, StatementType } from '@/lib/types'

/**
 * Data access layer for the real (Postgres-backed) system store: the
 * "datalook" schema that scripts/init-db.ts provisions, holding users,
 * roles, the audit log, and query history. Used only server-side (Route
 * Handlers) when NEXT_PUBLIC_SYSTEM_BACKEND=postgres (see lib/env.ts).
 *
 * The connections table created by init-db.ts is still schema-only —
 * connection credentials continue to live in lib/db/server-store.ts, and
 * mapping this app's string connection ids onto that table's bigserial PK
 * (plus safely relocating encrypted credential storage off the server
 * filesystem) is a bigger change than this pass takes on. See
 * docs/architecture.md "Known gaps".
 */

const PGHOST = process.env.PGHOST || 'localhost'
const PGPORT = parseInt(process.env.PGPORT || '5432', 10)
const PGUSER = process.env.PGUSER || 'postgres'
const PGPASSWORD = process.env.PGPASSWORD || 'postgres'
const SYSTEM_DB_NAME = process.env.SYSTEM_DB_NAME || 'datalook-studio'

let pool: Pool | null | undefined
let schemaReady: Promise<void> | null = null

/**
 * Returns the shared connection pool, or null when no real Postgres system
 * backend is configured (PGHOST unset) — callers should treat null as
 * "system backend not configured" rather than throwing.
 */
export function getSystemPool(): Pool | null {
  if (pool !== undefined) return pool
  if (!process.env.PGHOST) {
    pool = null
    return pool
  }
  pool = new Pool({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: SYSTEM_DB_NAME,
    max: 5,
  })
  return pool
}

export async function ensureSchema(client: Pool | PoolClient | Client): Promise<void> {
  await client.query('CREATE SCHEMA IF NOT EXISTS datalook')

  await client.query(`
    CREATE TABLE IF NOT EXISTS datalook.users (
      id          BIGSERIAL PRIMARY KEY,
      name        VARCHAR(120) NOT NULL,
      email       VARCHAR(255) NOT NULL UNIQUE,
      role        VARCHAR(24)  NOT NULL DEFAULT 'Viewer',
      custom_role_id VARCHAR(48),
      password_hash VARCHAR(255),
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS datalook.roles (
      id          BIGSERIAL PRIMARY KEY,
      name        VARCHAR(80) NOT NULL UNIQUE,
      description TEXT,
      permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
      color       VARCHAR(48),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS datalook.connections (
      id          BIGSERIAL PRIMARY KEY,
      name        VARCHAR(120) NOT NULL,
      driver      VARCHAR(24)  NOT NULL,
      host        VARCHAR(255) NOT NULL,
      port        INTEGER,
      database    VARCHAR(255),
      username    VARCHAR(120),
      password_enc TEXT,
      scope       VARCHAR(12)  NOT NULL DEFAULT 'personal',
      owner_id    VARCHAR(48),
      encrypted   BOOLEAN      NOT NULL DEFAULT false,
      read_only   BOOLEAN      NOT NULL DEFAULT false,
      topology    VARCHAR(24)  DEFAULT 'standalone',
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS datalook.audit_log (
      id          BIGSERIAL PRIMARY KEY,
      action      VARCHAR(80)  NOT NULL,
      actor       VARCHAR(120),
      role        VARCHAR(24),
      target      VARCHAR(255),
      status      VARCHAR(16)  NOT NULL DEFAULT 'allowed',
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS datalook.query_history (
      id              BIGSERIAL PRIMARY KEY,
      connection_id   BIGINT,
      statement_type  VARCHAR(16),
      body            TEXT,
      duration_ms     INTEGER,
      status          VARCHAR(16),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  // connection_id can't be populated yet (see file header — connections
  // aren't mirrored into Postgres), so keep the human-readable name and row
  // count alongside it rather than losing them entirely.
  await client.query(`ALTER TABLE datalook.query_history ADD COLUMN IF NOT EXISTS connection_name VARCHAR(120)`)
  await client.query(`ALTER TABLE datalook.query_history ADD COLUMN IF NOT EXISTS row_count INTEGER`)

  await client.query(`
    CREATE TABLE IF NOT EXISTS datalook.connection_grants (
      id              BIGSERIAL PRIMARY KEY,
      connection_id   BIGINT NOT NULL REFERENCES datalook.connections(id) ON DELETE CASCADE,
      user_id         BIGINT NOT NULL REFERENCES datalook.users(id) ON DELETE CASCADE,
      role            VARCHAR(24) NOT NULL DEFAULT 'viewer',
      UNIQUE(connection_id, user_id)
    )
  `)
}

/** Ensure the schema exists, memoized for the process lifetime. */
async function withSchema(p: Pool): Promise<Pool> {
  if (!schemaReady) schemaReady = ensureSchema(p)
  await schemaReady
  return p
}

async function requirePool(): Promise<Pool> {
  const p = getSystemPool()
  if (!p) throw new Error('System backend not configured (PGHOST is not set)')
  return withSchema(p)
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface UserRow {
  id: string
  name: string
  email: string
  role: Role
  custom_role_id: string | null
  password_hash: string | null
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    initials: initialsFrom(row.name),
    customRoleId: row.custom_role_id ?? undefined,
  }
}

export async function listUsers(): Promise<User[]> {
  const p = await requirePool()
  const res = await p.query<UserRow>(
    'SELECT id::text, name, email, role, custom_role_id, password_hash FROM datalook.users ORDER BY id',
  )
  return res.rows.map(toUser)
}

export async function findUserByEmail(
  email: string,
): Promise<(User & { passwordHash: string | null }) | null> {
  const p = await requirePool()
  const res = await p.query<UserRow>(
    'SELECT id::text, name, email, role, custom_role_id, password_hash FROM datalook.users WHERE email = $1',
    [email.toLowerCase()],
  )
  const row = res.rows[0]
  if (!row) return null
  return { ...toUser(row), passwordHash: row.password_hash }
}

export async function getUserById(id: string): Promise<User | null> {
  const p = await requirePool()
  const res = await p.query<UserRow>(
    'SELECT id::text, name, email, role, custom_role_id, password_hash FROM datalook.users WHERE id = $1',
    [id],
  )
  const row = res.rows[0]
  return row ? toUser(row) : null
}

export async function createUser(input: {
  name: string
  email: string
  role: Role
  passwordHash?: string
  customRoleId?: string
}): Promise<User> {
  const p = await requirePool()
  const res = await p.query<UserRow>(
    `INSERT INTO datalook.users (name, email, role, custom_role_id, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id::text, name, email, role, custom_role_id, password_hash`,
    [input.name, input.email.toLowerCase(), input.role, input.customRoleId ?? null, input.passwordHash ?? null],
  )
  return toUser(res.rows[0])
}

export async function updateUser(
  id: string,
  updates: { name?: string; email?: string; role?: Role; passwordHash?: string; customRoleId?: string | null },
): Promise<User | null> {
  const p = await requirePool()
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1
  if (updates.name !== undefined) { sets.push(`name = $${i++}`); values.push(updates.name) }
  if (updates.email !== undefined) { sets.push(`email = $${i++}`); values.push(updates.email.toLowerCase()) }
  if (updates.role !== undefined) { sets.push(`role = $${i++}`); values.push(updates.role) }
  if (updates.passwordHash !== undefined) { sets.push(`password_hash = $${i++}`); values.push(updates.passwordHash) }
  if (updates.customRoleId !== undefined) { sets.push(`custom_role_id = $${i++}`); values.push(updates.customRoleId) }
  if (sets.length === 0) return getUserById(id)
  values.push(id)
  const res = await p.query<UserRow>(
    `UPDATE datalook.users SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING id::text, name, email, role, custom_role_id, password_hash`,
    values,
  )
  return res.rows[0] ? toUser(res.rows[0]) : null
}

export async function deleteUser(id: string): Promise<void> {
  const p = await requirePool()
  await p.query('DELETE FROM datalook.users WHERE id = $1', [id])
}

interface RoleRow {
  id: string
  name: string
  description: string | null
  permissions: Permission[]
  color: string | null
}

function toCustomRole(row: RoleRow): CustomRole {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    permissions: row.permissions ?? [],
    color: row.color ?? 'var(--chart-1)',
  }
}

export async function listRoles(): Promise<CustomRole[]> {
  const p = await requirePool()
  const res = await p.query<RoleRow>(
    'SELECT id::text, name, description, permissions, color FROM datalook.roles ORDER BY id',
  )
  return res.rows.map(toCustomRole)
}

export async function createRole(input: {
  name: string
  description: string
  permissions: Permission[]
  color: string
}): Promise<CustomRole> {
  const p = await requirePool()
  const res = await p.query<RoleRow>(
    `INSERT INTO datalook.roles (name, description, permissions, color)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id::text, name, description, permissions, color`,
    [input.name, input.description, JSON.stringify(input.permissions), input.color],
  )
  return toCustomRole(res.rows[0])
}

export async function updateRole(
  id: string,
  updates: { name?: string; description?: string; permissions?: Permission[]; color?: string },
): Promise<CustomRole | null> {
  const p = await requirePool()
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1
  if (updates.name !== undefined) { sets.push(`name = $${i++}`); values.push(updates.name) }
  if (updates.description !== undefined) { sets.push(`description = $${i++}`); values.push(updates.description) }
  if (updates.permissions !== undefined) { sets.push(`permissions = $${i++}::jsonb`); values.push(JSON.stringify(updates.permissions)) }
  if (updates.color !== undefined) { sets.push(`color = $${i++}`); values.push(updates.color) }
  if (sets.length === 0) {
    const res = await p.query<RoleRow>('SELECT id::text, name, description, permissions, color FROM datalook.roles WHERE id = $1', [id])
    return res.rows[0] ? toCustomRole(res.rows[0]) : null
  }
  values.push(id)
  const res = await p.query<RoleRow>(
    `UPDATE datalook.roles SET ${sets.join(', ')} WHERE id = $${i}
     RETURNING id::text, name, description, permissions, color`,
    values,
  )
  return res.rows[0] ? toCustomRole(res.rows[0]) : null
}

export async function deleteRole(id: string): Promise<void> {
  const p = await requirePool()
  await p.query('UPDATE datalook.users SET custom_role_id = NULL WHERE custom_role_id = $1', [id])
  await p.query('DELETE FROM datalook.roles WHERE id = $1', [id])
}

interface AuditRow {
  id: string
  action: string
  actor: string | null
  role: string | null
  target: string | null
  status: AuditStatus
  created_at: Date
}

function toAuditItem(row: AuditRow): AuditLogItem {
  return {
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    userName: row.actor ?? 'Unknown',
    role: (row.role as Role) ?? 'Viewer',
    action: row.action,
    target: row.target ?? '',
    status: row.status,
  }
}

export async function listAuditLog(limit = 500): Promise<AuditLogItem[]> {
  const p = await requirePool()
  const res = await p.query<AuditRow>(
    'SELECT id::text, action, actor, role, target, status, created_at FROM datalook.audit_log ORDER BY id DESC LIMIT $1',
    [limit],
  )
  return res.rows.map(toAuditItem)
}

export async function appendAuditLog(entry: {
  action: string
  actor: string
  role: Role
  target: string
  status: AuditStatus
}): Promise<void> {
  const p = await requirePool()
  await p.query(
    `INSERT INTO datalook.audit_log (action, actor, role, target, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.action, entry.actor, entry.role, entry.target, entry.status],
  )
}

export async function countUsers(): Promise<number> {
  const p = await requirePool()
  const res = await p.query('SELECT COUNT(*)::int AS n FROM datalook.users')
  return res.rows[0].n
}

interface QueryHistoryRow {
  id: string
  statement_type: string | null
  body: string | null
  duration_ms: number | null
  status: string | null
  connection_name: string | null
  row_count: number | null
  created_at: Date
}

function toQueryHistoryItem(row: QueryHistoryRow): QueryHistoryItem {
  return {
    id: row.id,
    sql: row.body ?? '',
    timestamp: new Date(row.created_at).getTime(),
    durationMs: row.duration_ms ?? 0,
    status: (row.status as QueryHistoryItem['status']) ?? 'success',
    connectionName: row.connection_name ?? '',
    rowCount: row.row_count ?? 0,
    statementType: (row.statement_type as StatementType) ?? 'UNKNOWN',
  }
}

export async function listQueryHistory(limit = 200): Promise<QueryHistoryItem[]> {
  const p = await requirePool()
  const res = await p.query<QueryHistoryRow>(
    `SELECT id::text, statement_type, body, duration_ms, status, connection_name, row_count, created_at
     FROM datalook.query_history ORDER BY id DESC LIMIT $1`,
    [limit],
  )
  return res.rows.map(toQueryHistoryItem)
}

export async function appendQueryHistory(item: {
  sql: string
  durationMs: number
  status: string
  connectionName: string
  rowCount: number
  statementType: string
}): Promise<void> {
  const p = await requirePool()
  await p.query(
    `INSERT INTO datalook.query_history (statement_type, body, duration_ms, status, connection_name, row_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [item.statementType, item.sql, item.durationMs, item.status, item.connectionName, item.rowCount],
  )
}
