// Single entry point for system store initialization in production.
//
// When the app starts in production with SKIP_ONBOARDING=true, this module:
//   1. Checks if the system DB (datalook-studio or env value) is already set up
//   2. If not, "creates" the database (simulated via IndexedDB)
//   3. Creates the schema: users, roles, connections, audit_log, query_history tables
//   4. Creates the admin user record from env vars
//   5. Creates the system store connection record using env DB credentials
//   6. Assigns the admin role to the admin user
//   7. Creates the first audit log entry
//
// Everything is persisted to IndexedDB so it survives page reloads.

import type { AuditLogItem, Connection, User, CustomRole, DriverId } from './types'
import { driverMeta } from './drivers'
import { buildSystemConnection, SYSTEM_CONNECTION_ID } from './system-store'
import {
  isProduction,
  SKIP_ONBOARDING,
  DEFAULT_DB_DRIVER,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  SYSTEM_DB_NAME,
} from './env'
import {
  loadAppConfig,
  saveAppConfig,
  saveConnection,
  loadConnections,
  saveAuditEntry,
  loadPersistedUsers,
  savePersistedUsers,
  loadPersistedCustomRoles,
  savePersistedCustomRoles,
  loadAdminPassword,
  saveAdminPassword,
  type AppConfig,
} from './persistence'

function initialsFrom(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export interface InitResult {
  config: AppConfig
  connections: Connection[]
  users: User[]
  customRoles: CustomRole[]
  adminPassword: string
  auditLog: AuditLogItem[]
  /** true if this was a first-run initialization, false if already initialized */
  freshlyInitialized: boolean
}

/**
 * Initialize the system store in production.
 *
 * This should be called once on app startup, after the auth provider has
 * determined that a current user exists (or will exist via env config).
 *
 * In development, this is a no-op — the app uses mock data instead.
 */
export async function initSystemStore(): Promise<InitResult | null> {
  if (!isProduction) return null

  // Load current state from IndexedDB.
  const [cfg, persistedConnections, persistedUsers, persistedRoles, persistedPassword] =
    await Promise.all([
      loadAppConfig(),
      loadConnections(),
      loadPersistedUsers(),
      loadPersistedCustomRoles(),
      loadAdminPassword(),
    ])

  // If already initialized, return existing state — nothing to create.
  if (cfg.initialized && cfg.systemStore) {
    console.info(
      `[Datalook] System store already initialized (driver: ${cfg.systemStore.driver}).`,
    )

    // Still need to check admin user existence even if system store is initialized.
    const adminEmail = DEFAULT_ADMIN_EMAIL.toLowerCase()
    const existingAdmin = persistedUsers.find(
      (u) => u.email.toLowerCase() === adminEmail,
    )

    let users = persistedUsers
    let adminPassword = persistedPassword || DEFAULT_ADMIN_PASSWORD

    if (SKIP_ONBOARDING && !existingAdmin) {
      console.info(
        `[Datalook] Admin user not found (${adminEmail}) — creating from env config.`,
      )
      const admin = makeAdminUser()
      users = [...persistedUsers, admin]
      await savePersistedUsers(users)
      await saveAdminPassword(DEFAULT_ADMIN_PASSWORD)
      adminPassword = DEFAULT_ADMIN_PASSWORD
    } else if (existingAdmin) {
      console.info(
        `[Datalook] Admin user already exists (${adminEmail}) — skipping creation.`,
      )
    }

    // Rebuild system connection from config (credentials come from env).
    const sys = buildSystemConnection(cfg.systemStore.driver, 'u-admin')
    const merged = new Map<string, Connection>()
    for (const c of persistedConnections) merged.set(c.id, c)
    merged.set(sys.id, sys)

    return {
      config: cfg,
      connections: Array.from(merged.values()),
      users,
      customRoles: persistedRoles,
      adminPassword,
      auditLog: [],
      freshlyInitialized: false,
    }
  }

  // --- First-run initialization ---
  console.info(
    `[Datalook] First run detected — initializing system store with driver: ${DEFAULT_DB_DRIVER}.`,
  )

  // Step 1: "Create" the database (simulated — we just record the config).
  console.info(`[Datalook] Creating database "${SYSTEM_DB_NAME}"...`)
  const newConfig: AppConfig = {
    initialized: true,
    systemStore: {
      driver: DEFAULT_DB_DRIVER,
      category: driverMeta(DEFAULT_DB_DRIVER).category,
    },
  }
  await saveAppConfig(newConfig)
  console.info(`[Datalook] Database "${SYSTEM_DB_NAME}" created.`)

  // Step 2: Create schema (tables are defined in buildSystemConnection).
  console.info('[Datalook] Creating schema: users, roles, connections, audit_log, query_history...')

  // Step 3: Create the system store connection record using env credentials.
  console.info('[Datalook] Creating system store connection record...')
  const sysConnection = buildSystemConnection(DEFAULT_DB_DRIVER, 'u-admin')
  await saveConnection(sysConnection)
  console.info(
    `[Datalook] System connection created: ${sysConnection.host}:${sysConnection.port}/${sysConnection.database} (user: ${sysConnection.username}).`,
  )

  // Step 4: Create admin user from env config.
  const adminEmail = DEFAULT_ADMIN_EMAIL.toLowerCase()
  const existingAdmin = persistedUsers.find(
    (u) => u.email.toLowerCase() === adminEmail,
  )

  let users = persistedUsers
  let adminPassword = persistedPassword || DEFAULT_ADMIN_PASSWORD

  if (SKIP_ONBOARDING) {
    if (existingAdmin) {
      console.info(
        `[Datalook] Admin user already exists (${adminEmail}) — skipping creation.`,
      )
    } else {
      console.info(
        `[Datalook] Creating admin user: ${DEFAULT_ADMIN_NAME} <${adminEmail}>...`,
      )
      const admin = makeAdminUser()
      users = [...persistedUsers, admin]
      await savePersistedUsers(users)
      await saveAdminPassword(DEFAULT_ADMIN_PASSWORD)
      adminPassword = DEFAULT_ADMIN_PASSWORD
      console.info('[Datalook] Admin user created with Admin role.')
    }
  }

  // Step 5: Create default custom roles (empty — admin can add later).
  if (persistedRoles.length === 0) {
    await savePersistedCustomRoles([])
  }

  // Step 6: Create first audit log entry.
  console.info('[Datalook] Creating first audit log entry...')
  const firstAudit: AuditLogItem = {
    id: `audit-${Date.now()}`,
    timestamp: Date.now(),
    userName: DEFAULT_ADMIN_NAME,
    role: 'Admin',
    action: 'System initialization',
    target: SYSTEM_DB_NAME,
    status: 'allowed',
  }
  await saveAuditEntry(firstAudit)
  console.info('[Datalook] Audit log entry created.')

  console.info('[Datalook] System store initialization complete.')

  // Build the final connections list.
  const merged = new Map<string, Connection>()
  for (const c of persistedConnections) merged.set(c.id, c)
  merged.set(sysConnection.id, sysConnection)

  return {
    config: newConfig,
    connections: Array.from(merged.values()),
    users,
    customRoles: persistedRoles,
    adminPassword,
    auditLog: [firstAudit],
    freshlyInitialized: true,
  }
}

function makeAdminUser(): User {
  return {
    id: 'u-admin',
    name: DEFAULT_ADMIN_NAME,
    email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
    role: 'Admin',
    initials: initialsFrom(DEFAULT_ADMIN_NAME),
  }
}
