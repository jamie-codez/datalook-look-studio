import Database from 'better-sqlite3'
import { existsSync, statSync, readdirSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import type { DBAdapter, ConnectionConfig, ColumnDef, QueryResult } from '../types'
import { DBError } from '../types'

export class SqliteAdapter implements DBAdapter {
  private db: Database.Database | null = null
  private config: ConnectionConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    const filePath = config.filePath || config.host || config.database
    if (!filePath) {
      throw new DBError('SQLite requires a file path', 'not-found')
    }
    // Validate the file exists — better-sqlite3 silently creates a new empty DB
    if (!existsSync(filePath)) {
      throw new DBError(`SQLite file not found: ${filePath}`, 'not-found')
    }
    const stat = statSync(filePath)
    if (!stat.isFile() || stat.size === 0) {
      throw new DBError(`SQLite file is empty or not a regular file: ${filePath}`, 'not-found')
    }
    try {
      this.db = new Database(filePath, { readonly: true, fileMustExist: true })
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.db) return false
    try {
      this.db.prepare('SELECT 1').get()
      return true
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.db) throw new DBError('Not connected', 'unknown')
    // SQLite: one file = one database. Return the logical name (filename without extension).
    const filePath = this.config?.filePath || this.config?.host || this.config?.database || 'database'
    const name = basename(filePath, extname(filePath))
    return [name]
  }

  async listSchemas(_database: string): Promise<string[]> {
    // SQLite doesn't have schemas — return ['main'] as the single schema
    return ['main']
  }

  async listTablesOrCollections(_database: string, _schema?: string): Promise<string[]> {
    if (!this.db) throw new DBError('Not connected', 'unknown')
    try {
      const rows = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string }[]
      return rows.map((r) => r.name)
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async getStructure(table: string, _schema?: string): Promise<ColumnDef[]> {
    if (!this.db) throw new DBError('Not connected', 'unknown')
    try {
      const info = this.db.prepare(`PRAGMA table_info(${this.escapeIdent(table)})`).all() as {
        name: string
        type: string
        notnull: number
        pk: number
        dflt_value: string | null
      }[]
      return info.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.notnull === 0,
        isPrimaryKey: c.pk > 0,
        defaultValue: c.dflt_value ?? undefined,
      }))
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    if (!this.db) throw new DBError('Not connected', 'unknown')
    const sql = String(raw)
    const start = Date.now()
    try {
      const stmt = this.db.prepare(sql)
      // Determine if this is a SELECT or a write operation
      const trimmed = sql.trim().toUpperCase()
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH')) {
        const rows = stmt.all() as Record<string, unknown>[]
        const durationMs = Date.now() - start
        const columns = rows.length > 0 ? Object.keys(rows[0]) : []
        return { columns, rows, durationMs, statement: sql }
      }
      const info = stmt.run()
      const durationMs = Date.now() - start
      return {
        columns: [],
        rows: [],
        affectedRows: info.changes,
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
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  private escapeIdent(name: string): string {
    // Basic identifier escaping for SQLite
    return name.replace(/'/g, "''")
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    if (msg.includes('SQLITE_CANTOPEN') || msg.includes('file')) {
      throw new DBError(`Cannot open file: ${msg}`, 'not-found', err)
    }
    if (msg.includes('SQLITE_READONLY') || msg.includes('readonly')) {
      throw new DBError(`Permission denied: ${msg}`, 'permission', err)
    }
    if (msg.includes('SQLITE_AUTH') || msg.includes('authorization')) {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
