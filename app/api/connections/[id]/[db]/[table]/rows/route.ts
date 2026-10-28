import { NextRequest, NextResponse } from 'next/server'
import { forDatabase, getConnectedAdapter } from '@/lib/db/adapter-factory'
import { loadServerConnection } from '@/lib/db/server-store'
import { pagingClause, quoteIdent, quoteString } from '@/lib/db/sql-dialect'
import { DBError } from '@/lib/db/types'
import { SYSTEM_CONNECTION_ID } from '@/lib/system-store'
import { guardConnection } from '@/lib/db/access'

/**
 * Never let the generic row browser return password hashes, even to an
 * authenticated viewer of the system store — browsing the real "datalook"
 * schema is otherwise a plain SELECT * away from every user's hash.
 */
const REDACTED_COLUMNS: Record<string, string[]> = {
  users: ['password_hash'],
}

/**
 * The system connection (conn-system) only exists server-side once a real
 * Postgres backend is configured (see lib/db/server-store.ts) — everything
 * else in this app's connections API trusts the browser's own RBAC, but the
 * system store holds real user records, so reads require a live session and
 * writes require the Admin role, mirroring effectiveConnectionRole() in
 * lib/rbac.ts for isSystem connections.
 */
/** GET — fetch paginated rows from a table/collection */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; db: string; table: string }> },
) {
  try {
    const { id, db, table } = await params
    const denied = await guardConnection(request, id, 'viewer')
    if (denied) return denied
    const config = await loadServerConnection(id)
    if (!config) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const sp = request.nextUrl.searchParams
    const page = parseInt(sp.get('page') || '1', 10)
    const pageSize = parseInt(sp.get('pageSize') || '50', 10)
    const offset = (page - 1) * pageSize
    const schema = sp.get('schema') || undefined
    const sortBy = sp.get('sortBy') || undefined
    const sortDir = sp.get('sortDir') || 'asc'
    const filter = sp.get('filter') || undefined

    const target = forDatabase(config, decodeURIComponent(db))

    const adapter = await getConnectedAdapter(target)
    const decodedTable = decodeURIComponent(table)

    // Build a query based on driver category
    const driver = config.driver
    let query: unknown

    if (['mongodb', 'couchdb', 'dynamodb', 'redis'].includes(driver)) {
      query = {
        collection: decodedTable,
        database: target.database,
        limit: pageSize,
        skip: offset,
        sortBy,
        sortDir,
        filter: filter ? JSON.parse(filter) : undefined,
      }
    } else {
      // SQL — build SELECT with pagination
      const escapedTable = quoteIdent(driver, decodedTable)
      const schemaPrefix = schema ? `${quoteIdent(driver, schema)}.` : ''
      let sql = `SELECT * FROM ${schemaPrefix}${escapedTable}`
      
      if (filter) {
        try {
          const filterObj = JSON.parse(filter)
          const conditions = Object.entries(filterObj)
            .map(([col, val]) => {
              if (val === null) return `${quoteIdent(driver, col)} IS NULL`
              const numVal = Number(val)
              if (!isNaN(numVal) && String(val) === String(numVal)) {
                return `${quoteIdent(driver, col)} = ${numVal}`
              }
              return `${quoteIdent(driver, col)} = ${quoteString(driver, String(val))}`
            })
            .join(' AND ')
          if (conditions) sql += ` WHERE ${conditions}`
        } catch {
          // Never splice the raw text into SQL: this is a GET, so a viewer could
          // otherwise smuggle statements through the filter parameter.
          return NextResponse.json(
            { error: 'filter must be a JSON object of column: value pairs' },
            { status: 400 },
          )
        }
      }
      
      if (sortBy) {
        sql += ` ORDER BY ${quoteIdent(driver, sortBy)} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`
      }

      sql += pagingClause(driver, pageSize, offset, !!sortBy)
      query = sql
    }

    const result = await adapter.query(query)

    if (id === SYSTEM_CONNECTION_ID) {
      const redacted = REDACTED_COLUMNS[decodedTable.toLowerCase()]
      if (redacted && redacted.length > 0) {
        result.columns = result.columns.filter((c) => !redacted.includes(c))
        result.rows = result.rows.map((row) => {
          const copy = { ...row }
          for (const col of redacted) delete copy[col]
          return copy
        })
      }
    }

    // Also get total count for pagination
    let total: number | undefined
    if (!['mongodb', 'couchdb', 'dynamodb', 'redis'].includes(driver)) {
      try {
        const schemaPrefix = schema ? `${quoteIdent(driver, schema)}.` : ''
        const countQuery = `SELECT COUNT(*) as total FROM ${schemaPrefix}${quoteIdent(driver, decodedTable)}`
        const countResult = await adapter.query(countQuery)
        if (countResult.rows.length > 0) {
          total = Number(countResult.rows[0].total)
        }
      } catch {
        // Count query failed
      }
    }

    return NextResponse.json({
      columns: result.columns,
      rows: result.rows,
      total,
      page,
      pageSize,
      durationMs: result.durationMs,
    })
  } catch (err) {
    if (err instanceof DBError) {
      const status =
        err.kind === 'auth' ? 401 :
        err.kind === 'permission' ? 403 :
        err.kind === 'not-found' ? 404 :
        err.kind === 'timeout' || err.kind === 'network' ? 502 :
        500
      return NextResponse.json({ error: err.message, kind: err.kind }, { status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

/** POST — insert a new row/document */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; db: string; table: string }> },
) {
  try {
    const { id, db, table } = await params
    const denied = await guardConnection(request, id, 'editor')
    if (denied) return denied
    const config = await loadServerConnection(id)
    if (!config) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const body = await request.json()
    const decodedTable = decodeURIComponent(table)
    const target = forDatabase(config, decodeURIComponent(db))
    const adapter = await getConnectedAdapter(target)
    const driver = config.driver

    let query: unknown
    if (['mongodb', 'couchdb', 'dynamodb', 'redis'].includes(driver)) {
      query = { collection: decodedTable, operation: 'insert', document: body.data }
    } else {
      const columns = Object.keys(body.data)
      const values = Object.values(body.data)
      const schema = body.schema
      const schemaPrefix = schema ? `${quoteIdent(driver, schema)}.` : ''
      const colList = columns.map(c => quoteIdent(driver, c)).join(', ')
      const valList = values.map(v => {
        if (v === null || v === undefined) return 'NULL'
        const numVal = Number(v)
        if (!isNaN(numVal) && String(v) === String(numVal)) return String(numVal)
        return `'${String(v).replace(/'/g, "''")}'`
      }).join(', ')
      query = `INSERT INTO ${schemaPrefix}${quoteIdent(driver, decodedTable)} (${colList}) VALUES (${valList})`
    }

    const result = await adapter.query(query)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    if (err instanceof DBError) {
      const status = err.kind === 'auth' ? 401 : err.kind === 'permission' ? 403 : 500
      return NextResponse.json({ error: err.message, kind: err.kind }, { status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

/** PUT — update an existing row/document */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; db: string; table: string }> },
) {
  try {
    const { id, db, table } = await params
    const denied = await guardConnection(request, id, 'editor')
    if (denied) return denied
    const config = await loadServerConnection(id)
    if (!config) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const body = await request.json()
    const decodedTable = decodeURIComponent(table)
    const target = forDatabase(config, decodeURIComponent(db))
    const adapter = await getConnectedAdapter(target)
    const driver = config.driver

    let query: unknown
    if (['mongodb', 'couchdb', 'dynamodb', 'redis'].includes(driver)) {
      query = { collection: decodedTable, operation: 'update', filter: body.filter, document: body.data }
    } else {
      const schema = body.schema
      const schemaPrefix = schema ? `${quoteIdent(driver, schema)}.` : ''
      const setClauses = Object.entries(body.data as Record<string, unknown>)
        .map(([col, val]) => {
          if (val === null || val === undefined) return `${quoteIdent(driver, col)} = NULL`
          const numVal = Number(val)
          if (!isNaN(numVal) && String(val) === String(numVal)) return `${quoteIdent(driver, col)} = ${numVal}`
          return `${quoteIdent(driver, col)} = ${quoteString(driver, String(val))}`
        })
        .join(', ')
      
      const whereClauses = Object.entries(body.filter as Record<string, unknown>)
        .map(([col, val]) => {
          if (val === null) return `${quoteIdent(driver, col)} IS NULL`
          const numVal = Number(val)
          if (!isNaN(numVal) && String(val) === String(numVal)) return `${quoteIdent(driver, col)} = ${numVal}`
          return `${quoteIdent(driver, col)} = ${quoteString(driver, String(val))}`
        })
        .join(' AND ')
      
      query = `UPDATE ${schemaPrefix}${quoteIdent(driver, decodedTable)} SET ${setClauses} WHERE ${whereClauses}`
    }

    const result = await adapter.query(query)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    if (err instanceof DBError) {
      const status = err.kind === 'auth' ? 401 : err.kind === 'permission' ? 403 : 500
      return NextResponse.json({ error: err.message, kind: err.kind }, { status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

/** DELETE — delete a row/document */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; db: string; table: string }> },
) {
  try {
    const { id, db, table } = await params
    const denied = await guardConnection(request, id, 'editor')
    if (denied) return denied
    const config = await loadServerConnection(id)
    if (!config) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const body = await request.json()
    const decodedTable = decodeURIComponent(table)
    const target = forDatabase(config, decodeURIComponent(db))
    const adapter = await getConnectedAdapter(target)
    const driver = config.driver

    let query: unknown
    if (['mongodb', 'couchdb', 'dynamodb', 'redis'].includes(driver)) {
      query = { collection: decodedTable, operation: 'delete', filter: body.filter }
    } else {
      const schema = body.schema
      const schemaPrefix = schema ? `${quoteIdent(driver, schema)}.` : ''
      const whereClauses = Object.entries(body.filter as Record<string, unknown>)
        .map(([col, val]) => {
          if (val === null) return `${quoteIdent(driver, col)} IS NULL`
          const numVal = Number(val)
          if (!isNaN(numVal) && String(val) === String(numVal)) return `${quoteIdent(driver, col)} = ${numVal}`
          return `${quoteIdent(driver, col)} = ${quoteString(driver, String(val))}`
        })
        .join(' AND ')
      
      query = `DELETE FROM ${schemaPrefix}${quoteIdent(driver, decodedTable)} WHERE ${whereClauses}`
    }

    const result = await adapter.query(query)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    if (err instanceof DBError) {
      const status = err.kind === 'auth' ? 401 : err.kind === 'permission' ? 403 : 500
      return NextResponse.json({ error: err.message, kind: err.kind }, { status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

