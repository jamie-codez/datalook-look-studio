"use client"

import { useMemo } from "react"
import type { Column, QueryResult, Tab } from "@/lib/types"
import { useWorkspace, findTable } from "@/components/providers/workspace-provider"
import { useRBAC } from "@/components/providers/auth-provider"
import { generateRows } from "@/lib/mock-data"
import { ResultsGrid } from "@/components/workspace/results-grid"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { TableIcon, EyeIcon, LockIcon, InfoIcon } from "lucide-react"

export function DataGridTab({ tab }: { tab: Tab }) {
  const { connections } = useWorkspace()
  const { role } = useRBAC()
  const table = tab.tableId ? findTable(connections, tab.tableId) : undefined

  const result = useMemo<QueryResult | null>(() => {
    if (!table) return null
    const rows = generateRows(table, 200)
    return {
      columns: table.columns.map((c) => c.name),
      rows,
      durationMs: 0,
      statement: `SELECT * FROM ${table.name}`,
    }
  }, [table])

  const columnMeta = useMemo<Record<string, Column>>(() => {
    if (!table) return {}
    return Object.fromEntries(table.columns.map((c) => [c.name, c]))
  }, [table])

  if (!table || !result) {
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

  const canEdit = role !== "Viewer" && table.kind === "table"

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 text-sm">
        {table.kind === "view" ? (
          <EyeIcon className="size-4 text-chart-4" aria-hidden />
        ) : (
          <TableIcon className="size-4 text-primary" aria-hidden />
        )}
        <span className="font-medium text-foreground">{table.name}</span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
          {table.kind}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {table.rowCount.toLocaleString()} rows total · showing first {result.rows.length}
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {canEdit ? (
            <>
              <InfoIcon className="size-3.5" aria-hidden />
              Inline editing available for {role}
            </>
          ) : (
            <>
              <LockIcon className="size-3.5" aria-hidden />
              {table.kind === "view" ? "Views are read-only" : "Read-only (Viewer role)"}
            </>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ResultsGrid result={result} columnMeta={columnMeta} />
      </div>
    </div>
  )
}
