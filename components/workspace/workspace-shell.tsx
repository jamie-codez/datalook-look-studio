"use client"

import * as React from "react"
import { TopBar } from "@/components/workspace/top-bar"
import { Navigator } from "@/components/workspace/navigator"
import { TabBar } from "@/components/workspace/tab-bar"
import { TabContent } from "@/components/workspace/tab-content"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { useAuth } from "@/components/providers/auth-provider"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { DatabaseIcon, FileCodeIcon, TableIcon, ServerIcon } from "lucide-react"

function WelcomePane() {
  const { connections, openTab } = useWorkspace()
  const { currentUser } = useAuth()
  const first = connections[0]

  return (
    <div className="flex h-full items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <DatabaseIcon className="size-7" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground text-balance">
          Welcome back, {currentUser.name.split(" ")[0]}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          Datalook Studio is your browser-based workspace for exploring and querying databases. Pick a
          table from the Navigator, or start with one of these:
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={() =>
              openTab({
                kind: "sql",
                title: "Untitled query",
                connectionId: first?.id,
                sql: "SELECT * FROM customers LIMIT 25;",
              })
            }
          >
            <FileCodeIcon className="size-5 text-primary" aria-hidden />
            <span className="text-xs font-medium">New SQL editor</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            disabled={!first}
            onClick={() => {
              const table = first?.schemas[0]?.tables[0]
              if (first && table)
                openTab(
                  {
                    kind: "data",
                    title: table.name,
                    connectionId: first.id,
                    schemaName: first.schemas[0].name,
                    tableId: table.id,
                  },
                  { focusExisting: true },
                )
            }}
          >
            <TableIcon className="size-5 text-primary" aria-hidden />
            <span className="text-xs font-medium">Browse a table</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            disabled={!first}
            onClick={() =>
              first &&
              openTab(
                {
                  kind: "server-status",
                  title: `${first.name} · status`,
                  connectionId: first.id,
                },
                { focusExisting: true },
              )
            }
          >
            <ServerIcon className="size-5 text-primary" aria-hidden />
            <span className="text-xs font-medium">Server status</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusBar() {
  const { connections, tabs, queryHistory } = useWorkspace()
  const { currentUser } = useAuth()
  const connected = connections.filter((c) => c.status === "connected").length
  const last = queryHistory[0]

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-sidebar px-3 font-mono text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        {connected}/{connections.length} connected
      </span>
      <span className="hidden sm:inline">·</span>
      <span className="hidden sm:inline">{tabs.length} open tabs</span>
      {last && (
        <>
          <span className="hidden sm:inline">·</span>
          <span className="hidden max-w-xs truncate sm:inline">
            last: {last.statementType} {last.status === "success" ? `${last.rowCount} rows` : last.status} in{" "}
            {last.durationMs}ms
          </span>
        </>
      )}
      <span className="ml-auto truncate">
        {currentUser.name} · {currentUser.role}
      </span>
    </footer>
  )
}

export function WorkspaceShell() {
  const { tabs, activeTabId } = useWorkspace()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="min-h-0 flex-1">
        {/* Desktop layout: resizable panels */}
        <ResizablePanelGroup orientation="horizontal" className="hidden md:flex">
          <ResizablePanel defaultSize="22" minSize="15" maxSize="40" className="h-full min-h-0 overflow-hidden">
            <Navigator />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="78">
            <div className="flex h-full min-h-0 flex-col">
              <TabBar />
              <div className="min-h-0 flex-1">
                {tabs.length === 0 ? (
                  <WelcomePane />
                ) : (
                  tabs.map((tab) => (
                    <TabContent key={tab.id} tab={tab} active={tab.id === activeTabId} />
                  ))
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Mobile layout: sidebar as overlay drawer */}
        <div className="flex h-full md:hidden">
          {sidebarOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => setSidebarOpen(false)}
                aria-hidden
              />
              <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-sidebar shadow-xl">
                <Navigator />
              </div>
            </>
          )}
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <TabBar />
            <div className="min-h-0 flex-1">
              {tabs.length === 0 ? (
                <WelcomePane />
              ) : (
                tabs.map((tab) => (
                  <TabContent key={tab.id} tab={tab} active={tab.id === activeTabId} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
