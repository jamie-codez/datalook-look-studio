import type { DBAdapter, ConnectionConfig, ColumnDef, FieldSample, QueryResult } from '../types'
import { DBError } from '../types'

interface CouchDBConfig extends ConnectionConfig {
  username: string
  password: string
  host: string
  port: number
}

export class CouchDBAdapter implements DBAdapter {
  private baseUrl: string | null = null
  private authHeader: string | null = null
  private config: CouchDBConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config as CouchDBConfig
    try {
      const protocol = config.tls ? 'https' : 'http'
      this.baseUrl = `${protocol}://${config.host}:${config.port}`
      // Use HTTP Basic auth
      const cred = `${config.username}:${config.password}`
      this.authHeader = `Basic ${Buffer.from(cred).toString('base64')}`
      // Verify connectivity with a session check
      const res = await this.fetchRaw('/_session')
      if (!res.ok) {
        const text = await res.text()
        throw new DBError(`Authentication failed: ${text}`, 'auth')
      }
    } catch (err: any) {
      if (err instanceof DBError) throw err
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.baseUrl) return false
    try {
      const res = await this.fetchRaw('/_up')
      return res.ok
    } catch {
      // Fallback: try _session
      try {
        const res = await this.fetchRaw('/_session')
        return res.ok
      } catch {
        return false
      }
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.baseUrl) throw new DBError('Not connected', 'unknown')
    try {
      const res = await this.fetchRaw('/_all_dbs')
      if (!res.ok) {
        const text = await res.text()
        if (res.status === 401 || res.status === 403) {
          throw new DBError(`Permission denied: ${text}. _all_dbs requires admin/server-level access.`, 'permission')
        }
        throw new DBError(`Failed to list databases: ${text}`, 'unknown')
      }
      const dbs = (await res.json()) as string[]
      return dbs.sort()
    } catch (err: any) {
      if (err instanceof DBError) throw err
      this.classifyError(err)
    }
  }

  async listTablesOrCollections(database: string, _schema?: string): Promise<string[]> {
    if (!this.baseUrl) throw new DBError('Not connected', 'unknown')
    try {
      const res = await this.fetchRaw(`/${encodeURIComponent(database)}/_all_docs?limit=0`)
      if (!res.ok) {
        const text = await res.text()
        if (res.status === 404) throw new DBError(`Database not found: ${database}`, 'not-found')
        throw new DBError(`Failed: ${text}`, 'unknown')
      }
      const body = (await res.json()) as { total_rows: number }
      // CouchDB doesn't have "collections" — all docs are in one database.
      // Return design documents as the "collections" equivalent.
      const designRes = await this.fetchRaw(
        `/${encodeURIComponent(database)}/_all_docs?startkey="_design/"&endkey="_design\ufff0"`,
      )
      if (designRes.ok) {
        const designBody = (await designRes.json()) as { rows: { id: string }[] }
        const designDocs = designBody.rows.map((r) => r.id.replace('_design/', ''))
        return designDocs.length > 0 ? designDocs.sort() : ['_all_docs']
      }
      return ['_all_docs']
    } catch (err: any) {
      if (err instanceof DBError) throw err
      this.classifyError(err)
    }
  }

  async getStructure(_container: string, _schema?: string): Promise<FieldSample> {
    // CouchDB: sample a few documents to infer field structure
    if (!this.baseUrl || !this.config) throw new DBError('Not connected', 'unknown')
    try {
      const dbName = this.config.database || ''
      const res = await this.fetchRaw(
        `/${encodeURIComponent(dbName)}/_all_docs?include_docs=true&limit=20`,
      )
      if (!res.ok) throw new DBError(`Failed to sample docs: ${await res.text()}`, 'unknown')
      const body = (await res.json()) as { rows: { doc: Record<string, unknown> | null }[] }
      const fieldMap = new Map<string, { type: string; sample?: unknown }>()
      for (const row of body.rows) {
        const doc = row.doc
        if (!doc) continue
        const id = doc._id as string | undefined
        if (id?.startsWith('_design/')) continue
        for (const [key, value] of Object.entries(doc)) {
          if (!fieldMap.has(key)) {
            fieldMap.set(key, { type: typeof value, sample: value })
          }
        }
      }
      return { fields: Array.from(fieldMap.entries()).map(([name, info]) => ({ name, ...info })) }
    } catch (err: any) {
      if (err instanceof DBError) throw err
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    if (!this.baseUrl) throw new DBError('Not connected', 'unknown')
    const start = Date.now()
    try {
      const q = typeof raw === 'string' ? JSON.parse(raw) : raw as any
      const dbName = q.database || this.config?.database || ''
      const collName = q.collection || q.tableName || dbName

      // Structured CRUD from rows API
      if (q.collection !== undefined || q.tableName !== undefined) {
        // Find — list docs
        if (!q.operation || q.operation === 'find') {
          const limit = q.limit || 25
          const skip = q.skip || 0
          const url = `/${encodeURIComponent(collName)}/_all_docs?include_docs=true&limit=${limit}&skip=${skip}`
          const res = await this.fetchRaw(url)
          if (!res.ok) throw new DBError(`Query failed: ${await res.text()}`, 'unknown')
          const body = (await res.json()) as { rows: { doc?: Record<string, unknown> }[] }
          const docs = body.rows.map((r) => r.doc).filter(Boolean) as Record<string, unknown>[]
          const durationMs = Date.now() - start
          const columns = docs.length > 0 ? Object.keys(docs[0]) : []
          return { columns, rows: docs, durationMs, statement: JSON.stringify(q) }
        }

        // Insert — POST doc
        if (q.operation === 'insert') {
          const res = await this.fetchRaw(`/${encodeURIComponent(collName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(q.document || {}),
          })
          if (!res.ok) throw new DBError(`Insert failed: ${await res.text()}`, 'unknown')
          const body = await res.json()
          const durationMs = Date.now() - start
          return { columns: ['id', 'rev'], rows: [{ id: body.id, rev: body.rev }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
        }

        // Update — PUT doc with _rev
        if (q.operation === 'update') {
          const docId = q.filter?._id || q.filter?.id
          if (!docId) throw new DBError('CouchDB update requires _id in filter', 'unknown')
          // Fetch current doc to get _rev
          const getRes = await this.fetchRaw(`/${encodeURIComponent(collName)}/${encodeURIComponent(String(docId))}`)
          if (!getRes.ok) throw new DBError(`Doc not found: ${docId}`, 'not-found')
          const existing = await getRes.json()
          const updatedDoc = { ...existing, ...q.document }
          const res = await this.fetchRaw(`/${encodeURIComponent(collName)}/${encodeURIComponent(String(docId))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedDoc),
          })
          if (!res.ok) throw new DBError(`Update failed: ${await res.text()}`, 'unknown')
          const body = await res.json()
          const durationMs = Date.now() - start
          return { columns: ['id', 'rev'], rows: [{ id: body.id, rev: body.rev }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
        }

        // Delete — DELETE doc
        if (q.operation === 'delete') {
          const docId = q.filter?._id || q.filter?.id
          if (!docId) throw new DBError('CouchDB delete requires _id in filter', 'unknown')
          // Fetch current doc to get _rev
          const getRes = await this.fetchRaw(`/${encodeURIComponent(collName)}/${encodeURIComponent(String(docId))}`)
          if (!getRes.ok) throw new DBError(`Doc not found: ${docId}`, 'not-found')
          const existing = await getRes.json()
          const rev = existing._rev
          const res = await this.fetchRaw(`/${encodeURIComponent(collName)}/${encodeURIComponent(String(docId))}?rev=${rev}`, {
            method: 'DELETE',
          })
          if (!res.ok) throw new DBError(`Delete failed: ${await res.text()}`, 'unknown')
          const durationMs = Date.now() - start
          return { columns: ['result'], rows: [{ result: 'OK' }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
        }
      }

      // Legacy query modes (view, selector, all_docs)
      let url: string
      if (q.view) {
        url = `/${encodeURIComponent(dbName)}/_design/${encodeURIComponent(q.designDoc || '_design')}/_view/${encodeURIComponent(q.view)}`
        if (q.params) url += '?' + new URLSearchParams(q.params).toString()
      } else if (q.selector) {
        url = `/${encodeURIComponent(dbName)}/_find`
        const res = await this.fetchRaw(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selector: q.selector, limit: q.limit || 25 }),
        })
        const body = (await res.json()) as { docs: Record<string, unknown>[] }
        const durationMs = Date.now() - start
        const columns = body.docs.length > 0 ? Object.keys(body.docs[0]) : []
        return { columns, rows: body.docs, durationMs, statement: JSON.stringify(q) }
      } else {
        url = `/${encodeURIComponent(dbName)}/_all_docs?include_docs=true&limit=${q.limit || 25}`
      }
      const res = await this.fetchRaw(url)
      const body = (await res.json()) as { rows: { doc?: Record<string, unknown> }[] }
      const docs = body.rows.map((r) => r.doc).filter(Boolean) as Record<string, unknown>[]
      const durationMs = Date.now() - start
      const columns = docs.length > 0 ? Object.keys(docs[0]) : []
      return { columns, rows: docs, durationMs, statement: JSON.stringify(q) }
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
    this.baseUrl = null
    this.authHeader = null
    this.config = null
  }

  private async fetchRaw(path: string, init?: RequestInit): Promise<Response> {
    if (!this.baseUrl || !this.authHeader) throw new DBError('Not connected', 'unknown')
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        ...(init?.headers || {}),
      },
    })
    return res
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
