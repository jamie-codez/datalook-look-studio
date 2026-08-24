"use client"

import * as React from "react"
import { useAuth, useRBAC } from "@/components/providers/auth-provider"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RoleBadge } from "@/components/workspace/role-badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ShieldXIcon, SearchIcon, CircleCheckIcon, CircleXIcon, ScrollTextIcon } from "lucide-react"
import type { AuditStatus } from "@/lib/types"

type StatusFilter = "all" | AuditStatus

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ts).toLocaleDateString()
}

export function AuditLogTab() {
  const { currentUser } = useAuth()
  const { can } = useRBAC()
  const { auditLog } = useWorkspace()
  const allowed = can("audit.view")

  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("all")

  const filtered = React.useMemo(() => {
    return auditLog.filter((item) => {
      if (status !== "all" && item.status !== status) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        return (
          item.action.toLowerCase().includes(q) ||
          item.target.toLowerCase().includes(q) ||
          item.userName.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [auditLog, status, query])

  if (!allowed) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <ShieldXIcon />
          </EmptyMedia>
          <EmptyTitle>Access denied</EmptyTitle>
          <EmptyDescription>
            Audit logs are restricted to Admins. Your current role is {currentUser.role}.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const blockedCount = auditLog.filter((a) => a.status === "blocked").length

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
        <InputGroup className="h-8 max-w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search actions, targets, users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
        <ToggleGroup
          value={[status]}
          onValueChange={(v) => v[0] && setStatus(v[0] as StatusFilter)}
          variant="outline"
          className="h-8"
        >
          <ToggleGroupItem value="all" className="px-3 text-xs">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="allowed" className="px-3 text-xs">
            Allowed
          </ToggleGroupItem>
          <ToggleGroupItem value="blocked" className="px-3 text-xs">
            Blocked
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="ml-auto flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>{auditLog.length} events</span>
          {blockedCount > 0 && <span className="text-destructive">{blockedCount} blocked</span>}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScrollTextIcon />
              </EmptyMedia>
              <EmptyTitle>No audit events</EmptyTitle>
              <EmptyDescription>
                Actions like running queries, managing connections, and changing roles will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="divide-y divide-border">
            {filtered.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                    item.status === "allowed"
                      ? "bg-chart-2/15 text-chart-2"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {item.status === "allowed" ? (
                    <CircleCheckIcon className="size-4" aria-hidden />
                  ) : (
                    <CircleXIcon className="size-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-medium">{item.action}</span>
                    <span className="text-muted-foreground"> · {item.target}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {item.userName}
                    <RoleBadge role={item.role} showIcon={false} className="px-1 py-0 text-[10px]" />
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {timeAgo(item.timestamp)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </ScrollArea>
    </div>
  )
}
