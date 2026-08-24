"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Column, QueryResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group"
import {
  SearchIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DownloadIcon,
  MapPinIcon,
  ListFilterIcon,
  Table2Icon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { detectGeoSchema, collectPoints } from "@/lib/geo"
import { MapPanel } from "@/components/workspace/map-panel"
import { NestedValueViewer } from "@/components/workspace/nested-value-viewer"

type SortState = { column: string; dir: "asc" | "desc" } | null

/** A cell value that should render as a drill-in ("...") rather than text. */
function isNested(v: unknown): v is Record<string, unknown> | unknown[] {
  return v !== null && typeof v === "object"
}

/** Searchable text for any cell value, including nested objects/arrays. */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "object") {
    try {
      return JSON.stringify(v)
    } catch {
      return ""
    }
  }
  return String(v)
}

interface DrillTarget {
  column: string
  value: unknown
  origin: { x: number; y: number } | null
}

interface ResultsGridProps {
  result: QueryResult
  /** optional per-column metadata keyed by column name (types, pk flags) */
  columnMeta?: Record<string, Column>
}

export function ResultsGrid({ result, columnMeta }: ResultsGridProps) {
  const [filter, setFilter] = useState("")
  // Per-column contains-filters keyed by column name.
  const [colFilters, setColFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<SortState>(null)
  const [showMap, setShowMap] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  // Active nested-cell drill-in, shown in the side panel.
  const [drill, setDrill] = useState<DrillTarget | null>(null)
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null)

  const activeColFilters = useMemo(
    () => Object.entries(colFilters).filter(([, v]) => v.trim() !== ""),
    [colFilters],
  )

  const rows = useMemo(() => {
    let out = result.rows
    if (filter.trim()) {
      const q = filter.toLowerCase()
      out = out.filter((r) =>
        result.columns.some((c) => cellText(r[c]).toLowerCase().includes(q)),
      )
    }
    if (activeColFilters.length) {
      out = out.filter((r) =>
        activeColFilters.every(([col, q]) =>
          cellText(r[col]).toLowerCase().includes(q.toLowerCase()),
        ),
      )
    }
    if (sort) {
      const dir = sort.dir
      out = [...out].sort((a, b) => {
        const av = a[sort.column]
        const bv = b[sort.column]
        if (av === bv) return 0
        if (av === null || av === undefined) return 1
        if (bv === null || bv === undefined) return -1
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : cellText(av).localeCompare(cellText(bv))
        return dir === "asc" ? cmp : -cmp
      })
    }
    return out
  }, [result, filter, sort, activeColFilters])

  // Geolocation detection over the current result set.
  const geoSchema = useMemo(() => detectGeoSchema(result.columns), [result.columns])
  const points = useMemo(
    () => (geoSchema ? collectPoints(rows, geoSchema) : []),
    [geoSchema, rows],
  )
  const hasGeo = geoSchema != null && points.length > 0
  const geoRows = useMemo(() => new Set(points.map((p) => p.index)), [points])

  // Reset selection when the visible data changes (filter/sort/new result).
  useEffect(() => {
    setSelected(null)
  }, [filter, sort, result])

  // Close any open drill-in when the underlying result set changes.
  useEffect(() => {
    setDrill(null)
  }, [result])

  // Keep the selected row visible when a marker drives the selection.
  useEffect(() => {
    if (selected == null || !tbodyRef.current) return
    const el = tbodyRef.current.querySelector(`[data-row="${selected}"]`)
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [selected])

  function toggleSort(col: string) {
    setSort((prev) => {
      if (!prev || prev.column !== col) return { column: col, dir: "asc" }
      if (prev.dir === "asc") return { column: col, dir: "desc" }
      return null
    })
  }

  function handleRowClick(i: number) {
    if (!hasGeo || !geoRows.has(i)) return
    setSelected(i)
    setShowMap(true)
  }

  function exportData(format: "csv" | "tsv" | "json" | "text") {
    let content = ""
    let mimeType = ""
    let ext = ""

    if (format === "json") {
      const data = rows.map((r) => {
        const obj: Record<string, unknown> = {}
        for (const col of result.columns) obj[col] = r[col]
        return obj
      })
      content = JSON.stringify(data, null, 2)
      mimeType = "application/json"
      ext = "json"
    } else if (format === "csv") {
      const header = result.columns.join(",")
      const body = rows
        .map((r) =>
          result.columns
            .map((c) => {
              const v = r[c]
              const s = v === null || v === undefined ? "" : String(v)
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
            })
            .join(","),
        )
        .join("\n")
      content = `${header}\n${body}`
      mimeType = "text/csv"
      ext = "csv"
    } else if (format === "tsv") {
      const header = result.columns.join("\t")
      const body = rows
        .map((r) =>
          result.columns
            .map((c) => {
              const v = r[c]
              const s = v === null || v === undefined ? "" : String(v)
              return s.replace(/\t/g, " ").replace(/\n/g, " ")
            })
            .join("\t"),
        )
        .join("\n")
      content = `${header}\n${body}`
      mimeType = "text/tab-separated-values"
      ext = "tsv"
    } else {
      // text — aligned columns
      const colWidths = result.columns.map((col) =>
        Math.max(col.length, ...rows.map((r) => {
          const v = r[col]
          return v === null || v === undefined ? 0 : String(v).length
        })),
      )
      const header = result.columns.map((c, i) => c.padEnd(colWidths[i])).join("  ")
      const separator = colWidths.map((w) => "-".repeat(w)).join("  ")
      const body = rows
        .map((r) =>
          result.columns
            .map((c, i) => {
              const v = r[c]
              const s = v === null || v === undefined ? "" : String(v)
              return s.padEnd(colWidths[i])
            })
            .join("  "),
        )
        .join("\n")
      content = `${header}\n${separator}\n${body}`
      mimeType = "text/plain"
      ext = "txt"
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `result.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported result set to ${format.toUpperCase()}`)
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5">
          <InputGroup className="h-7 max-w-64">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Filter rows"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs"
            />
          </InputGroup>
          <span className="font-mono text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "row" : "rows"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {hasGeo && (
              <Button
                variant={showMap ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowMap((v) => !v)}
              >
                <MapPinIcon data-icon="inline-start" />
                {showMap ? "Hide map" : "Map"}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {points.length}
                </span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" />}
              >
                <DownloadIcon data-icon="inline-start" />
                Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportData("csv")}>CSV (.csv)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportData("tsv")}>TSV (.tsv)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportData("json")}>JSON (.json)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportData("text")}>Text (.txt)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-secondary">
                <th className="w-10 border-b border-r border-border px-2 py-1.5 text-right font-mono text-[10px] font-normal text-muted-foreground">
                  #
                </th>
                {result.columns.map((colName) => {
                  const meta = columnMeta?.[colName]
                  const colFilter = colFilters[colName] ?? ""
                  const hasColFilter = colFilter.trim() !== ""
                  return (
                    <th
                      key={colName}
                      className="border-b border-r border-border text-left font-medium text-foreground last:border-r-0"
                    >
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => toggleSort(colName)}
                          className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 hover:bg-muted"
                          title={`Sort by ${colName}`}
                        >
                          <span className="truncate">{colName}</span>
                          {meta?.isPrimaryKey && (
                            <span className="rounded-sm bg-primary/15 px-1 font-mono text-[9px] uppercase text-primary">
                              pk
                            </span>
                          )}
                          {meta?.type && (
                            <span className="font-mono text-[10px] font-normal text-muted-foreground/70">
                              {meta.type}
                            </span>
                          )}
                          {sort?.column === colName &&
                            (sort.dir === "asc" ? (
                              <ArrowUpIcon className="size-3 text-primary" aria-hidden />
                            ) : (
                              <ArrowDownIcon className="size-3 text-primary" aria-hidden />
                            ))}
                        </button>
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className={cn(
                                  "mr-1 shrink-0",
                                  hasColFilter && "text-primary",
                                )}
                                onClick={(e) => e.stopPropagation()}
                              />
                            }
                          >
                            <ListFilterIcon />
                            <span className="sr-only">Filter {colName}</span>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-60 p-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">
                              Filter{" "}
                              <span className="font-mono text-foreground">
                                {colName}
                              </span>
                            </div>
                            <Input
                              autoFocus
                              value={colFilter}
                              placeholder="Contains…"
                              className="h-8 text-xs"
                              onChange={(e) =>
                                setColFilters((prev) => ({
                                  ...prev,
                                  [colName]: e.target.value,
                                }))
                              }
                            />
                            <div className="mt-1.5 flex flex-col border-t border-border pt-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 justify-start gap-2 text-xs font-normal"
                                onClick={() => setSort({ column: colName, dir: "asc" })}
                              >
                                <ArrowUpIcon data-icon="inline-start" />
                                Sort ascending
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 justify-start gap-2 text-xs font-normal"
                                onClick={() => setSort({ column: colName, dir: "desc" })}
                              >
                                <ArrowDownIcon data-icon="inline-start" />
                                Sort descending
                              </Button>
                              {hasColFilter && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 justify-start gap-2 text-xs font-normal text-destructive hover:text-destructive"
                                  onClick={() =>
                                    setColFilters((prev) => {
                                      const next = { ...prev }
                                      delete next[colName]
                                      return next
                                    })
                                  }
                                >
                                  <XIcon data-icon="inline-start" />
                                  Clear filter
                                </Button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {rows.map((row, i) => {
                const isGeo = geoRows.has(i)
                const isSelected = selected === i
                return (
                  <tr
                    key={i}
                    data-row={i}
                    onClick={() => handleRowClick(i)}
                    className={cn(
                      "hover:bg-accent/40",
                      isGeo && "cursor-pointer",
                      isSelected && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <td
                      className={cn(
                        "border-b border-r border-border bg-secondary/40 px-2 py-1 text-right font-mono text-[10px] text-muted-foreground",
                        isSelected && "bg-primary/20 text-primary",
                      )}
                    >
                      {isGeo ? (
                        <MapPinIcon
                          className={cn(
                            "inline size-3",
                            isSelected ? "text-primary" : "text-muted-foreground/60",
                          )}
                          aria-label="Has location"
                        />
                      ) : (
                        i + 1
                      )}
                    </td>
                    {result.columns.map((colName) => {
                      const val = row[colName]
                      const nested = isNested(val)
                      return (
                        <td
                          key={colName}
                          className={cn(
                            "max-w-xs border-b border-r border-border px-3 py-1 font-mono text-foreground last:border-r-0",
                            !nested && "truncate",
                          )}
                        >
                          {val === null || val === undefined ? (
                            <span className="italic text-muted-foreground/50">NULL</span>
                          ) : nested ? (
                            <NestedCellButton
                              value={val}
                              active={
                                drill?.column === colName &&
                                drill?.value === val
                              }
                              onOpen={(origin) =>
                                setDrill({ column: colName, value: val, origin })
                              }
                            />
                          ) : typeof val === "boolean" ? (
                            <span className={cn(val ? "text-chart-2" : "text-chart-5")}>{String(val)}</span>
                          ) : typeof val === "number" ? (
                            <span className="text-chart-1">{val}</span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drill && (
        <div className="w-[44%] min-w-80 max-w-[560px] shrink-0 border-l border-border">
          <NestedValueViewer
            value={drill.value}
            rootLabel={drill.column}
            origin={drill.origin}
            onClose={() => setDrill(null)}
          />
        </div>
      )}

      {!drill && hasGeo && showMap && (
        <div className="w-[42%] min-w-72 max-w-[520px] shrink-0">
          <MapPanel
            points={points}
            selectedIndex={selected}
            onSelect={setSelected}
            onClose={() => setShowMap(false)}
          />
        </div>
      )}
    </div>
  )
}

/** A "..." affordance rendered inside nested (object/array) cells. */
function NestedCellButton({
  value,
  active,
  onOpen,
}: {
  value: Record<string, unknown> | unknown[]
  active: boolean
  onOpen: (origin: { x: number; y: number } | null) => void
}) {
  const isArray = Array.isArray(value)
  const count = isArray
    ? (value as unknown[]).length
    : Object.keys(value as object).length
  // A compact preview of the first key/value so the cell isn't opaque.
  const preview = isArray
    ? `${count} item${count === 1 ? "" : "s"}`
    : Object.keys(value as object)
        .slice(0, 2)
        .join(", ") + (count > 2 ? "…" : "")

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        const r = e.currentTarget.getBoundingClientRect()
        // Origin relative to the viewport panel; used for the zoom transform.
        onOpen({ x: r.left, y: r.top })
      }}
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
      )}
      aria-label={`Open nested ${isArray ? "array" : "object"}`}
    >
      {isArray ? (
        <span className="text-chart-1">[ ]</span>
      ) : (
        <Table2Icon className="size-3 shrink-0" />
      )}
      <span className="font-semibold tracking-wider">···</span>
      <span className="truncate opacity-70">{preview}</span>
    </button>
  )
}
