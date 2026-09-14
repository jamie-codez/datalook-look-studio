"use client"

import * as React from "react"
import type { Tab } from "@/lib/types"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { fetchServerMetrics, type ServerMetrics } from "@/lib/db/api-client"
import {
  ServerIcon,
  ActivityIcon,
  GaugeIcon,
  ClockIcon,
  MemoryStickIcon,
  DatabaseIcon,
  InfoIcon,
  RefreshCwIcon,
  LoaderCircleIcon,
} from "lucide-react"

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function Stat({
  label,
  value,
  icon: Icon,
  barPercent,
}: {
  label: string
  value: React.ReactNode
  icon: typeof ActivityIcon
  /** 0-100, renders a progress bar when the metric has a meaningful ceiling */
  barPercent?: number
}) {
  const tone =
    barPercent !== undefined
      ? barPercent > 80
        ? "bg-destructive"
        : barPercent > 60
          ? "bg-warning"
          : "bg-chart-2"
      : ""
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</p>
      {barPercent !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, barPercent))}%` }} />
        </div>
      )}
    </div>
  )
}

export function ServerStatusTab({ tab }: { tab: Tab }) {
  const { connections } = useWorkspace()
  const connection = connections.find((c) => c.id === tab.connectionId)

  const [metrics, setMetrics] = React.useState<ServerMetrics | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!connection) return
    setLoading(true)
    setError(null)
    try {
      const m = await fetchServerMetrics(connection.id)
      setMetrics(m)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load server metrics")
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [connection?.id])

  React.useEffect(() => {
    load()
  }, [load])

  if (!connection) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ServerIcon />
          </EmptyMedia>
          <EmptyTitle>Connection not found</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  const meta: [string, string][] = [
    ["Driver", connection.driver],
    ["Version", metrics?.version || connection.version || "—"],
    ["Host", connection.host],
    ["Port", String(connection.port)],
    ["Database", connection.database],
    ["User", connection.username],
    ["Access", connection.readOnly ? "Read-only" : "Read / Write"],
    ["Schemas", String(connection.schemas.length)],
    ["Topology", connection.topology ?? "standalone"],
  ]
  if (metrics?.extra) {
    for (const [k, v] of Object.entries(metrics.extra)) meta.push([k, String(v)])
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ServerIcon className="size-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">{connection.name}</h2>
          <Badge
            variant={connection.status === "connected" ? "default" : "secondary"}
            className="capitalize"
          >
            <span
              className={`mr-1 size-1.5 rounded-full ${
                connection.status === "connected"
                  ? "bg-success"
                  : connection.status === "error"
                    ? "bg-destructive"
                    : "bg-muted-foreground"
              }`}
              aria-hidden
            />
            {connection.status}
          </Badge>
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            <ClockIcon className="size-4" aria-hidden />
            {metrics?.uptimeSeconds !== undefined ? `Uptime ${formatUptime(metrics.uptimeSeconds)}` : "Uptime —"}
          </span>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCwIcon className="size-3.5" aria-hidden />
            )}
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Couldn&apos;t reach this connection for live metrics: {error}</span>
          </div>
        )}

        {!error && metrics?.unavailableReason && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{metrics.unavailableReason}</span>
          </div>
        )}

        {!error && loading && !metrics && (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-lg border border-border bg-muted/40" />
            ))}
          </div>
        )}

        {!error && metrics && (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            {metrics.connections && (
              <Stat
                label="Active connections"
                value={
                  metrics.connections.max
                    ? `${metrics.connections.current} / ${metrics.connections.max}`
                    : metrics.connections.current
                }
                icon={GaugeIcon}
                barPercent={
                  metrics.connections.max
                    ? (metrics.connections.current / metrics.connections.max) * 100
                    : undefined
                }
              />
            )}
            {metrics.memoryBytes !== undefined && (
              <Stat label="Memory (server process)" value={formatBytes(metrics.memoryBytes)} icon={MemoryStickIcon} />
            )}
            {metrics.databaseSizeBytes !== undefined && (
              <Stat label="Database size" value={formatBytes(metrics.databaseSizeBytes)} icon={DatabaseIcon} />
            )}
            {metrics.cacheHitRatio !== undefined && (
              <Stat
                label="Cache hit ratio"
                value={`${Math.round(metrics.cacheHitRatio * 100)}%`}
                icon={GaugeIcon}
                barPercent={metrics.cacheHitRatio * 100}
              />
            )}
            {metrics.opsPerSecond !== undefined && (
              <Stat
                label={metrics.opsPerSecondLabel || "Ops/sec"}
                value={metrics.opsPerSecond.toFixed(1)}
                icon={ActivityIcon}
              />
            )}
          </div>
        )}

        {!error &&
          metrics &&
          !metrics.connections &&
          metrics.memoryBytes === undefined &&
          metrics.databaseSizeBytes === undefined &&
          metrics.cacheHitRatio === undefined &&
          metrics.opsPerSecond === undefined && (
            <p className="mt-5 text-sm text-muted-foreground">
              No live metrics fields were available from this driver right now.
            </p>
          )}

        <h3 className="mt-6 mb-2 text-sm font-semibold text-foreground">Server information</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <dl className="divide-y divide-border">
            {meta.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="font-mono text-sm text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {connection.replicaHosts && connection.replicaHosts.length > 0 && (
          <>
            <h3 className="mt-6 mb-2 text-sm font-semibold text-foreground">Replica hosts</h3>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-secondary text-left">
                    <th className="px-4 py-2 font-medium text-muted-foreground">Host</th>
                    <th className="px-4 py-2 font-medium text-muted-foreground">Port</th>
                    <th className="px-4 py-2 font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-2 font-medium text-muted-foreground">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border bg-primary/5">
                    <td className="px-4 py-2 font-mono text-foreground">{connection.host}</td>
                    <td className="px-4 py-2 font-mono text-foreground">{connection.port}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary" className="bg-primary/15 text-primary">primary</Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">—</td>
                  </tr>
                  {connection.replicaHosts.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-foreground">{r.host}</td>
                      <td className="px-4 py-2 font-mono text-foreground">{r.port}</td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary" className={
                          r.role === 'secondary' ? 'bg-chart-2/15 text-chart-2' : 'bg-muted text-muted-foreground'
                        }>
                          {r.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.priority ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  )
}
