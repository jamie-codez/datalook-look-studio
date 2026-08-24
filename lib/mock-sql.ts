import { classifyStatement } from './rbac'
import { generateRows } from './mock-data'
import type { Connection, QueryResult, TableMeta } from './types'

// Extract the first table name referenced after FROM / INTO / UPDATE.
function extractTableName(sql: string): string | null {
  const cleaned = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const match = cleaned.match(/\b(?:from|into|update|table)\s+["`]?([a-z_][a-z0-9_.]*)["`]?/i)
  if (!match) return null
  const parts = match[1].split('.')
  return parts[parts.length - 1]
}

function resolveTable(conn: Connection, sql: string): TableMeta | null {
  const name = extractTableName(sql)
  if (!name) return null
  for (const schema of conn.schemas) {
    const t = schema.tables.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (t) return t
  }
  return null
}

// Parse a numeric LIMIT clause if present.
function extractLimit(sql: string): number | null {
  const m = sql.match(/\blimit\s+(\d+)/i)
  return m ? Number.parseInt(m[1], 10) : null
}

export interface ExecuteOutcome {
  result: QueryResult
  rowCount: number
}

/**
 * Simulate execution of a single SQL statement against a mock connection.
 * This is intentionally forgiving — it recognizes shapes, not full grammar,
 * so it can later be swapped for a real driver behind the same interface.
 */
export function executeStatement(conn: Connection, sql: string): ExecuteOutcome {
  const statement = sql.trim().replace(/;$/, '')
  const type = classifyStatement(statement)
  // Simulated latency, deterministic-ish but with jitter for realism.
  const durationMs = Math.round((Math.random() * 40 + 6) * 10) / 10

  if (type === 'SELECT') {
    const table = resolveTable(conn, statement)
    if (!table) {
      // Generic scalar result for expression selects like `SELECT 1 + 1`.
      return {
        result: {
          columns: ['result'],
          rows: [{ result: 2 }],
          durationMs,
          statement,
        },
        rowCount: 1,
      }
    }
    const limit = extractLimit(statement) ?? 200
    const rows = generateRows(table, Math.min(limit, 500))
    return {
      result: {
        columns: table.columns.map((c) => c.name),
        rows,
        durationMs,
        statement,
      },
      rowCount: rows.length,
    }
  }

  if (type === 'INSERT' || type === 'UPDATE' || type === 'DELETE') {
    const affected = 1 + Math.floor(Math.random() * 25)
    return {
      result: {
        columns: [],
        rows: [],
        affectedRows: affected,
        durationMs,
        statement,
      },
      rowCount: affected,
    }
  }

  if (type === 'CREATE' || type === 'DROP' || type === 'ALTER' || type === 'TRUNCATE') {
    return {
      result: {
        columns: [],
        rows: [],
        affectedRows: 0,
        durationMs,
        statement,
      },
      rowCount: 0,
    }
  }

  return {
    result: {
      columns: [],
      rows: [],
      durationMs,
      statement,
      error:
        'Statement executed, but its shape was not recognized by the mock engine.',
    },
    rowCount: 0,
  }
}
