'use client'

import * as React from 'react'
import { CONNECTIONS, findTable } from '@/lib/mock-data'
import type {
  AuditLogItem,
  AuditStatus,
  Connection,
  ConnectionGrant,
  ConnectionRole,
  QueryHistoryItem,
  Role,
  Tab,
} from '@/lib/types'
import { effectiveConnectionRole } from '@/lib/rbac'
import { driverAccent, driverMeta } from '@/lib/drivers'
import {
  type AppConfig,
  loadAppConfig,
  loadAuditLog,
  loadConnections,
  saveAppConfig,
  saveAuditEntry,
  saveConnection,
  deleteConnection as deletePersistedConnection,
} from '@/lib/persistence'
import { buildSystemConnection } from '@/lib/system-store'
import { SystemStoreSetup } from '@/components/workspace/system-store-setup'
import { LoaderCircle } from 'lucide-react'
import type { DriverId } from '@/lib/types'
import { useAuth } from './auth-provider'
import { isProduction, SKIP_ONBOARDING, DEFAULT_DB_DRIVER } from '@/lib/env'

let idCounter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`

interface NewConnectionInput {
  name: string
  driver: Connection['driver']
  host: string
  port: number
  database: string
  username: string
  readOnly: boolean
  /** shared = team connection with grants; personal = owner-only */
  scope: Connection['scope']
  /** access grants to apply (shared connections only) */
  grants: ConnectionGrant[]
  /** deployment topology */
  topology?: Connection['topology']
  /** additional replica hosts */
  replicaHosts?: Connection['replicaHosts']
}

interface WorkspaceContextValue {
  /** connections the current user can see (personal owned + granted shared) */
  connections: Connection[]
  tabs: Tab[]
  activeTabId: string | null
  activeTab: Tab | null
  queryHistory: QueryHistoryItem[]
  auditLog: AuditLogItem[]

  openTab: (tab: Omit<Tab, 'id'>, opts?: { focusExisting?: boolean }) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabSql: (tabId: string, sql: string) => void

  addConnection: (input: NewConnectionInput) => void
  removeConnection: (connectionId: string) => void
  /** replace the grant list for a shared connection */
  updateConnectionGrants: (
    connectionId: string,
    grants: ConnectionGrant[],
  ) => void
  /** the current user's effective role on a connection, or null if none */
  connectionRoleFor: (connection: Connection) => ConnectionRole | null

  recordQuery: (item: Omit<QueryHistoryItem, 'id' | 'timestamp'>) => void
  logAudit: (
    action: string,
    target: string,
    status: AuditStatus,
    roleOverride?: Role,
  ) => void
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()
  // Full catalogue; each user only sees the subset they have access to.
  // Production starts empty — connections come only from the admin / persistence.
  const [allConnections, setAllConnections] = React.useState<Connection[]>(
    isProduction ? [] : CONNECTIONS,
  )
  // First-run + persistence lifecycle.
  const [hydrated, setHydrated] = React.useState(false)
  const [config, setConfig] = React.useState<AppConfig | null>(null)

  // Load persisted config + encrypted connections once on mount, and merge the
  // rebuilt system store (derived from config) with the code-seeded demos.
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      let [cfg, persisted, persistedAudit] = await Promise.all([
        loadAppConfig(),
        loadConnections(),
        loadAuditLog(),
      ])
      if (cancelled) return

      // Production with SKIP_ONBOARDING auto-configures the system store from
      // the env-provided driver. Without SKIP_ONBOARDING, the system store
      // setup screen is shown on first run (after onboarding completes).
      if (isProduction && SKIP_ONBOARDING && !cfg.initialized) {
        cfg = {
          initialized: true,
          systemStore: { driver: DEFAULT_DB_DRIVER, category: driverMeta(DEFAULT_DB_DRIVER).category },
        }
        await saveAppConfig(cfg)
      }

      const merged = new Map<string, Connection>()
      if (!isProduction) for (const c of CONNECTIONS) merged.set(c.id, c)
      for (const c of persisted) merged.set(c.id, c)
      if (cfg.initialized && cfg.systemStore) {
        const sys = buildSystemConnection(cfg.systemStore.driver, currentUser.id)
        merged.set(sys.id, sys)
      }
      setAllConnections(Array.from(merged.values()))
      setConfig(cfg)
      if (persistedAudit.length > 0) {
        setAuditLog(persistedAudit)
      }
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
    // Runs once; currentUser.id only seeds the system store owner label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Complete first-run setup: persist the choice, build the system store, and
  // reveal the workspace.
  const completeSetup = React.useCallback(
    async (driver: DriverId) => {
      const next: AppConfig = {
        initialized: true,
        systemStore: { driver, category: driverMeta(driver).category },
      }
      await saveAppConfig(next)
      const sys = buildSystemConnection(driver, currentUser.id)
      setAllConnections((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]))
        map.set(sys.id, sys)
        return Array.from(map.values())
      })
      setConfig(next)
    },
    [currentUser.id],
  )

  const [tabs, setTabs] = React.useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = React.useState<string | null>(null)

  // Ref mirror of `tabs` so imperative handlers (openTab/closeTab) can read the
  // current list synchronously without nesting setState calls inside updaters.
  const tabsRef = React.useRef<Tab[]>(tabs)
  React.useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])
  const [queryHistory, setQueryHistory] = React.useState<QueryHistoryItem[]>([])
  const [auditLog, setAuditLog] = React.useState<AuditLogItem[]>([])

  const logAudit = React.useCallback(
    (action: string, target: string, status: AuditStatus, roleOverride?: Role) => {
      const entry: AuditLogItem = {
        id: nextId('audit'),
        timestamp: Date.now(),
        userName: currentUser.name,
        role: roleOverride ?? currentUser.role,
        action,
        target,
        status,
      }
      setAuditLog((prev) => [entry, ...prev])
      saveAuditEntry(entry).catch(() => {})
    },
    [currentUser],
  )

  const openTab = React.useCallback(
    (tab: Omit<Tab, 'id'>, opts?: { focusExisting?: boolean }) => {
      const prev = tabsRef.current
      if (opts?.focusExisting) {
        // For table-bound tabs, focus an existing tab of same kind + table.
        if (tab.tableId) {
          const existing = prev.find(
            (t) => t.kind === tab.kind && t.tableId === tab.tableId,
          )
          if (existing) {
            setActiveTabId(existing.id)
            return
          }
        }
        // Singleton tabs (users/audit/server-status) shouldn't duplicate.
        if (['users', 'audit', 'server-status', 'settings', 'admin'].includes(tab.kind)) {
          const singleton = prev.find(
            (t) => t.kind === tab.kind && t.connectionId === tab.connectionId,
          )
          if (singleton) {
            setActiveTabId(singleton.id)
            return
          }
        }
      }
      const id = nextId('tab')
      const newTab = { ...tab, id }
      tabsRef.current = [...prev, newTab]
      setTabs(tabsRef.current)
      setActiveTabId(id)
    },
    [],
  )

  const closeTab = React.useCallback((tabId: string) => {
    const prev = tabsRef.current
    const idx = prev.findIndex((t) => t.id === tabId)
    const next = prev.filter((t) => t.id !== tabId)
    tabsRef.current = next
    setTabs(next)
    setActiveTabId((current) => {
      if (current !== tabId) return current
      if (next.length === 0) return null
      // Focus the neighbour that took its place.
      const neighbour = next[Math.min(idx, next.length - 1)]
      return neighbour.id
    })
  }, [])

  const setActiveTab = React.useCallback((tabId: string) => {
    setActiveTabId(tabId)
  }, [])

  const updateTabSql = React.useCallback((tabId: string, sql: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, sql, dirty: true } : t)),
    )
  }, [])

  const addConnection = React.useCallback(
    (input: NewConnectionInput) => {
      const id = nextId('conn')
      const connection: Connection = {
        id,
        name: input.name,
        driver: input.driver,
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        status: 'connected',
        readOnly: input.readOnly,
        accent: driverAccent(input.driver),
        version: 'Simulated 1.0',
        uptimeHours: 0,
        scope: input.scope,
        ownerId: currentUser.id,
        // Personal connections carry no grants; the owner already has full access.
        grants: input.scope === 'shared' ? input.grants : [],
        // Credentials for user-created connections are persisted encrypted.
        encrypted: true,
        topology: input.topology,
        replicaHosts: input.replicaHosts,
        schemas: [
          {
            id: `${id}.${driverMeta(input.driver).vocab.container}`,
            name: driverMeta(input.driver).vocab.container,
            procedures: [],
            tables: [],
          },
        ],
      }
      setAllConnections((prev) => [...prev, connection])
      // Persist with credentials encrypted at rest.
      void saveConnection(connection)
    },
    [currentUser.id],
  )

  const removeConnection = React.useCallback((connectionId: string) => {
    setAllConnections((prev) => {
      const target = prev.find((c) => c.id === connectionId)
      // The pinned system store cannot be removed.
      if (target?.isSystem) return prev
      return prev.filter((c) => c.id !== connectionId)
    })
    setTabs((prev) => prev.filter((t) => t.connectionId !== connectionId))
    void deletePersistedConnection(connectionId)
  }, [])

  const updateConnectionGrants = React.useCallback(
    (connectionId: string, grants: ConnectionGrant[]) => {
      setAllConnections((prev) =>
        prev.map((c) => {
          if (c.id !== connectionId || c.scope !== 'shared') return c
          const updated = { ...c, grants }
          // Persist grant changes for user-created (encrypted) connections.
          if (updated.encrypted && !updated.isSystem) void saveConnection(updated)
          return updated
        }),
      )
    },
    [],
  )

  // Only surface connections the current user can actually access.
  const connections = React.useMemo(
    () =>
      allConnections.filter(
        (c) => effectiveConnectionRole(currentUser, c) !== null,
      ),
    [allConnections, currentUser],
  )

  const connectionRoleFor = React.useCallback(
    (connection: Connection) => effectiveConnectionRole(currentUser, connection),
    [currentUser],
  )

  const recordQuery = React.useCallback(
    (item: Omit<QueryHistoryItem, 'id' | 'timestamp'>) => {
      setQueryHistory((prev) => [
        { ...item, id: nextId('q'), timestamp: Date.now() },
        ...prev,
      ])
    },
    [],
  )

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      connections,
      tabs,
      activeTabId,
      activeTab,
      queryHistory,
      auditLog,
      openTab,
      closeTab,
      setActiveTab,
      updateTabSql,
      addConnection,
      removeConnection,
      updateConnectionGrants,
      connectionRoleFor,
      recordQuery,
      logAudit,
    }),
    [
      connections,
      tabs,
      activeTabId,
      activeTab,
      queryHistory,
      auditLog,
      openTab,
      closeTab,
      setActiveTab,
      updateTabSql,
      addConnection,
      removeConnection,
      updateConnectionGrants,
      connectionRoleFor,
      recordQuery,
      logAudit,
    ],
  )

  // While IndexedDB hydrates, show a lightweight loading state.
  if (!hydrated || !config) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading workspace…
        </div>
      </div>
    )
  }

  // First run: choose the system store before entering the workspace.
  if (!config.initialized) {
    return <SystemStoreSetup onComplete={completeSetup} />
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = React.useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}

export { findTable }
