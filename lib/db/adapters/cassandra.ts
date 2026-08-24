import { Client as CassandraClient } from 'cassandra-driver'
import type { DBAdapter, ConnectionConfig, ColumnDef, QueryResult } from '../types'
import { DBError } from '../types'

export class CassandraAdapter implements DBAdapter {
  private client: CassandraClient | null = null
  private config: ConnectionConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    try {
      // localDataCenter is required in newer driver versions — without it,
      // the connection silently hangs or fails with an unhelpful error.
      if (!config.localDataCenter) {
        throw new DBError(
          'localDataCenter is required for Cassandra connections (e.g. "datacenter1", "us-east")',
          'unknown',
        )
      }
      this.client = new CassandraClient({
        contactPoints: [`${config.host}:${config.port}`],
        localDataCenter: config.localDataCenter,
        credentials: {
          username: config.username,
          password: config.password,
        },
        keyspace: config.database || undefined,
        socketOptions: {
          connectTimeout: 10000,
          readTimeout: 30000,
        },
      })
      await this.client.connect()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.execute('SELECT now() FROM system.local')
      return true
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      // "Databases" = keyspaces in Cassandra
      const res = await this.client.execute(
        'SELECT keyspace_name FROM system_schema.keyspaces',
      )
      return res.rows.map((r) => r.get('keyspace_name') as string).sort()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async listTablesOrCollections(keyspace: string, _schema?: string): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const res = await this.client.execute(
        'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?',
        [keyspace],
      )
      return res.rows.map((r) => r.get('table_name') as string).sort()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async getStructure(table: string, _schema?: string): Promise<ColumnDef[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const keyspace = this.config?.database || undefined
      const params = keyspace ? [keyspace, table] : [table]
      const query = keyspace
        ? 'SELECT column_name, type, kind FROM system_schema.columns WHERE keyspace_name = ? AND table_name = ?'
        : 'SELECT column_name, type, kind FROM system_schema.columns WHERE table_name = ?'
      const res = await this.client.execute(query, params)
      return res.rows.map((r) => ({
        name: r.get('column_name') as string,
        type: r.get('type') as string,
        nullable: (r.get('kind') as string) !== 'partition_key' && (r.get('kind') as string) !== 'clustering',
        isPrimaryKey:
          (r.get('kind') as string) === 'partition_key' ||
          (r.get('kind') as string) === 'clustering',
      }))
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    const cql = String(raw)
    const start = Date.now()
    try {
      const res = await this.client.execute(cql)
      const durationMs = Date.now() - start
      const columns = res.columns?.map((c) => c.name) || []
      const rows = res.rows.map((r) => {
        const obj: Record<string, unknown> = {}
        for (const col of columns) {
          obj[col] = r.get(col)
        }
        return obj
      })
      return { columns, rows, durationMs, statement: cql }
    } catch (err: any) {
      return {
        columns: [],
        rows: [],
        durationMs: Date.now() - start,
        error: err.message,
        statement: cql,
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.shutdown()
      this.client = null
    }
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    if (msg.includes('Authentication') || msg.includes('Bad credentials')) {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (msg.includes('Keyspace') && msg.includes('does not exist')) {
      throw new DBError(`Keyspace not found: ${msg}`, 'not-found', err)
    }
    if (msg.includes('Unauthorized') || msg.includes('permission')) {
      throw new DBError(`Permission denied: ${msg}`, 'permission', err)
    }
    if (msg.includes('timeout') || msg.includes('Timed out')) {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('connection') || msg.includes('No host')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
