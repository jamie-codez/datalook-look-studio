/**
 * Client-side API helpers for the database browser.
 * These call the Route Handlers which handle server-side DB connections.
 */

export interface DatabaseListResponse {
  databases: string[]
}

export interface SchemaListResponse {
  schemas: string[]
}

export interface TableListResponse {
  tables: string[]
}

export interface StructureResponse {
  structure: ColumnDef[] | FieldSample
}

export interface ColumnDef {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey?: boolean
  defaultValue?: string
}

export interface FieldSample {
  fields: { name: string; type: string; sample?: unknown }[]
  count?: number
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  affectedRows?: number
  durationMs: number
  error?: string
  statement: string
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as any).error || `Request failed: ${res.status}`)
  }
  return data as T
}

export async function fetchDatabases(connectionId: string): Promise<string[]> {
  const res = await apiFetch<DatabaseListResponse>(
    `/api/connections/${encodeURIComponent(connectionId)}/databases`,
  )
  return res.databases
}

export async function fetchSchemas(connectionId: string, database: string): Promise<string[]> {
  const res = await apiFetch<SchemaListResponse>(
    `/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/schemas`,
  )
  return res.schemas
}

export async function fetchTables(
  connectionId: string,
  database: string,
  schema?: string,
): Promise<string[]> {
  const url = new URL(
    `/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/tables`,
    window.location.origin,
  )
  if (schema) url.searchParams.set('schema', schema)
  const res = await apiFetch<TableListResponse>(url.toString())
  return res.tables
}

export async function fetchStructure(
  connectionId: string,
  database: string,
  table: string,
): Promise<ColumnDef[] | FieldSample> {
  const res = await apiFetch<StructureResponse>(
    `/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/${encodeURIComponent(table)}/structure`,
  )
  return res.structure
}

export async function executeQuery(
  connectionId: string,
  database: string,
  table: string,
  query: unknown,
): Promise<QueryResult> {
  const res = await apiFetch<QueryResult>(
    `/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/${encodeURIComponent(table)}/query`,
    {
      method: 'POST',
      body: JSON.stringify({ query }),
    },
  )
  return res
}

export async function createConnection(config: {
  id: string
  driver: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  filePath?: string
  region?: string
  localDataCenter?: string
  tls?: boolean
  connectionString?: string
  readOnly?: boolean
  scope?: string
  ownerId?: string
}): Promise<{ id: string; status: string }> {
  return apiFetch('/api/connections', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

// ---- Row-level CRUD ----

export interface RowsResponse {
  columns: string[]
  rows: Record<string, unknown>[]
  total?: number
  page: number
  pageSize: number
  durationMs: number
}

export async function fetchRows(
  connectionId: string,
  database: string,
  table: string,
  opts?: {
    page?: number
    pageSize?: number
    schema?: string
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    filter?: string
  },
): Promise<RowsResponse> {
  const url = new URL(
    `/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/${encodeURIComponent(table)}/rows`,
    window.location.origin,
  )
  if (opts?.page) url.searchParams.set('page', String(opts.page))
  if (opts?.pageSize) url.searchParams.set('pageSize', String(opts.pageSize))
  if (opts?.schema) url.searchParams.set('schema', opts.schema)
  if (opts?.sortBy) url.searchParams.set('sortBy', opts.sortBy)
  if (opts?.sortDir) url.searchParams.set('sortDir', opts.sortDir)
  if (opts?.filter) url.searchParams.set('filter', opts.filter)
  return apiFetch<RowsResponse>(url.toString())
}

export async function insertRow(
  connectionId: string,
  database: string,
  table: string,
  data: Record<string, unknown>,
  schema?: string,
): Promise<{ success: boolean; result: QueryResult }> {
  return apiFetch(
    `/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/${encodeURIComponent(table)}/rows`,
    { method: 'POST', body: JSON.stringify({ data, schema }) },
  )
}

export async function updateRow(
  connectionId: string,
  database: string,
  table: string,
  filter: Record<string, unknown>,
  data: Record<string, unknown>,
  schema?: string,
): Promise<{ success: boolean; result: QueryResult }> {
  return apiFetch(
    `/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/${encodeURIComponent(table)}/rows`,
    { method: 'PUT', body: JSON.stringify({ filter, data, schema }) },
  )
}

export async function deleteRow(
  connectionId: string,
  database: string,
  table: string,
  filter: Record<string, unknown>,
  schema?: string,
): Promise<{ success: boolean; result: QueryResult }> {
  return apiFetch(
    `/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(database)}/${encodeURIComponent(table)}/rows`,
    { method: 'DELETE', body: JSON.stringify({ filter, schema }) },
  )
}

// ---- Generic query execution ----

export async function runQuery(
  connectionId: string,
  sql: string,
): Promise<QueryResult> {
  return apiFetch<QueryResult>(
    `/api/connections/${encodeURIComponent(connectionId)}/query`,
    { method: 'POST', body: JSON.stringify({ query: sql }) },
  )
}
