"use client"

import * as React from "react"
import { ArrowLeftIcon, ChevronRightIcon, Table2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** A single frame in the drill-in stack. */
interface Frame {
  /** breadcrumb label for this level */
  label: string
  /** the value being displayed at this level (object or array) */
  value: unknown
}

interface NestedValueViewerProps {
  /** the root nested value (object/array) opened from a cell */
  value: unknown
  /** label of the originating column, used as the first breadcrumb */
  rootLabel: string
  /** transform origin (cell center) so the zoom emerges from the cell */
  origin?: { x: number; y: number } | null
  onClose: () => void
}

function isDrillable(v: unknown): v is Record<string, unknown> | unknown[] {
  return v !== null && typeof v === "object"
}

/** Render a scalar leaf value with type-aware coloring. */
function Scalar({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="italic text-muted-foreground/50">null</span>
  if (typeof value === "boolean")
    return <span className={value ? "text-chart-2" : "text-chart-5"}>{String(value)}</span>
  if (typeof value === "number") return <span className="text-chart-1">{value}</span>
  return <span className="text-foreground">{String(value)}</span>
}

/**
 * Displays a nested object/array as a two-column key/value table. Any nested
 * object/array value shows a "..." affordance that pushes a new frame onto the
 * drill stack with a zoom-in animation; a back button pops with zoom-out.
 */
export function NestedValueViewer({
  value,
  rootLabel,
  origin,
  onClose,
}: NestedValueViewerProps) {
  const [stack, setStack] = React.useState<Frame[]>([{ label: rootLabel, value }])
  // Direction drives which zoom animation plays on the active frame.
  const [dir, setDir] = React.useState<"in" | "out">("in")
  const current = stack[stack.length - 1]

  // Reset the stack whenever a new root value is opened.
  React.useEffect(() => {
    setStack([{ label: rootLabel, value }])
    setDir("in")
  }, [value, rootLabel])

  function push(label: string, next: unknown) {
    setDir("in")
    setStack((s) => [...s, { label, value: next }])
  }
  function back() {
    if (stack.length <= 1) {
      onClose()
      return
    }
    setDir("out")
    setStack((s) => s.slice(0, -1))
  }

  const entries: [string, unknown][] = Array.isArray(current.value)
    ? current.value.map((v, i) => [String(i), v])
    : isDrillable(current.value)
      ? Object.entries(current.value)
      : [["value", current.value]]

  const originStyle = origin
    ? ({
        "--dl-origin-x": `${origin.x}px`,
        "--dl-origin-y": `${origin.y}px`,
      } as React.CSSProperties)
    : undefined

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header: back button + breadcrumb trail */}
      <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={back}
          aria-label={stack.length > 1 ? "Back one level" : "Close nested view"}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-thin">
          {stack.map((f, i) => {
            const last = i === stack.length - 1
            return (
              <React.Fragment key={i}>
                {i > 0 && (
                  <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/60" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (last) return
                    setDir("out")
                    setStack((s) => s.slice(0, i + 1))
                  }}
                  className={cn(
                    "shrink-0 rounded px-1 py-0.5 font-mono text-[11px]",
                    last
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:underline",
                  )}
                >
                  {f.label}
                </button>
              </React.Fragment>
            )
          })}
        </div>
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {Array.isArray(current.value)
            ? `${(current.value as unknown[]).length} items`
            : `${entries.length} keys`}
        </span>
      </div>

      {/* Body: animated frame */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          key={stack.length}
          style={originStyle}
          className={dir === "in" ? "dl-zoom-in" : "dl-zoom-out"}
        >
          <table className="w-full border-collapse text-xs">
            <tbody>
              {entries.map(([key, val]) => {
                const drillable = isDrillable(val)
                const count = drillable
                  ? Array.isArray(val)
                    ? (val as unknown[]).length
                    : Object.keys(val as object).length
                  : 0
                return (
                  <tr key={key} className="border-b border-border/70 hover:bg-accent/30">
                    <td className="w-40 border-r border-border/70 px-3 py-1.5 align-top font-mono text-[11px] text-muted-foreground">
                      {Array.isArray(current.value) ? (
                        <span className="text-chart-1">[{key}]</span>
                      ) : (
                        key
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-mono">
                      {drillable ? (
                        <button
                          type="button"
                          onClick={() => push(key, val)}
                          className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                          aria-label={`Open nested ${Array.isArray(val) ? "array" : "object"} ${key}`}
                        >
                          {Array.isArray(val) ? (
                            <span className="text-chart-1">[ ]</span>
                          ) : (
                            <Table2Icon className="size-3" />
                          )}
                          <span className="font-semibold tracking-wider">···</span>
                          <span className="text-[10px] opacity-70">
                            {Array.isArray(val) ? `${count} items` : `${count} keys`}
                          </span>
                        </button>
                      ) : (
                        <Scalar value={val} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
