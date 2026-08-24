import { createClient, type ClickHouseClient } from '@clickhouse/client'
import type { DBAdapter, ConnectionConfig, ColumnDef, QueryResult } from '../types'
import { DBError } from '../types'

export class ClickHouseAdapter implements DBAdapter {
  private client: ClickHouseClient | null = null
  private config: ConnectionConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    try {
      // ClickHouse is HTTP-based (port 8123 by default), not a persistent TCP connection.
      // Each request is its own HTTP call, so "connect" just creates the client.
      this.client = createClient({
        url: `http://${config.host}:${config.port}`,
        username: config.username,
        password: config.password,
        database: config.database || 'default',
        clickhouse_settings: {
          // Allow reading multi-line data
          max_result_rows: '10000',
        },
      })
      // Verify connectivity with a lightweight SELECT 1
      await this.client.query({ query: 'SELECT 1', format: 'JSONEachRow' })
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false
    try {
      const rs = await this.client.query({ query: 'SELECT 1', format: 'JSONEachRow' })
      await rs.json()
      return true
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const rs = await this.client.query({
        query: 'SELECT name FROM system.databases ORDER BY name',
        format: 'JSONEachRow',
      })
      const rows = await rs.json<{ name: string }>()
      return rows.map((r) => r.name)
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async listSchemas(_database: string): Promise<string[]> {
    // ClickHouse doesn't have schemas — databases are the top-level container
    return []
  }

  async listTablesOrCollections(database: string, _schema?: string): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const rs = await this.client.query({
        query: `SELECT name FROM system.tables WHERE database = {db:String} ORDER BY name`,
        query_params: { db: database },
        format: 'JSONEachRow',
      })
      const rows = await rs.json<{ name: string }>()
      return rows.map((r) => r.name)
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async getStructure(table: string, _schema?: string): Promise<ColumnDef[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const rs = await this.client.query({
        query: `SELECT name, type, is_in_primary_key, default_kind, default_expression
                 FROM system.columns
                 WHERE table = {tbl:String}
                 ORDER BY position`,
        query_params: { tbl: table },
        format: 'JSONEachRow',
      })
      const rows = await rs.json<{
        name: string
        type: string
        is_in_primary_key: number
        default_kind: string
        default_expression: string
      }>()
      return rows.map((r) => ({
        name: r.name,
        type: r.type,
        nullable: !r.type.includes('Nullable'),
        isPrimaryKey: r.is_in_primary_key === 1,
        defaultValue: r.default_expression || undefined,
      }))
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    const sql = String(raw)
    const start = Date.now()
    try {
      const rs = await this.client.query({ query: sql, format: 'JSONEachRow' })
      const rows = await rs.json<Record<string, unknown>>()
      const durationMs = Date.now() - start
      const columns = rows.length > 0 ? Object.keys(rows[0]) : []
      return {
        columns,
        rows,
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
    if (this.client) {
      await this.client.close()
      this.client = null
    }
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    if (msg.includes('Authentication') || msg.includes('401') || msg.includes('403')) {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    if (msg.includes('UNKNOWN_DATABASE') || msg.includes('does not exist')) {
      throw new DBError(`Database not found: ${msg}`, 'not-found', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
