// Core domain types for the database studio.

export type Role = 'Admin' | 'Editor' | 'Viewer'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  /** short initials used in the avatar */
  initials: string
}

export type DriverId =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'clickhouse'
  | 'cockroach'
  | 'mssql'
  | 'mongodb'
  | 'couchdb'
  | 'redis'
  | 'cassandra'
  | 'dynamodb'

/**
 * Broad data-model family a driver belongs to. Drives how a store's contents
 * are labelled (schemas vs. databases, tables vs. collections vs. keyspaces)
 * and how sample data is shaped, even though everything renders in a grid.
 */
export type DriverCategory = 'sql' | 'document' | 'keyvalue' | 'widecolumn'

export interface Column {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  references?: string
  defaultValue?: string
}

export type TableKind = 'table' | 'view' | 'collection' | 'keyspace'

export interface TableMeta {
  id: string
  name: string
  kind: TableKind
  columns: Column[]
  rowCount: number
  /** cached generated rows */
  sampleRows?: Record<string, unknown>[]
}

export interface Procedure {
  id: string
  name: string
  returns: string
  language: string
}

export interface SchemaMeta {
  id: string
  name: string
  tables: TableMeta[]
  procedures: Procedure[]
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'error'

/** Whether a connection is shared with the team or private to its owner. */
export type ConnectionScope = 'shared' | 'personal'

/** Per-connection access tier, distinct from the global platform Role. */
export type ConnectionRole = 'viewer' | 'editor' | 'manager' | 'admin'

/** A single user's access grant on a shared connection. */
export interface ConnectionGrant {
  userId: string
  role: ConnectionRole
}

export interface Connection {
  id: string
  name: string
  driver: DriverId
  host: string
  port: number
  database: string
  username: string
  status: ConnectionStatus
  readOnly: boolean
  schemas: SchemaMeta[]
  /** tailwind-ish token used to tint the connection dot */
  accent: string
  version: string
  uptimeHours: number
  /** 'shared' = team connection governed by grants; 'personal' = owner-only */
  scope: ConnectionScope
  /** user id of the creator; owner always has full (admin) access */
  ownerId: string
  /** per-user access grants; only meaningful for shared connections */
  grants: ConnectionGrant[]
  /** true when this connection's credentials are encrypted at rest (IndexedDB) */
  encrypted?: boolean
  /** true for the pinned system store that backs the app's own metadata */
  isSystem?: boolean
}

export type TabKind =
  | 'sql'
  | 'data'
  | 'properties'
  | 'server-status'
  | 'users'
  | 'audit'

export interface Tab {
  id: string
  kind: TabKind
  title: string
  connectionId?: string
  schemaName?: string
  tableId?: string
  /** live sql for editor tabs */
  sql?: string
  dirty?: boolean
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  affectedRows?: number
  durationMs: number
  error?: string
  statement: string
}

export type StatementType =
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'CREATE'
  | 'DROP'
  | 'ALTER'
  | 'TRUNCATE'
  | 'UNKNOWN'

export interface QueryHistoryItem {
  id: string
  sql: string
  timestamp: number
  durationMs: number
  status: 'success' | 'error' | 'blocked'
  connectionName: string
  rowCount: number
  statementType: StatementType
}

export type AuditStatus = 'allowed' | 'blocked'

export interface AuditLogItem {
  id: string
  timestamp: number
  userName: string
  role: Role
  action: string
  target: string
  status: AuditStatus
}
