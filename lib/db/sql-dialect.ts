import type { DriverId } from '@/lib/types'

/**
 * Small per-engine SQL dialect helpers for the generic row editor. The row
 * routes build SQL text, so identifiers, literals and paging must match what
 * the target engine accepts: MySQL quotes with backticks and treats backslash
 * as an escape, and MSSQL pages with OFFSET/FETCH and needs an ORDER BY.
 */

/** Quote a table, schema or column name for the engine. */
export function quoteIdent(driver: DriverId | string, name: string): string {
  switch (driver) {
    case 'mysql':
      return `\`${name.replace(/`/g, '``')}\``
    case 'mssql':
      return `[${name.replace(/]/g, ']]')}]`
    default:
      return `"${name.replace(/"/g, '""')}"`
  }
}

/** Render a string value as a SQL literal, escaping what the engine treats specially. */
export function quoteString(driver: DriverId | string, value: string): string {
  if (driver === 'mysql') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
  }
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * Paging clause for a SELECT. `hasOrderBy` tells MSSQL whether it already has
 * an ORDER BY, which its OFFSET/FETCH form requires.
 */
export function pagingClause(
  driver: DriverId | string,
  limit: number,
  offset: number,
  hasOrderBy: boolean,
): string {
  if (driver === 'mssql') {
    const order = hasOrderBy ? '' : ' ORDER BY (SELECT NULL)'
    return `${order} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
  }
  return ` LIMIT ${limit} OFFSET ${offset}`
}
