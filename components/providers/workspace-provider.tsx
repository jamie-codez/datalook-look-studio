'use client'

import * as React from 'react'
import { CONNECTIONS } from '@/lib/mock-data'
import type {
  AuditLogItem,
  AuditStatus,
  Connection,
  ConnectionGrant,
  ConnectionRole,
  QueryHistoryItem,
  ReplicaHost,
  Role,
  SchemaMeta,
  TableKind,
  TableMeta,
  Tab,
} from '@/lib/types'
import { effectiveConnectionRole } from '@/lib/rbac'
import { driverAccent, driverMeta } from '@/lib/drivers'
import {
  type AppConfig,
  loadAppConfig,
  loadAuditLog,
  loadConnections,
  loadQueryHistory,
  saveAppConfig,
  saveAuditEntry,
  saveConnection,
  saveQueryHistoryItem,
  deleteConnection as deletePersistedConnection,
} from '@/lib/persistence'
import { buildSystemConnection } from '@/lib/system-store'
import {
  createConnection,
  deleteConnectionRemote,
  fetchConnections,
  fetchSchemas,
  fetchTables,
  replaceConnectionGrantsRemote,
  updateConnectionRemote,
  type RemoteConnection,
} from '@/lib/db/api-client'
import { SystemStoreSetup } from '@/components/workspace/system-store-setup'
import { LoaderCircle } from 'lucide-react'
import type { DriverId } from '@/lib/types'
import { useAuth } from './auth-provider'
import { isProduction, SKIP_ONBOARDING, DEFAULT_DB_DRIVER, SYSTEM_BACKEND_IS_POSTGRES } from '@/lib/env'

let idCounter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`

/**
 * Demo connections and their fixture data only exist in the browser-demo
 * build. Real deployments never seed them, so every table a user sees comes
 * from a live adapter.
 */
const SEED_DEMO_DATA = !SYSTEM_BACKEND_IS_POSTGRES && !isProduction

/** True when this connection's metadata and queries go to a real server. */
function isLive(connection: Connection): boolean {
  if (connection.isSystem) return SYSTEM_BACKEND_IS_POSTGRES
  return !SEED_DEMO_DATA || connection.encrypted === true
}

function tableKindFor(driver: DriverId): TableKind {
  const { category } = driverMeta(driver)
  if (category === 'document') return 'collection'
  if (category === 'keyvalue' || category === 'widecolumn') return 'keyspace'
  return 'table'
}

/** Tree node for a table the server reported. Columns and row counts load on demand. */
function liveTable(connection: Connection, schemaName: string, tableName: string): TableMeta {
  return {
    id: `${connection.id}.${schemaName}.${tableName}`,
    name: tableName,
    kind: tableKindFor(connection.driver),
    columns: [],
    rowCount: 0,
  }
}

function remoteToConnection(r: RemoteConnection): Connection {
  const driver = r.driver as DriverId
  return {
    id: r.id,
    name: r.name,
    driver,
    host: r.host,
    port: r.port,
    database: r.database,
    username: r.username,
    password: '',
    status: 'disconnected',
    readOnly: r.readOnly,
    schemas: [],
    accent: driverAccent(driver),
    version: '',
    uptimeHours: 0,
    scope: r.scope,
    ownerId: r.ownerId,
    grants: r.grants,
    encrypted: true,
    topology: r.topology as Connection['topology'],
    replicaHosts: (r.options.replicaHosts as ReplicaHost[] | undefined) ?? undefined,
  }
}

/** Fields the server needs to test and save a connection. */
function connectionPayload(id: string, input: NewConnectionInput, ownerId: string) {
  return {
    id,
    driver: input.driver,
    name: input.name,
    host: input.host,
    port: input.port,
    database: input.database,
    username: input.username,
    password: input.password,
    readOnly: input.readOnly,
    scope: input.scope,
    ownerId,
    topology: input.topology,
    replicaHosts: input.replicaHosts,
  }
}

function connectionFromInput(id: string, input: NewConnectionInput, ownerId: string): Connection {
  return {
    id,
    name: input.name,
    driver: input.driver,
    host: input.host,
    port: input.port,
    database: input.database,
    username: input.username,
    password: input.password,
    status: 'disconnected',
    readOnly: input.readOnly,
    accent: driverAccent(input.driver),
    version: '',
    uptimeHours: 0,
    scope: input.scope,
    ownerId,
    grants: input.scope === 'shared' ? input.grants : [],
    encrypted: true,
    topology: input.topology,
    replicaHosts: input.replicaHosts,
    // Filled in by loadSchemaTree once the server has listed the schemas.
    schemas: [],
  }
}

interface NewConnectionInput {
  name: string
  driver: Connection['driver']
  host: string
  port: number
  database: string
  username: string
  password: string
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
  updateConnection: (id: string, input: NewConnectionInput) => Promise<void>
  removeConnection: (connectionId: string) => Promise<void>
  /** replace the grant list for a shared connection */
  updateConnectionGrants: (
    connectionId: string,
    grants: ConnectionGrant[],
  ) => Promise<void>
  /** load databases' schemas and tables for a live connection into its tree */
  loadSchemaTree: (connection: Connection) => Promise<SchemaMeta[]>
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
  // Only the browser demo starts with fixture connections.
  const [allConnections, setAllConnections] = React.useState<Connection[]>(
    SEED_DEMO_DATA ? CONNECTIONS : [],
  )
  // Mirror for handlers that need the current list without re-subscribing.
  const allConnectionsRef = React.useRef<Connection[]>(allConnections)
  React.useEffect(() => {
    allConnectionsRef.current = allConnections
  }, [allConnections])
  // First-run + persistence lifecycle.
  const [hydrated, setHydrated] = React.useState(false)
  const [config, setConfig] = React.useState<AppConfig | null>(null)

  // Load persisted config + encrypted connections once on mount.
  // In production, initSystemStore already ran in AuthProvider, so we just
  // load the persisted state. Without SKIP_ONBOARDING, show SystemStoreSetup
  // on first run (after onboarding completes).
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [cfg, persisted, persistedAudit, persistedHistory, remote] = await Promise.all([
        loadAppConfig(),
        SYSTEM_BACKEND_IS_POSTGRES ? Promise.resolve([]) : loadConnections(),
        SYSTEM_BACKEND_IS_POSTGRES ? Promise.resolve([]) : loadAuditLog(),
        SYSTEM_BACKEND_IS_POSTGRES ? Promise.resolve([]) : loadQueryHistory(),
        // Real backend: the server is the only source of connections, so one
        // browser's IndexedDB can't drift from what the team sees.
        SYSTEM_BACKEND_IS_POSTGRES ? fetchConnections().catch(() => []) : Promise.resolve([]),
      ])
      if (cancelled) return

      const merged = new Map<string, Connection>()
      if (SEED_DEMO_DATA) for (const c of CONNECTIONS) merged.set(c.id, c)
      for (const c of persisted) merged.set(c.id, c)
      for (const r of remote) merged.set(r.id, remoteToConnection(r))

      // With SKIP_ONBOARDING, the setup dialog never runs — auto-complete it
      // with the deployment's configured driver so the system store actually
      // shows up in the navigator on first run.
      let effectiveCfg = cfg
      if (!cfg.initialized && SKIP_ONBOARDING) {
        effectiveCfg = {
          initialized: true,
          systemStore: { driver: DEFAULT_DB_DRIVER, category: driverMeta(DEFAULT_DB_DRIVER).category },
        }
        await saveAppConfig(effectiveCfg)
      }

      if (effectiveCfg.initialized && effectiveCfg.systemStore) {
        const sys = buildSystemConnection(effectiveCfg.systemStore.driver, currentUser.id)
        merged.set(sys.id, sys)
      }
      setAllConnections(Array.from(merged.values()))
      setConfig(effectiveCfg)

      if (SYSTEM_BACKEND_IS_POSTGRES) {
        try {
          const res = await fetch('/api/system/audit-log')
          if (res.ok) {
            const { entries } = (await res.json()) as { entries: AuditLogItem[] }
            setAuditLog(entries)
          }
        } catch {
          // Viewers without audit.view just see an empty log.
        }
        try {
          const res = await fetch('/api/system/query-history')
          if (res.ok) {
            const { entries } = (await res.json()) as { entries: QueryHistoryItem[] }
            setQueryHistory(entries)
          }
        } catch {
          // Not authenticated yet, or the request failed — history stays empty.
        }
      } else {
        if (persistedAudit.length > 0) setAuditLog(persistedAudit)
        if (persistedHistory.length > 0) setQueryHistory(persistedHistory)
      }
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
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
      if (SYSTEM_BACKEND_IS_POSTGRES) {
        fetch('/api/system/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, target, status }),
        }).catch(() => {})
      } else {
        saveAuditEntry(entry).catch(() => {})
      }
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
    async (input: NewConnectionInput) => {
      const id = nextId('conn')

      if (SYSTEM_BACKEND_IS_POSTGRES) {
        // The server tests the connection before saving it. A failure throws
        // back to the dialog, so nothing half-created shows up in the tree.
        await createConnection(connectionPayload(id, input, currentUser.id))
        setAllConnections((prev) => [
          ...prev,
          { ...connectionFromInput(id, input, currentUser.id), status: 'connected' },
        ])
        return
      }

      const connection = connectionFromInput(id, input, currentUser.id)
      setAllConnections((prev) => [...prev, connection])
      void saveConnection(connection)

      // Also save server-side for Route Handler access + test the connection.
      try {
        const result = await createConnection(connectionPayload(id, input, currentUser.id))
        if (result.status === 'connected') {
          setAllConnections((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: 'connected' } : c)),
          )
        }
      } catch {
        // Server-side creation failed — connection still saved client-side
      }
    },
    [currentUser.id],
  )

  const updateConnection = React.useCallback(
    async (id: string, input: NewConnectionInput) => {
      const payload = {
        name: input.name,
        driver: input.driver,
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        password: input.password,
        readOnly: input.readOnly,
        scope: input.scope,
        topology: input.topology,
        replicaHosts: input.replicaHosts,
      }
      if (SYSTEM_BACKEND_IS_POSTGRES) {
        await updateConnectionRemote(id, payload)
      } else {
        // Browser demo: keep the server's copy in step, best effort.
        void updateConnectionRemote(id, payload).catch(() => {})
      }
      setAllConnections((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c
          const updated: Connection = {
            ...c,
            name: input.name,
            driver: input.driver,
            host: input.host,
            port: input.port,
            database: input.database,
            username: input.username,
            // Real backend: the server never returns a password. An empty field
            // here means "keep the stored one", so don't blank the local copy.
            password: input.password || c.password,
            readOnly: input.readOnly,
            scope: input.scope,
            grants: input.scope === 'shared' ? input.grants : [],
            topology: input.topology,
            replicaHosts: input.replicaHosts,
            accent: driverAccent(input.driver),
            // The shape changed (possibly a new driver), so the old tree is stale.
            schemas: c.driver === input.driver && c.database === input.database ? c.schemas : [],
          }
          if (!SYSTEM_BACKEND_IS_POSTGRES) void saveConnection(updated)
          return updated
        }),
      )
    },
    [],
  )

  const removeConnection = React.useCallback(async (connectionId: string) => {
    const target = allConnectionsRef.current.find((c) => c.id === connectionId)
    // The pinned system store cannot be removed.
    if (target?.isSystem) return
    if (SYSTEM_BACKEND_IS_POSTGRES) {
      await deleteConnectionRemote(connectionId)
    } else {
      void deleteConnectionRemote(connectionId).catch(() => {})
    }
    setAllConnections((prev) => prev.filter((c) => c.id !== connectionId))
    setTabs((prev) => prev.filter((t) => t.connectionId !== connectionId))
    void deletePersistedConnection(connectionId)
  }, [])

  const updateConnectionGrants = React.useCallback(
    async (connectionId: string, grants: ConnectionGrant[]) => {
      const target = allConnectionsRef.current.find((c) => c.id === connectionId)
      if (!target || target.scope !== 'shared') return
      if (SYSTEM_BACKEND_IS_POSTGRES) {
        await replaceConnectionGrantsRemote(connectionId, grants)
      } else if (!target.isSystem) {
        void replaceConnectionGrantsRemote(connectionId, grants).catch(() => {})
      }
      setAllConnections((prev) =>
        prev.map((c) => {
          if (c.id !== connectionId || c.scope !== 'shared') return c
          const updated = { ...c, grants }
          // Browser demo keeps grant changes in IndexedDB for user-created connections.
          if (!SYSTEM_BACKEND_IS_POSTGRES && updated.encrypted && !updated.isSystem) {
            void saveConnection(updated)
          }
          return updated
        }),
      )
    },
    [],
  )

  /**
   * Fill a live connection's tree with the schemas and tables the server
   * reports for its configured database. Columns and row counts are fetched
   * when a table is opened, not here, so the tree stays cheap on big servers.
   */
  const loadSchemaTree = React.useCallback(async (connection: Connection): Promise<SchemaMeta[]> => {
    if (!isLive(connection)) return connection.schemas
    const category = driverMeta(connection.driver).category
    const database = connection.database
    try {
      let schemas: SchemaMeta[]
      if (category === 'sql') {
        const names = await fetchSchemas(connection.id, database)
        schemas = await Promise.all(
          names.map(async (schemaName) => {
            const tables = await fetchTables(connection.id, database, schemaName)
            return {
              id: `${connection.id}.${schemaName}`,
              name: schemaName,
              procedures: [],
              tables: tables.map((t) => liveTable(connection, schemaName, t)),
            }
          }),
        )
      } else {
        // Document and key-value stores have no schema level; show their
        // collections or keyspaces under the database itself.
        const tables = await fetchTables(connection.id, database)
        schemas = [
          {
            id: `${connection.id}.${database}`,
            name: database,
            procedures: [],
            tables: tables.map((t) => liveTable(connection, database, t)),
          },
        ]
      }
      setAllConnections((prev) =>
        prev.map((c) => (c.id === connection.id ? { ...c, schemas, status: 'connected' } : c)),
      )
      return schemas
    } catch (err) {
      setAllConnections((prev) =>
        prev.map((c) => (c.id === connection.id ? { ...c, status: 'error' } : c)),
      )
      throw err
    }
  }, [])

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
      const entry: QueryHistoryItem = { ...item, id: nextId('q'), timestamp: Date.now() }
      setQueryHistory((prev) => [entry, ...prev])
      if (SYSTEM_BACKEND_IS_POSTGRES) {
        fetch('/api/system/query-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        }).catch(() => {})
      } else {
        saveQueryHistoryItem(entry).catch(() => {})
      }
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
      updateConnection,
      removeConnection,
      updateConnectionGrants,
      loadSchemaTree,
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
      updateConnection,
      removeConnection,
      updateConnectionGrants,
      loadSchemaTree,
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

  // First run without SKIP_ONBOARDING: choose the system store before entering the workspace.
  if (!config.initialized && !SKIP_ONBOARDING) {
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

