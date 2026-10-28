import sql from 'mssql'
import type { DBAdapter, ConnectionConfig, ColumnDef, QueryResult, ServerMetrics } from '../types'
import { DBError } from '../types'

/**
 * SQL Server adapter (wire protocol via tedious). SQL Server scopes
 * connections to one database, so this keeps a small pool per database it
 * has been asked about; the configured database is the default.
 */
export class MssqlAdapter implements DBAdapter {
  private base: ConnectionConfig | null = null
  private pools = new Map<string, sql.ConnectionPool>()

  private poolConfig(database: string): sql.config {
    const b = this.base!
    return {
      server: b.host,
      port: b.port || 1433,
      user: b.username,
      password: b.password,
      database,
      // Encrypted by default, as Azure and current SQL Server builds expect.
      // Set tls to false for a local server that has no certificate.
      options: {
        encrypt: b.tls ?? true,
        trustServerCertificate: false,
        enableArithAbort: true,
      },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    }
  }

  private async poolFor(database?: string): Promise<sql.ConnectionPool> {
    if (!this.base) throw new DBError('Not connected', 'unknown')
    const name = database || this.base.database || 'master'
    const existing = this.pools.get(name)
    if (existing?.connected) return existing
    const pool = new sql.ConnectionPool(this.poolConfig(name))
    try {
      await pool.connect()
    } catch (err) {
      this.classifyError(err)
    }
    this.pools.set(name, pool)
    return pool
  }

  async connect(config: ConnectionConfig): Promise<void> {
    this.base = config
    await this.poolFor(config.database || 'master')
  }

  async testConnection(): Promise<boolean> {
    try {
      const pool = await this.poolFor()
      await pool.request().query('SELECT 1 AS ok')
      return true
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    try {
      const pool = await this.poolFor('master')
      const res = await pool.request().query(
        "SELECT name FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name",
      )
      return res.recordset.map((r) => r.name as string)
    } catch (err) {
      this.classifyError(err)
    }
  }

  async listSchemas(database: string): Promise<string[]> {
    try {
      const pool = await this.poolFor(database)
      // Schema ids 16384–16393 are the fixed database roles, not user schemas.
      const res = await pool.request().query(
        `SELECT name FROM sys.schemas
          WHERE schema_id NOT BETWEEN 16384 AND 16393
            AND name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')
          ORDER BY name`,
      )
      return res.recordset.map((r) => r.name as string)
    } catch (err) {
      this.classifyError(err)
    }
  }

  async listTablesOrCollections(database: string, schema?: string): Promise<string[]> {
    try {
      const pool = await this.poolFor(database)
      const res = await pool
        .request()
        .input('schema', sql.NVarChar, schema || 'dbo')
        .query(
          `SELECT t.name FROM sys.tables t
             JOIN sys.schemas s ON s.schema_id = t.schema_id
            WHERE s.name = @schema
            ORDER BY t.name`,
        )
      return res.recordset.map((r) => r.name as string)
    } catch (err) {
      this.classifyError(err)
    }
  }

  async getStructure(table: string, schema?: string): Promise<ColumnDef[]> {
    try {
      const pool = await this.poolFor()
      const schemaName = schema || 'dbo'
      const columns = await pool
        .request()
        .input('schema', sql.NVarChar, schemaName)
        .input('table', sql.NVarChar, table)
        .query(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
                  CHARACTER_MAXIMUM_LENGTH, ORDINAL_POSITION
             FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
            ORDER BY ORDINAL_POSITION`,
        )
      const pks = await pool
        .request()
        .input('schema', sql.NVarChar, schemaName)
        .input('table', sql.NVarChar, table)
        .query(
          `SELECT kcu.COLUMN_NAME
             FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
             JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
               ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
              AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
            WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
              AND tc.TABLE_SCHEMA = @schema AND tc.TABLE_NAME = @table`,
        )
      const pkColumns = new Set(pks.recordset.map((r) => r.COLUMN_NAME as string))
      return columns.recordset.map((r) => {
        const length = r.CHARACTER_MAXIMUM_LENGTH as number | null
        const type = r.DATA_TYPE as string
        return {
          name: r.COLUMN_NAME as string,
          type: length && length > 0 ? `${type}(${length === -1 ? 'max' : length})` : type,
          nullable: r.IS_NULLABLE === 'YES',
          isPrimaryKey: pkColumns.has(r.COLUMN_NAME as string),
          defaultValue: (r.COLUMN_DEFAULT as string | null) ?? undefined,
        }
      })
    } catch (err) {
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    const text = String(raw)
    const start = Date.now()
    try {
      const pool = await this.poolFor()
      const res = await pool.request().query(text)
      const durationMs = Date.now() - start
      const rows = (res.recordset ?? []) as Record<string, unknown>[]
      const columns = res.recordset?.columns
        ? Object.keys(res.recordset.columns)
        : rows[0]
          ? Object.keys(rows[0])
          : []
      return {
        columns,
        rows,
        affectedRows: res.rowsAffected.reduce((sum, n) => sum + n, 0),
        durationMs,
        statement: text,
      }
    } catch (err) {
      return {
        columns: [],
        rows: [],
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        statement: text,
      }
    }
  }

  async getServerMetrics(): Promise<ServerMetrics> {
    const metrics: ServerMetrics = {}
    let pool: sql.ConnectionPool
    try {
      pool = await this.poolFor()
    } catch (err) {
      this.classifyError(err)
    }

    try {
      const res = await pool.request().query(
        "SELECT CONVERT(varchar(128), SERVERPROPERTY('ProductVersion')) AS v, CONVERT(varchar(128), SERVERPROPERTY('ProductLevel')) AS lvl",
      )
      const row = res.recordset[0]
      metrics.version = row ? `SQL Server ${row.v} ${row.lvl}` : undefined
    } catch { /* leave unset */ }

    try {
      const res = await pool.request().query(
        'SELECT DATEDIFF(second, sqlserver_start_time, GETDATE()) AS s FROM sys.dm_os_sys_info',
      )
      metrics.uptimeSeconds = Number(res.recordset[0]?.s)
    } catch { /* leave unset */ }

    try {
      const res = await pool.request().query(`
        SELECT COUNT(*) AS n
          FROM sys.dm_exec_sessions
         WHERE is_user_process = 1`)
      metrics.connections = { current: Number(res.recordset[0]?.n) }
    } catch { /* leave unset */ }

    try {
      const res = await pool.request().query(`
        SELECT cntr_value AS n FROM sys.dm_os_performance_counters
         WHERE counter_name = 'Batch Requests/sec' AND object_name LIKE '%SQL Statistics%'`)
      const batches = Number(res.recordset[0]?.n) || 0
      if (metrics.uptimeSeconds && metrics.uptimeSeconds > 0) {
        metrics.opsPerSecond = batches / metrics.uptimeSeconds
        metrics.opsPerSecondLabel = 'Batch requests/sec (avg since start)'
      }
    } catch { /* leave unset */ }

    try {
      const res = await pool.request().query(
        'SELECT SUM(size) * 8.0 * 1024 AS bytes FROM sys.master_files WHERE database_id = DB_ID()',
      )
      metrics.databaseSizeBytes = Number(res.recordset[0]?.bytes)
    } catch { /* leave unset */ }

    return metrics
  }

  async disconnect(): Promise<void> {
    const pools = Array.from(this.pools.values())
    this.pools.clear()
    await Promise.all(pools.map((p) => p.close().catch(() => {})))
  }

  private classifyError(err: unknown): never {
    const e = err as { message?: string; code?: string } | undefined
    const msg = e?.message || String(err)
    if (msg.includes('Login failed') || e?.code === 'ELOGIN') {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (msg.includes('Cannot open database') || msg.includes('does not exist')) {
      throw new DBError(`Database not found: ${msg}`, 'not-found', err)
    }
    if (msg.includes('permission') || msg.includes('denied')) {
      throw new DBError(`Permission denied: ${msg}`, 'permission', err)
    }
    if (e?.code === 'ETIMEOUT' || msg.includes('Timeout')) {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (e?.code === 'ESOCKET' || e?.code === 'ECONNREFUSED' || msg.includes('ENOTFOUND')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
