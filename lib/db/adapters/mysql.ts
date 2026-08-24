import mysql from 'mysql2/promise'
import type { DBAdapter, ConnectionConfig, ColumnDef, QueryResult } from '../types'
import { DBError } from '../types'

const SYSTEM_SCHEMAS = new Set(['information_schema', 'mysql', 'performance_schema', 'sys'])

export class MysqlAdapter implements DBAdapter {
  private pool: mysql.Pool | null = null
  private config: ConnectionConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    try {
      this.pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database || undefined,
        connectionLimit: 5,
        connectTimeout: 10000,
        ssl: config.tls ? { rejectUnauthorized: false } : undefined,
      })
      const conn = await this.pool.getConnection()
      conn.release()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) return false
    try {
      const conn = await this.pool.getConnection()
      await conn.ping()
      conn.release()
      return true
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    try {
      const [rows] = await this.pool.query('SHOW DATABASES')
      return (rows as any[]).map((r) => r.Database as string).sort()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async listSchemas(database: string): Promise<string[]> {
    // MySQL doesn't have schemas — databases ARE schemas
    return [database]
  }

  async listTablesOrCollections(database: string, _schema?: string): Promise<string[]> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    try {
      // If we need a different database, create a temp connection
      if (this.config?.database !== database) {
        const conn = await mysql.createConnection({
          host: this.config!.host,
          port: this.config!.port,
          user: this.config!.username,
          password: this.config!.password,
          database,
        })
        try {
          const [rows] = await conn.query('SHOW TABLES')
          const key = Object.keys((rows as any[])[0] || {})[0]
          return (rows as any[]).map((r) => r[key] as string).sort()
        } finally {
          await conn.end()
        }
      }
      const [rows] = await this.pool.query('SHOW TABLES')
      const key = Object.keys((rows as any[])[0] || {})[0]
      return (rows as any[]).map((r) => r[key] as string).sort()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async getStructure(table: string, _schema?: string): Promise<ColumnDef[]> {
    if (!this.pool) throw new DBError('Not connected', 'unknown')
    try {
      const [rows] = await this.pool.query('SHOW COLUMNS FROM ??', [table])
      return (rows as any[]).map((r) => ({
        name: r.Field as string,
        type: r.Type as string,
        nullable: r.Null === 'YES',
        isPrimaryKey: r.Key === 'PRI',
        defaultValue: r.Default ?? undefined,
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
      const [result] = await this.pool.query(sql)
      const durationMs = Date.now() - start
      if (Array.isArray(result)) {
        return {
          columns: result.length > 0 ? Object.keys(result[0]) : [],
          rows: result as Record<string, unknown>[],
          durationMs,
          statement: sql,
        }
      }
      return {
        columns: [],
        rows: [],
        affectedRows: (result as any).affectedRows,
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

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    const code = err.code
    if (code === 'ER_ACCESS_DENIED_ERROR' || code === '1045') {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (code === 'ER_BAD_DB_ERROR' || code === '1049') {
      throw new DBError(`Database not found: ${msg}`, 'not-found', err)
    }
    if (code === 'ER_DBACCESS_DENIED' || code === 'ER_TABLEACCESS_DENIED' || code === '1142') {
      throw new DBError(`Permission denied: ${msg}`, 'permission', err)
    }
    if (code === 'ETIMEDOUT' || msg.includes('timeout')) {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || msg.includes('connect')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}

export { SYSTEM_SCHEMAS }
