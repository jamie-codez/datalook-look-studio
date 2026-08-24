"use client"

import type { Tab } from "@/lib/types"
import { useWorkspace, findTable } from "@/components/providers/workspace-provider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { KeyRoundIcon, Link2Icon, TableIcon, HashIcon } from "lucide-react"

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function PropertiesTab({ tab }: { tab: Tab }) {
  const { connections } = useWorkspace()
  const table = tab.tableId ? findTable(connections, tab.tableId) : undefined
  const connection = connections.find((c) => c.id === tab.connectionId)

  if (!table) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TableIcon />
          </EmptyMedia>
          <EmptyTitle>Table not found</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  const pkCount = table.columns.filter((c) => c.isPrimaryKey).length
  const fkCount = table.columns.filter((c) => c.isForeignKey).length

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center gap-2">
          <TableIcon className="size-5 text-primary" aria-hidden />
          <h2 className="font-mono text-lg font-semibold text-foreground">
            {tab.schemaName}.{table.name}
          </h2>
          <Badge variant="secondary" className="uppercase">
            {table.kind}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {connection?.name} · {connection?.driver}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Rows" value={table.rowCount.toLocaleString()} />
          <StatCard label="Columns" value={String(table.columns.length)} />
          <StatCard label="Primary keys" value={String(pkCount)} />
          <StatCard label="Foreign keys" value={String(fkCount)} />
        </div>

        <h3 className="mt-6 mb-2 text-sm font-semibold text-foreground">Columns</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Column</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Nullable</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Default</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Keys</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col, i) => (
                <tr
                  key={col.name}
                  className={i % 2 === 0 ? "bg-card" : "bg-card/40"}
                >
                  <td className="px-3 py-2 font-mono text-foreground">{col.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{col.type}</td>
                  <td className="px-3 py-2">
                    {col.nullable ? (
                      <span className="text-muted-foreground">YES</span>
                    ) : (
                      <span className="text-chart-5">NO</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {col.defaultValue ?? <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {col.isPrimaryKey && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          <KeyRoundIcon className="size-3" aria-hidden />
                          PK
                        </span>
                      )}
                      {col.isForeignKey && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          <Link2Icon className="size-3" aria-hidden />
                          {col.references}
                        </span>
                      )}
                      {!col.isPrimaryKey && !col.isForeignKey && (
                        <HashIcon className="size-3 text-muted-foreground/30" aria-hidden />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ScrollArea>
  )
}
