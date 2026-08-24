"use client"

import { useWorkspace } from "@/components/providers/workspace-provider"
import { cn } from "@/lib/utils"
import {
  DatabaseIcon,
  FileCodeIcon,
  TableIcon,
  InfoIcon,
  ServerIcon,
  UsersIcon,
  ScrollTextIcon,
  SettingsIcon,
  LayoutDashboardIcon,
  XIcon,
} from "lucide-react"
import type { TabKind } from "@/lib/types"

const TAB_ICONS: Record<TabKind, typeof DatabaseIcon> = {
  sql: FileCodeIcon,
  data: TableIcon,
  properties: InfoIcon,
  "server-status": ServerIcon,
  users: UsersIcon,
  audit: ScrollTextIcon,
  settings: SettingsIcon,
  admin: LayoutDashboardIcon,
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useWorkspace()

  if (tabs.length === 0) return null

  return (
    <div
      role="tablist"
      aria-label="Open editors"
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-card"
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.kind]
        const active = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setActiveTab(tab.id)
              }
            }}
            className={cn(
              "group relative flex min-w-0 max-w-56 cursor-pointer items-center gap-2 border-r border-border px-3 text-xs outline-none transition-colors",
              active
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
            )}
          >
            {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" aria-hidden />}
            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{tab.title}</span>
            <button
              type="button"
              aria-label={`Close ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              <XIcon className="size-3" aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
