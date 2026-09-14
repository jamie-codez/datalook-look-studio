import { Pool } from 'pg'
import type { DBAdapter, ConnectionConfig, ColumnDef, QueryResult, FieldSample, ServerMetrics } from '../types'
import { DBError } from '../types'

export class PostgresAdapter implements DBAdapter {
  private pool: Pool | null = null
  private config: ConnectionConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    try {
      // Connect to the maintenance database (postgres or template1) by default
      // so we can list all databases. If a specific database is provided, use it.
      const dbName = config.database || 'postgres'
      this.pool = new Pool({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: dbName,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: config.tls ? { rejectUnauthorized: false } : undefined,
      })
      // Verify connectivity
      const client = await this.pool.connect()
      client.release()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) return false
    try {
      const res = await this.pool.query('SELECT 1')
      return res.rowCount !== null
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    try {
      // Connect to maintenance DB if current pool isn't on one
      const res = await this.pool.query(
        "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
      )
      return res.rows.map((r) => r.datname as string)
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async listSchemas(database: string): Promise<string[]> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    try {
      // If we need to query a different database, create a temporary pool
      if (this.config?.database !== database) {
        const tempPool = new Pool({
          host: this.config!.host,
          port: this.config!.port,
          user: this.config!.username,
          password: this.config!.password,
          database,
          max: 1,
          connectionTimeoutMillis: 10000,
        })
        try {
          const res = await tempPool.query(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema' ORDER BY schema_name",
          )
          return res.rows.map((r) => r.schema_name as string)
        } finally {
          await tempPool.end()
        }
      }
      const res = await this.pool.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema' ORDER BY schema_name",
      )
      return res.rows.map((r) => r.schema_name as string)
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async listTablesOrCollections(database: string, schema?: string): Promise<string[]> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    try {
      const targetSchema = schema || 'public'
      // If different database, use temp pool
      if (this.config?.database !== database) {
        const tempPool = new Pool({
          host: this.config!.host,
          port: this.config!.port,
          user: this.config!.username,
          password: this.config!.password,
          database,
          max: 1,
          connectionTimeoutMillis: 10000,
        })
        try {
          const res = await tempPool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
            [targetSchema],
          )
          return res.rows.map((r) => r.table_name as string)
        } finally {
          await tempPool.end()
        }
      }
      const res = await this.pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
        [targetSchema],
      )
      return res.rows.map((r) => r.table_name as string)
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async getStructure(table: string, schema?: string): Promise<ColumnDef[]> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    try {
      const targetSchema = schema || 'public'
      const res = await this.pool.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = $2
         ORDER BY ordinal_position`,
        [table, targetSchema],
      )
      // Also check for primary keys
      const pkRes = await this.pool.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
         WHERE tc.constraint_type = 'PRIMARY KEY' AND kcu.table_name = $1 AND kcu.table_schema = $2`,
        [table, targetSchema],
      )
      const pkColumns = new Set(pkRes.rows.map((r) => r.column_name as string))
      return res.rows.map((r) => ({
        name: r.column_name as string,
        type: r.data_type as string,
        nullable: r.is_nullable === 'YES',
        isPrimaryKey: pkColumns.has(r.column_name as string),
        defaultValue: r.column_default as string | undefined,
      }))
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    const sql = String(raw)
    const start = Date.now()
    try {
      const res = await this.pool.query(sql)
      const durationMs = Date.now() - start
      return {
        columns: res.fields.map((f) => f.name),
        rows: res.rows as Record<string, unknown>[],
        affectedRows: res.rowCount ?? 0,
        durationMs,
        statement: sql,
      }
    } catch (err: any) {
      return {
        columns: [],
        rows: [],
        durationMs: Date.now() - start,
        error: err.message,
        statement: sql,
      }
    }
  }

  async getServerMetrics(): Promise<ServerMetrics> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    const metrics: ServerMetrics = {}

    try {
      const res = await this.pool.query('SELECT version() AS v')
      metrics.version = (res.rows[0]?.v as string)?.split(',')[0]
    } catch { /* leave unset */ }

    try {
      const res = await this.pool.query(
        "SELECT extract(epoch from now() - pg_postmaster_start_time())::bigint AS s",
      )
      metrics.uptimeSeconds = Number(res.rows[0]?.s)
    } catch { /* leave unset */ }

    try {
      const [count, max] = await Promise.all([
        this.pool.query('SELECT count(*)::int AS n FROM pg_stat_activity'),
        this.pool.query('SHOW max_connections'),
      ])
      metrics.connections = {
        current: count.rows[0]?.n,
        max: parseInt(max.rows[0]?.max_connections, 10) || undefined,
      }
    } catch { /* leave unset */ }

    try {
      const res = await this.pool.query(
        'SELECT sum(blks_hit)::float8 AS hit, sum(blks_read)::float8 AS reads FROM pg_stat_database',
      )
      const hit = Number(res.rows[0]?.hit) || 0
      const reads = Number(res.rows[0]?.reads) || 0
      if (hit + reads > 0) metrics.cacheHitRatio = hit / (hit + reads)
    } catch { /* leave unset */ }

    try {
      const res = await this.pool.query(
        'SELECT sum(xact_commit + xact_rollback)::float8 AS xacts FROM pg_stat_database',
      )
      const xacts = Number(res.rows[0]?.xacts) || 0
      if (metrics.uptimeSeconds && metrics.uptimeSeconds > 0) {
        metrics.opsPerSecond = xacts / metrics.uptimeSeconds
        metrics.opsPerSecondLabel = 'Transactions/sec (avg since start)'
      }
    } catch { /* leave unset */ }

    try {
      const res = await this.pool.query('SELECT pg_database_size(current_database()) AS sz')
      metrics.databaseSizeBytes = Number(res.rows[0]?.sz)
    } catch { /* leave unset */ }

    return metrics
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    const code = err.code
    if (code === '28P01' || code === '28000' || msg.includes('authentication')) {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (code === '3D000' || msg.includes('database') && msg.includes('does not exist')) {
      throw new DBError(`Database not found: ${msg}`, 'not-found', err)
    }
    if (code === '42501' || msg.includes('permission') || msg.includes('denied')) {
      throw new DBError(`Permission denied: ${msg}`, 'permission', err)
    }
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || code === '57P03') {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
