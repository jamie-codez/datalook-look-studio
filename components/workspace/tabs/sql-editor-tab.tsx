"use client"

import { useCallback, useRef, useState } from "react"
import type { QueryResult, Tab } from "@/lib/types"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { classifyStatement, checkConnectionStatementAllowed, connectionCapabilities, permissionForStatement } from "@/lib/rbac"
import { runQuery as executeQueryApi } from "@/lib/db/api-client"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { ResultsGrid } from "@/components/workspace/results-grid"
import { highlightSql } from "@/lib/sql-highlight"
import { useWorkspaceEvent } from "@/lib/workspace-events"
import { cn } from "@/lib/utils"
import {
  PlayIcon,
  Loader2Icon,
  CircleCheckIcon,
  CircleXIcon,
  EraserIcon,
  ClockIcon,
  DatabaseIcon,
  TriangleAlertIcon,
  BookmarkIcon,
  BookmarkPlusIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  saveSavedQuery,
  deleteSavedQuery,
  loadSavedQueriesByDriver,
  type SavedQuery,
} from "@/lib/persistence"

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; result: QueryResult; affectedRows?: number; rowCount: number }
  | { status: "error"; message: string; blocked?: boolean }

export function SqlEditorTab({ tab, active }: { tab: Tab; active: boolean }) {
  const { connections, updateTabSql, recordQuery, logAudit, connectionRoleFor } =
    useWorkspace()
  const connection = connections.find((c) => c.id === tab.connectionId) ?? connections[0]
  // Access is governed by the user's role *on this connection*, not globally.
  const connRole = connection ? connectionRoleFor(connection) : null
  const [sql, setSql] = useState<string>(tab.sql ?? "SELECT * FROM customers LIMIT 25;")
  const [run, setRun] = useState<RunState>({ status: "idle" })
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [savedQueriesOpen, setSavedQueriesOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  const runQuery = useCallback(async () => {
    if (!connection) return
    const trimmed = sql.trim().replace(/;$/, "")
    if (!trimmed) return

    const type = classifyStatement(trimmed)

    // 1) Per-connection role enforcement.
    const roleBlock = connRole
      ? checkConnectionStatementAllowed(connRole, type)
      : "You do not have access to this connection."
    // 2) Connection-level read-only enforcement (writes/DDL blocked).
    const perm = permissionForStatement(type)
    const readOnlyBlock =
      connection.readOnly && perm !== "query.read"
        ? `Connection "${connection.name}" is read-only. ${type} statements are blocked.`
        : null

    const block = roleBlock ?? readOnlyBlock

    if (block) {
      setRun({ status: "error", message: block, blocked: true })
      logAudit(`Run ${type}`, connection.name, "blocked")
      recordQuery({
        sql: trimmed,
        durationMs: 0,
        status: "blocked",
        connectionName: connection.name,
        rowCount: 0,
        statementType: type,
      })
      toast.error("Query blocked", { description: block })
      return
    }

    setRun({ status: "running" })

    try {
      const result = await executeQueryApi(connection.id, trimmed)
      updateTabSql(tab.id, trimmed)
      logAudit(`Run ${type}`, connection.name, "allowed")

      if (result.error) {
        setRun({ status: "error", message: result.error })
        recordQuery({
          sql: trimmed,
          durationMs: result.durationMs,
          status: "error",
          connectionName: connection.name,
          rowCount: 0,
          statementType: type,
        })
        return
      }

      const rowCount = result.rows.length
      setRun({ status: "success", result, affectedRows: result.affectedRows, rowCount })
      recordQuery({
        sql: trimmed,
        durationMs: result.durationMs,
        status: "success",
        connectionName: connection.name,
        rowCount,
        statementType: type,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setRun({ status: "error", message })
      recordQuery({
        sql: trimmed,
        durationMs: 0,
        status: "error",
        connectionName: connection.name,
        rowCount: 0,
        statementType: type,
      })
    }
  }, [sql, connRole, connection, logAudit, recordQuery, updateTabSql, tab.id])

  // The top action bar's Run button drives the currently focused editor tab.
  useWorkspaceEvent("run-query", runQuery, active)
  useWorkspaceEvent(
    "format-sql",
    () => setSql((s) => s.replace(/\s+/g, " ").replace(/\s*,\s*/g, ",\n  ").trim()),
    active,
  )

  const refreshSavedQueries = useCallback(async () => {
    if (!connection) return
    const queries = await loadSavedQueriesByDriver(connection.driver)
    setSavedQueries(queries)
  }, [connection])

  const handleSaveQuery = useCallback(async () => {
    if (!connection || !sql.trim()) {
      toast.error("Nothing to save")
      return
    }
    const title = sql.trim().split("\n")[0].slice(0, 60)
    const query: SavedQuery = {
      id: `sq-${Date.now()}`,
      driver: connection.driver,
      connectionId: connection.id,
      title,
      body: sql.trim(),
      savedAt: new Date().toISOString(),
    }
    await saveSavedQuery(query)
    toast.success("Query saved", { description: title })
    refreshSavedQueries()
  }, [connection, sql, refreshSavedQueries])

  const handleLoadQuery = useCallback((query: SavedQuery) => {
    setSql(query.body)
    updateTabSql(tab.id, query.body)
    toast.info(`Loaded: ${query.title}`)
  }, [updateTabSql, tab.id])

  const handleDeleteQuery = useCallback(async (id: string) => {
    await deleteSavedQuery(id)
    refreshSavedQueries()
    toast.success("Query deleted")
  }, [refreshSavedQueries])

  function onChange(next: string) {
    setSql(next)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      runQuery()
      return
    }
    if (e.key === "Tab") {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = sql.slice(0, start) + "  " + sql.slice(end)
      setSql(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }

  function syncScroll() {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const connCaps = connRole ? connectionCapabilities(connRole) : null
  const writesBlocked = !connCaps?.canWrite || connection?.readOnly

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5">
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={runQuery}
          disabled={run.status === "running" || !connection}
        >
          {run.status === "running" ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <PlayIcon data-icon="inline-start" />
          )}
          Run
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => {
            setSql("")
            setRun({ status: "idle" })
          }}
        >
          <EraserIcon data-icon="inline-start" />
          Clear
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleSaveQuery}
        >
          <BookmarkPlusIcon data-icon="inline-start" />
          Save
        </Button>
        <DropdownMenu open={savedQueriesOpen} onOpenChange={(v) => {
          setSavedQueriesOpen(v)
          if (v) refreshSavedQueries()
        }}>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" />
            }
          >
            <BookmarkIcon data-icon="inline-start" />
            Saved
            {savedQueries.length > 0 && (
              <span className="rounded-sm bg-muted px-1 text-[10px] tabular-nums">
                {savedQueries.length}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            <DropdownMenuLabel>Saved queries ({connection?.driver})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {savedQueries.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                No saved queries for this driver yet.
              </div>
            ) : (
              <DropdownMenuGroup>
                {savedQueries.map((q) => (
                  <DropdownMenuItem
                    key={q.id}
                    className="flex-col items-start gap-0.5"
                    onClick={() => handleLoadQuery(q)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{q.title}</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteQuery(q.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(q.savedAt).toLocaleDateString()}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          {"\u2318"} Enter
        </kbd>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <DatabaseIcon className="size-3.5" aria-hidden />
          <span className="font-mono">{connection?.name ?? "No connection"}</span>
          {connection?.readOnly && (
            <span className="rounded-sm bg-chart-4/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-chart-4">
              read-only
            </span>
          )}
        </div>
      </div>

      {writesBlocked && (
        <div className="flex items-center gap-2 border-b border-border bg-chart-4/10 px-3 py-1 text-[11px] text-chart-4">
          <TriangleAlertIcon className="size-3 shrink-0" aria-hidden />
          {connection?.readOnly
            ? "This connection is read-only. Only SELECT statements are permitted."
            : "Your Viewer role has read-only access. INSERT / UPDATE / DELETE / DDL are blocked."}
        </div>
      )}

      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="45" minSize="20">
          {/* Editor */}
          <div className="relative h-full overflow-hidden bg-background font-mono text-[13px] leading-6">
            <div
              ref={highlightRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-4"
            >
              {highlightSql(sql, connection?.driver)}
              {"\n"}
            </div>
            <textarea
              ref={textareaRef}
              value={sql}
              spellCheck={false}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={syncScroll}
              className="absolute inset-0 h-full w-full resize-none whitespace-pre-wrap break-words bg-transparent p-4 text-transparent caret-foreground outline-none"
              placeholder={
                connection
                  ? `Write ${connection.driver === 'mongodb' ? 'MongoDB shell' : connection.driver === 'redis' ? 'Redis' : connection.driver === 'cassandra' ? 'CQL' : connection.driver === 'dynamodb' ? 'DynamoDB' : connection.driver === 'couchdb' ? 'CouchDB' : 'SQL'} here...`
                  : "Write a query here..."
              }
              aria-label="SQL editor"
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="55" minSize="20">
          {run.status === "idle" && (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PlayIcon />
                </EmptyMedia>
                <EmptyTitle>No results yet</EmptyTitle>
                <EmptyDescription>
                  Run a query with the Run button or {"\u2318"} Enter to see results here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {run.status === "running" && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Executing query...
            </div>
          )}
          {run.status === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  run.blocked ? "bg-chart-4/15 text-chart-4" : "bg-destructive/15 text-destructive",
                )}
              >
                {run.blocked ? <TriangleAlertIcon className="size-5" /> : <CircleXIcon className="size-5" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {run.blocked ? "Permission denied" : "Query error"}
                </p>
                <p className="mt-1 max-w-md font-mono text-xs text-muted-foreground">{run.message}</p>
              </div>
            </div>
          )}
          {run.status === "success" && (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                <CircleCheckIcon className="size-3.5 text-chart-2" aria-hidden />
                {run.result.columns.length > 0 ? (
                  <span className="text-chart-2">{run.rowCount} rows returned</span>
                ) : (
                  <span className="text-chart-2">
                    {run.affectedRows ?? 0} {run.affectedRows === 1 ? "row" : "rows"} affected
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <ClockIcon className="size-3" aria-hidden />
                  {run.result.durationMs} ms
                </span>
              </div>
              <div className="min-h-0 flex-1">
                {run.result.columns.length > 0 ? (
                  <ResultsGrid result={run.result} />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Statement completed successfully. No rows to display.
                  </div>
                )}
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
