import { MongoClient, type Db } from 'mongodb'
import type { DBAdapter, ConnectionConfig, ColumnDef, FieldSample, QueryResult } from '../types'
import { DBError } from '../types'

export class MongoAdapter implements DBAdapter {
  private client: MongoClient | null = null
  private config: ConnectionConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    try {
      const uri = this.buildUri(config)
      this.client = new MongoClient(uri, {
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
      })
      await this.client.connect()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.db().command({ ping: 1 })
      return true
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      // Requires a role with listDatabases privilege (e.g. readAnyDatabase, clusterMonitor)
      const admin = this.client.db().admin()
      const result = await admin.listDatabases()
      return result.databases.map((d) => d.name).sort()
    } catch (err: any) {
      if (err.code === 13 || err.message?.includes('not authorized')) {
        throw new DBError(
          `Permission denied: connecting user lacks listDatabases privilege. Use a role like readAnyDatabase or clusterMonitor.`,
          'permission',
          err,
        )
      }
      this.classifyError(err)
    }
  }

  async listTablesOrCollections(database: string, _schema?: string): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const db: Db = this.client.db(database)
      const collections = await db.listCollections({}, { nameOnly: true }).toArray()
      return collections.map((c) => c.name).sort()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async getStructure(collection: string, _schema?: string): Promise<FieldSample> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const db = this.client.db(this.config?.database || undefined)
      const coll = db.collection(collection)
      // Sample a few documents to infer field structure
      const sampleDocs = await coll.find({}, { limit: 20 }).toArray()
      const fieldMap = new Map<string, { type: string; sample?: unknown }>()
      for (const doc of sampleDocs) {
        this.extractFields(doc, '', fieldMap)
      }
      const count = await coll.estimatedDocumentCount()
      return {
        fields: Array.from(fieldMap.entries()).map(([name, info]) => ({ name, ...info })),
        count,
      }
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    const start = Date.now()
    try {
      const db = this.client.db(this.config?.database || undefined)
      const q = typeof raw === 'string' ? JSON.parse(raw) : raw

      if (Array.isArray(q)) {
        const collName = (q[0]?.$collName as string) || ''
        if (collName) {
          const coll = db.collection(collName)
          const rows = await coll.aggregate(q).toArray()
          const durationMs = Date.now() - start
          const columns = rows.length > 0 ? Object.keys(rows[0]) : []
          return { columns, rows, durationMs, statement: JSON.stringify(q) }
        }
        throw new Error('MongoDB pipeline array must include $collName in first stage')
      }

      if (typeof q === 'object' && q.collection) {
        const coll = db.collection(q.collection as string)

        if (!q.operation || q.operation === 'find') {
          const filter = q.filter || {}
          let cursor = coll.find(filter)
          if (q.skip) cursor = cursor.skip(q.skip)
          if (q.limit) cursor = cursor.limit(q.limit)
          if (q.sortBy) cursor = cursor.sort({ [q.sortBy]: q.sortDir === 'desc' ? -1 : 1 })
          const rows = await cursor.toArray()
          const durationMs = Date.now() - start
          const columns = rows.length > 0 ? Object.keys(rows[0]) : []
          return { columns, rows, durationMs, statement: JSON.stringify(q) }
        }

        if (q.operation === 'insert') {
          const result = await coll.insertOne(q.document)
          const durationMs = Date.now() - start
          return { columns: ['insertedId'], rows: [{ insertedId: result.insertedId }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
        }

        if (q.operation === 'update') {
          const result = await coll.updateMany(q.filter || {}, { $set: q.document })
          const durationMs = Date.now() - start
          return { columns: ['matchedCount', 'modifiedCount'], rows: [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }], affectedRows: result.modifiedCount, durationMs, statement: JSON.stringify(q) }
        }

        if (q.operation === 'delete') {
          const result = await coll.deleteMany(q.filter || {})
          const durationMs = Date.now() - start
          return { columns: ['deletedCount'], rows: [{ deletedCount: result.deletedCount }], affectedRows: result.deletedCount, durationMs, statement: JSON.stringify(q) }
        }

        if (q.pipeline) {
          const cursor = coll.aggregate(q.pipeline)
          if (q.limit) cursor.limit(q.limit)
          const rows = await cursor.toArray()
          const durationMs = Date.now() - start
          const columns = rows.length > 0 ? Object.keys(rows[0]) : []
          return { columns, rows, durationMs, statement: JSON.stringify(q) }
        }
      }

      throw new Error('MongoDB query expects { collection, operation? } or pipeline array')
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
      await this.client.close()
      this.client = null
    }
  }

  private buildUri(config: ConnectionConfig): string {
    if (config.connectionString) return config.connectionString
    const auth = config.username
      ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
      : ''
    const host = config.host || 'localhost'
    const port = config.port || 27017
    const db = config.database ? `/${config.database}` : ''
    return `mongodb://${auth}${host}:${port}${db}?authSource=admin`
  }

  private extractFields(
    obj: Record<string, unknown>,
    prefix: string,
    fieldMap: Map<string, { type: string; sample?: unknown }>,
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (value === null) {
        if (!fieldMap.has(path)) fieldMap.set(path, { type: 'null' })
      } else if (Array.isArray(value)) {
        if (!fieldMap.has(path)) fieldMap.set(path, { type: 'array', sample: value[0] })
        if (value.length > 0 && typeof value[0] === 'object') {
          this.extractFields(value[0] as Record<string, unknown>, path, fieldMap)
        }
      } else if (typeof value === 'object') {
        if (!fieldMap.has(path)) fieldMap.set(path, { type: 'object' })
        this.extractFields(value as Record<string, unknown>, path, fieldMap)
      } else {
        if (!fieldMap.has(path)) {
          fieldMap.set(path, { type: typeof value, sample: value })
        }
      }
    }
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    if (err.code === 18 || msg.includes('Authentication failed') || msg.includes('auth')) {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (err.code === 13 || msg.includes('not authorized') || msg.includes('permission')) {
      throw new DBError(`Permission denied: ${msg}`, 'permission', err)
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
