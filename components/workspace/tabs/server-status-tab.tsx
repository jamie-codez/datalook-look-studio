"use client"

import type { Tab } from "@/lib/types"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ServerIcon, CpuIcon, HardDriveIcon, ActivityIcon, GaugeIcon, ClockIcon } from "lucide-react"

// Deterministic pseudo-metrics derived from connection id so they are stable.
function metricsFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const r = (n: number) => ((h >> n) & 0xff) / 255
  return {
    cpu: Math.round(12 + r(0) * 55),
    memory: Math.round(30 + r(3) * 55),
    disk: Math.round(20 + r(6) * 60),
    connections: Math.round(4 + r(9) * 80),
    qps: Math.round(50 + r(12) * 900),
    cacheHit: Math.round(88 + r(16) * 11),
  }
}

function Meter({ label, value, unit = "%", icon: Icon }: { label: string; value: number; unit?: string; icon: typeof CpuIcon }) {
  const tone = value > 80 ? "bg-destructive" : value > 60 ? "bg-warning" : "bg-chart-2"
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
        {value}
        <span className="ml-0.5 text-base text-muted-foreground">{unit}</span>
      </p>
      {unit === "%" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
        </div>
      )}
    </div>
  )
}

export function ServerStatusTab({ tab }: { tab: Tab }) {
  const { connections } = useWorkspace()
  const connection = connections.find((c) => c.id === tab.connectionId)

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

  const m = metricsFor(connection.id)
  const days = Math.floor(connection.uptimeHours / 24)
  const hours = connection.uptimeHours % 24

  const meta: [string, string][] = [
    ["Driver", connection.driver],
    ["Version", connection.version],
    ["Host", connection.host],
    ["Port", String(connection.port)],
    ["Database", connection.database],
    ["User", connection.username],
    ["Access", connection.readOnly ? "Read-only" : "Read / Write"],
    ["Schemas", String(connection.schemas.length)],
    ["Topology", connection.topology ?? "standalone"],
  ]

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-4xl p-6">
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
            Uptime {days}d {hours}h
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Meter label="CPU" value={m.cpu} icon={CpuIcon} />
          <Meter label="Memory" value={m.memory} icon={ActivityIcon} />
          <Meter label="Disk" value={m.disk} icon={HardDriveIcon} />
          <Meter label="Active connections" value={m.connections} unit="" icon={GaugeIcon} />
          <Meter label="Queries / sec" value={m.qps} unit="" icon={ActivityIcon} />
          <Meter label="Cache hit ratio" value={m.cacheHit} icon={GaugeIcon} />
        </div>

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
