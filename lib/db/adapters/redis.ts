import Redis from 'ioredis'
import type { DBAdapter, ConnectionConfig, ColumnDef, FieldSample, QueryResult } from '../types'
import { DBError } from '../types'

export class RedisAdapter implements DBAdapter {
  private client: Redis | null = null
  private config: ConnectionConfig | null = null
  private isCluster: boolean = false

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    try {
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password || undefined,
        connectTimeout: 10000,
        commandTimeout: 10000,
        maxRetriesPerRequest: 1,
        // Don't buffer commands — fail fast
        enableOfflineQueue: false,
      })
      // Verify connectivity
      await this.client.ping()
      // Detect cluster mode (CLUSTER INFO)
      try {
        const info = await this.client.cluster('INFO')
        if (info && info.includes('cluster_enabled:1')) {
          this.isCluster = true
        }
      } catch {
        // Not in cluster mode — standalone
        this.isCluster = false
      }
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false
    try {
      const res = await this.client.ping()
      return res === 'PONG'
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    if (this.isCluster) {
      // Redis Cluster doesn't support SELECT/numbered-DB model
      // Return ['cluster'] to indicate cluster mode
      return ['cluster']
    }
    try {
      // Query CONFIG GET databases for the configured count
      const res = await this.client.config('GET', 'databases')
      // res is [key, value] → ['databases', '16']
      const count = parseInt(res[1] as string, 10) || 16
      return Array.from({ length: count }, (_, i) => String(i))
    } catch (err: any) {
      // Fallback: assume default 16 logical databases
      return Array.from({ length: 16 }, (_, i) => String(i))
    }
  }

  async listTablesOrCollections(database: string, _schema?: string): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    if (this.isCluster) {
      // In cluster mode, list keys by scanning
      return await this.scanKeys('*', 100)
    }
    try {
      // Select the logical database, then scan keys
      const dbNum = parseInt(database, 10)
      if (!isNaN(dbNum)) {
        await this.client.select(dbNum)
      }
      return await this.scanKeys('*', 100)
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async getStructure(key: string, _schema?: string): Promise<FieldSample> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const type = await this.client.type(key)
      let sample: unknown
      switch (type) {
        case 'string':
          sample = await this.client.get(key)
          break
        case 'list':
          sample = await this.client.lrange(key, 0, 4)
          break
        case 'set':
          sample = await this.client.smembers(key)
          break
        case 'zset':
          sample = await this.client.zrange(key, '0', '4', 'WITHSCORES' as any)
          break
        case 'hash':
          sample = await this.client.hgetall(key)
          break
        case 'stream':
          sample = await this.client.xrange(key, '-', '+', String(5) as any)
          break
        default:
          sample = null
      }
      return {
        fields: [
          { name: 'key', type: 'string', sample: key },
          { name: 'type', type: 'string', sample: type },
          { name: 'value', type: type, sample },
        ],
      }
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    const start = Date.now()
    try {
      const q = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return null } })() : raw

      // Structured query from rows API: { collection, operation, filter?, document? }
      if (q && typeof q === 'object' && !Array.isArray(q) && q.collection !== undefined) {
        const key = String(q.collection)

        // Find — scan keys matching pattern
        if (!q.operation || q.operation === 'find') {
          const pattern = q.filter?.key ? String(q.filter.key) : '*'
          const limit = q.limit || 100
          const keys = await this.scanKeys(pattern, limit)
          const rows: Record<string, unknown>[] = []
          for (const k of keys.slice(q.skip || 0, (q.skip || 0) + (q.limit || 50))) {
            const type = await this.client.type(k)
            let value: unknown = null
            switch (type) {
              case 'string': value = await this.client.get(k); break
              case 'list': value = await this.client.lrange(k, 0, 9); break
              case 'hash': value = await this.client.hgetall(k); break
              case 'set': value = await this.client.smembers(k); break
              case 'zset': value = await this.client.zrange(k, 0, 9); break
            }
            rows.push({ key: k, type, value })
          }
          const durationMs = Date.now() - start
          return { columns: ['key', 'type', 'value'], rows, durationMs, statement: JSON.stringify(q) }
        }

        // Insert — SET a key
        if (q.operation === 'insert') {
          const val = typeof q.document === 'object' ? JSON.stringify(q.document) : String(q.document ?? '')
          await this.client.set(key, val)
          const durationMs = Date.now() - start
          return { columns: ['result'], rows: [{ result: 'OK' }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
        }

        // Update — SET existing key
        if (q.operation === 'update') {
          const val = typeof q.document === 'object' ? JSON.stringify(q.document) : String(q.document ?? '')
          await this.client.set(key, val)
          const durationMs = Date.now() - start
          return { columns: ['result'], rows: [{ result: 'OK' }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
        }

        // Delete — DEL key
        if (q.operation === 'delete') {
          const keysToDelete = Object.values(q.filter || {}).map(v => String(v))
          if (keysToDelete.length === 0) keysToDelete.push(key)
          const count = await this.client.del(...keysToDelete)
          const durationMs = Date.now() - start
          return { columns: ['deletedCount'], rows: [{ deletedCount: count }], affectedRows: count, durationMs, statement: JSON.stringify(q) }
        }
      }

      // Raw Redis command: "GET mykey" or ["GET", "mykey"]
      const parts = typeof raw === 'string' ? raw.trim().split(/\s+/) : raw as string[]
      const cmd = parts[0].toUpperCase()
      const args = parts.slice(1)
      const result = await (this.client as any).call(cmd, ...args)
      const durationMs = Date.now() - start
      const rows = [{ result: typeof result === 'object' ? JSON.stringify(result) : result }]
      return {
        columns: ['result'],
        rows,
        durationMs,
        statement: parts.join(' '),
      }
    } catch (err: any) {
      return {
        columns: [],
        rows: [],
        durationMs: Date.now() - start,
        error: err.message,
        statement: String(raw),
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }
  }

  private async scanKeys(pattern: string, count: number): Promise<string[]> {
    if (!this.client) return []
    const keys: string[] = []
    let cursor = '0'
    do {
      const [next, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 50)
      cursor = next
      keys.push(...batch)
      if (keys.length >= count) break
    } while (cursor !== '0')
    return keys.slice(0, count).sort()
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    if (msg.includes('WRONGPASS') || msg.includes('NOAUTH')) {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (msg.includes('NOPERM')) {
      throw new DBError(`Permission denied: ${msg}`, 'permission', err)
    }
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
