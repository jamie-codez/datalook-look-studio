"use client"

import { useCallback, useEffect, useState } from "react"
import type { Tab, QueryResult } from "@/lib/types"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { useRBAC } from "@/components/providers/auth-provider"
import { ResultsGrid } from "@/components/workspace/results-grid"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import {
  TableIcon,
  LockIcon,
  RefreshCwIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchRows,
  fetchStructure,
  insertRow,
  updateRow,
  deleteRow,
  type ColumnDef,
  type RowsResponse,
} from "@/lib/db/api-client"
import { driverMeta } from "@/lib/drivers"
import { cn } from "@/lib/utils"

interface EditState {
  mode: 'insert' | 'update'
  rowIndex: number | null
  data: Record<string, unknown>
  filter?: Record<string, unknown>
}

export function DataGridTab({ tab }: { tab: Tab }) {
  const { connections } = useWorkspace()
  const { role } = useRBAC()
  const connection = connections.find((c) => c.id === tab.connectionId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RowsResponse | null>(null)
  const [structure, setStructure] = useState<ColumnDef[] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [sortBy, setSortBy] = useState<string | undefined>()
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editing, setEditing] = useState<EditState | null>(null)

  const tableName = tab.tableId || ''
  const database = connection?.database || ''
  const meta = connection ? driverMeta(connection.driver) : null
  const canEdit = role !== "Viewer" && !connection?.readOnly

  const loadData = useCallback(async () => {
    if (!connection || !tableName) return
    setLoading(true)
    setError(null)
    try {
      const [rowsData, structData] = await Promise.all([
        fetchRows(connection.id, database, tableName, {
          page,
          pageSize,
          sortBy,
          sortDir,
          schema: tab.schemaName,
        }),
        fetchStructure(connection.id, database, tableName).catch(() => null),
      ])
      setData(rowsData)
      if (structData && Array.isArray(structData)) {
        setStructure(structData as ColumnDef[])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [connection, tableName, database, page, pageSize, sortBy, sortDir, tab.schemaName])

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  function handleStartInsert() {
    const emptyData: Record<string, unknown> = {}
    if (structure) {
      for (const col of structure) {
        emptyData[col.name] = col.defaultValue ?? (col.nullable ? null : '')
      }
    }
    setEditing({ mode: 'insert', rowIndex: null, data: emptyData })
  }

  function handleStartEdit(rowIndex: number) {
    if (!data) return
    const row = data.rows[rowIndex]
    if (!row) return
    const pkCols = structure?.filter(c => c.isPrimaryKey).map(c => c.name) || []
    const filter: Record<string, unknown> = {}
    if (pkCols.length > 0) {
      for (const pk of pkCols) {
        filter[pk] = row[pk]
      }
    } else {
      for (const col of data.columns) {
        filter[col] = row[col]
      }
    }
    setEditing({ mode: 'update', rowIndex, data: { ...row }, filter })
  }

  async function handleSaveEdit() {
    if (!editing || !connection) return
    try {
      if (editing.mode === 'insert') {
        await insertRow(connection.id, database, tableName, editing.data, tab.schemaName)
        toast.success('Row inserted')
      } else if (editing.mode === 'update' && editing.filter) {
        await updateRow(connection.id, database, tableName, editing.filter, editing.data, tab.schemaName)
        toast.success('Row updated')
      }
      setEditing(null)
      loadData()
    } catch (err) {
      toast.error('Save failed', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  async function handleDeleteRow(rowIndex: number) {
    if (!data || !connection) return
    const row = data.rows[rowIndex]
    if (!row) return
    if (!confirm('Delete this row? This cannot be undone.')) return

    const pkCols = structure?.filter(c => c.isPrimaryKey).map(c => c.name) || []
    const filter: Record<string, unknown> = {}
    if (pkCols.length > 0) {
      for (const pk of pkCols) {
        filter[pk] = row[pk]
      }
    } else {
      for (const col of data.columns) {
        filter[col] = row[col]
      }
    }

    try {
      await deleteRow(connection.id, database, tableName, filter, tab.schemaName)
      toast.success('Row deleted')
      loadData()
    } catch (err) {
      toast.error('Delete failed', { description: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  if (!connection || !tableName) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TableIcon />
          </EmptyMedia>
          <EmptyTitle>Table not found</EmptyTitle>
          <EmptyDescription>This table is no longer available. Close this tab.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const totalPages = data?.total ? Math.ceil(data.total / pageSize) : 1
  const result: QueryResult | null = data
    ? { columns: data.columns, rows: data.rows, durationMs: data.durationMs, statement: `SELECT * FROM ${tableName}` }
    : null

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 text-sm">
        <TableIcon className="size-4 text-primary" aria-hidden />
        <span className="font-medium text-foreground">{tableName}</span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
          {connection.driver}
        </span>
        {data?.total != null && (
          <span className="font-mono text-xs text-muted-foreground">
            {data.total.toLocaleString()} rows total
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {canEdit && (
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={handleStartInsert}>
              <PlusIcon className="size-3.5" />
              Insert
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={loadData} disabled={loading}>
            <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          {!canEdit && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <LockIcon className="size-3.5" />
              Read-only
            </span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <Trash2Icon className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Failed to load data</p>
            <p className="mt-1 max-w-md font-mono text-xs text-muted-foreground">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCwIcon className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading data...
        </div>
      )}

      {/* Data grid */}
      {!loading && !error && result && (
        <>
          <div className="min-h-0 flex-1">
            <ResultsGrid result={result} />
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages}
              {data?.total != null && ` · ${data.total.toLocaleString()} total`}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon className="size-3.5" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Edit / Insert dialog */}
      {editing && (
        <EditRowDialog
          mode={editing.mode}
          data={editing.data}
          structure={structure}
          columns={data?.columns || []}
          onChange={(d) => setEditing(prev => prev ? { ...prev, data: d } : null)}
          onSave={handleSaveEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function EditRowDialog({
  mode,
  data,
  structure,
  columns,
  onChange,
  onSave,
  onCancel,
}: {
  mode: 'insert' | 'update'
  data: Record<string, unknown>
  structure: ColumnDef[] | null
  columns: string[]
  onChange: (data: Record<string, unknown>) => void
  onSave: () => void
  onCancel: () => void
}) {
  const allColumns = structure?.map(c => c.name) || columns

  function getFieldInfo(col: string): { type: string; nullable: boolean; pk: boolean } {
    if (structure) {
      const s = structure.find(c => c.name === col)
      if (s) return { type: s.type, nullable: s.nullable, pk: !!s.isPrimaryKey }
    }
    return { type: 'text', nullable: true, pk: false }
  }

  function handleFieldChange(col: string, value: string) {
    const info = getFieldInfo(col)
    let parsed: unknown = value
    if (value === '' && info.nullable) {
      parsed = null
    } else if (info.type.includes('int') || info.type.includes('serial')) {
      parsed = parseInt(value, 10)
      if (isNaN(parsed as number)) parsed = null
    } else if (info.type.includes('numeric') || info.type.includes('decimal') || info.type.includes('float') || info.type.includes('double')) {
      parsed = parseFloat(value)
      if (isNaN(parsed as number)) parsed = null
    } else if (info.type.includes('bool')) {
      parsed = value === 'true' || value === '1' || value === 't'
    } else if (info.type.includes('json') || info.type.includes('jsonb')) {
      try { parsed = JSON.parse(value) } catch { parsed = value }
    }
    onChange({ ...data, [col]: parsed })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">
            {mode === 'insert' ? 'Insert new row' : 'Edit row'}
          </h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <div className="space-y-3">
            {allColumns.map(col => {
              const info = getFieldInfo(col)
              const value = data[col]
              const displayValue = value === null || value === undefined ? '' :
                typeof value === 'object' ? JSON.stringify(value) : String(value)
              return (
                <div key={col} className="flex items-start gap-3">
                  <label className="w-40 shrink-0 pt-1.5 text-right text-xs font-medium text-muted-foreground">
                    {col}
                    {info.pk && <span className="ml-1 text-primary">PK</span>}
                  </label>
                  <div className="flex-1">
                    {info.type.includes('json') || info.type.includes('jsonb') || (info.type.includes('text') && info.type.includes('[]')) ? (
                      <textarea
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs"
                        rows={3}
                        value={displayValue}
                        placeholder={info.nullable ? 'NULL' : 'Required'}
                        onChange={e => handleFieldChange(col, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                        value={displayValue}
                        placeholder={info.nullable ? 'NULL' : 'Required'}
                        onChange={e => handleFieldChange(col, e.target.value)}
                      />
                    )}
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{info.type}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onSave}>
            {mode === 'insert' ? 'Insert row' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
