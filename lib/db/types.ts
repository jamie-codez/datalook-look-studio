import type { DriverId } from '@/lib/types'

/** Configuration needed to connect to a database. */
export interface ConnectionConfig {
  id: string
  driver: DriverId
  host: string
  port: number
  database: string
  username: string
  password: string
  /** for SQLite: file path; for DynamoDB: region */
  filePath?: string
  region?: string
  /** Cassandra: local data center */
  localDataCenter?: string
  /** TLS/SSL options */
  tls?: boolean
  /** additional connection string params */
  connectionString?: string
}

/** Column definition for SQL-like engines. */
export interface ColumnDef {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey?: boolean
  defaultValue?: string
}

/** Field sample for NoSQL engines (MongoDB/CouchDB/DynamoDB/etc). */
export interface FieldSample {
  /** sampled field paths → inferred type */
  fields: { name: string; type: string; sample?: unknown }[]
  /** total document/key count if available */
  count?: number
}

/** Result of a native query (not unified across engines). */
export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  affectedRows?: number
  durationMs: number
  error?: string
  /** the native query/statement that was executed */
  statement: string
}

/**
 * Live server metrics. Every field is optional — an adapter only populates
 * what its driver can genuinely report; nothing here is ever fabricated.
 * `unavailableReason` explains why some (or all) fields are missing, e.g.
 * "requires clusterMonitor role" or "embedded DB, no server process".
 */
export interface ServerMetrics {
  version?: string
  uptimeSeconds?: number
  connections?: { current: number; max?: number }
  /** resident memory used by the server process, in bytes */
  memoryBytes?: number
  /** 0-1 */
  cacheHitRatio?: number
  opsPerSecond?: number
  /** human label for what opsPerSecond actually measures, e.g. "Queries/sec (avg)" */
  opsPerSecondLabel?: string
  databaseSizeBytes?: number
  /** extra driver-specific facts with no common shape (cluster name, table count, …) */
  extra?: Record<string, string | number>
  unavailableReason?: string
}

/** Structured error types for granular UI feedback. */
export class DBError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'network' | 'timeout' | 'permission' | 'not-found' | 'unsupported' | 'unknown',
    public cause?: unknown,
  ) {
    super(message)
    this.name = 'DBError'
  }
}

/** Common adapter interface every engine implements. */
export interface DBAdapter {
  /** Establish the underlying connection (pool/client). */
  connect(config: ConnectionConfig): Promise<void>
  /** Fast, side-effect-free connectivity check. */
  testConnection(): Promise<boolean>
  /** List all databases/keyspaces/equivalent top-level namespaces. */
  listDatabases(): Promise<string[]>
  /** List schemas within a database (SQL engines only). */
  listSchemas?(database: string): Promise<string[]>
  /** List tables, collections, or equivalent within a database/schema. */
  listTablesOrCollections(database: string, schema?: string): Promise<string[]>
  /** Get column definitions (SQL) or field samples (NoSQL). */
  getStructure(container: string, schema?: string): Promise<ColumnDef[] | FieldSample>
  /** Execute a native query (SQL, Mongo pipeline, Redis command, etc). */
  query(raw: unknown): Promise<QueryResult>
  /** Live server metrics, when this driver can report any. */
  getServerMetrics?(): Promise<ServerMetrics>
  /** Close the underlying connection. */
  disconnect(): Promise<void>
}
