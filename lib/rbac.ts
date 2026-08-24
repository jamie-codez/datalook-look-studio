import type {
  Connection,
  ConnectionRole,
  Role,
  StatementType,
  User,
} from './types'

// The set of discrete capabilities the UI gates on.
export type Permission =
  | 'query.read' // run SELECT / read-only statements
  | 'query.write' // run INSERT / UPDATE / DELETE
  | 'query.ddl' // run CREATE / DROP / ALTER / TRUNCATE
  | 'data.edit' // edit rows inline in the data grid
  | 'transaction.control' // commit / rollback
  | 'connection.manage' // create / edit / delete connections + view credentials
  | 'users.manage' // manage users & roles
  | 'audit.view' // view audit logs

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Viewer: ['query.read'],
  Editor: [
    'query.read',
    'query.write',
    'query.ddl',
    'data.edit',
    'transaction.control',
  ],
  Admin: [
    'query.read',
    'query.write',
    'query.ddl',
    'data.edit',
    'transaction.control',
    'connection.manage',
    'users.manage',
    'audit.view',
  ],
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role]
}

const ROLE_SUMMARY: Record<Role, string> = {
  Admin:
    'Full access: manage connections & credentials, users & roles, audit logs, and run any statement.',
  Editor:
    'Can read, write, and run DDL, edit data, and control transactions — but cannot manage connections or users.',
  Viewer:
    'Read-only: can browse schema and run SELECT queries. Write and DDL statements are blocked.',
}

export function roleSummary(role: Role): string {
  return ROLE_SUMMARY[role]
}

// ---------------------------------------------------------------------------
// Per-connection access control
//
// The global Role governs platform-wide capabilities (managing users, viewing
// audit logs, creating shared connections). Access to the *data* inside a
// connection is governed separately by a ConnectionRole, resolved per user and
// per connection. This lets a global Viewer own a personal connection with
// full rights, while a global Editor may only be a viewer on a shared one.
// ---------------------------------------------------------------------------

export const CONNECTION_ROLES: ConnectionRole[] = [
  'viewer',
  'editor',
  'manager',
  'admin',
]

const CONNECTION_ROLE_RANK: Record<ConnectionRole, number> = {
  viewer: 1,
  editor: 2,
  manager: 3,
  admin: 4,
}

const CONNECTION_ROLE_LABEL: Record<ConnectionRole, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  manager: 'Manager',
  admin: 'Admin',
}

const CONNECTION_ROLE_SUMMARY: Record<ConnectionRole, string> = {
  viewer: 'Browse schema and run read-only SELECT queries.',
  editor: 'Read, write, run DDL, and edit rows.',
  manager: 'Everything an Editor can do, plus assign and manage user access.',
  admin: 'Full control including deleting the connection and managing access.',
}

export function connectionRoleLabel(role: ConnectionRole): string {
  return CONNECTION_ROLE_LABEL[role]
}

export function connectionRoleSummary(role: ConnectionRole): string {
  return CONNECTION_ROLE_SUMMARY[role]
}

export interface ConnectionCapabilities {
  canRead: boolean
  canWrite: boolean
  canDDL: boolean
  canEditData: boolean
  canManageAccess: boolean
  canDelete: boolean
}

export function connectionCapabilities(
  role: ConnectionRole,
): ConnectionCapabilities {
  const rank = CONNECTION_ROLE_RANK[role]
  return {
    canRead: true,
    canWrite: rank >= CONNECTION_ROLE_RANK.editor,
    canDDL: rank >= CONNECTION_ROLE_RANK.editor,
    canEditData: rank >= CONNECTION_ROLE_RANK.editor,
    canManageAccess: rank >= CONNECTION_ROLE_RANK.manager,
    canDelete: rank >= CONNECTION_ROLE_RANK.admin,
  }
}

/**
 * Resolve a user's effective role on a connection, or `null` when they have no
 * access at all (which means the connection should be hidden from them).
 *
 * - The system store is visible to everyone: Admins manage it, others read it.
 * - Personal connections are visible only to their owner (who is Admin on it).
 * - On shared connections, platform Admins and the owner are always Admin;
 *   everyone else gets exactly the role from their grant, if any.
 */
export function effectiveConnectionRole(
  user: User,
  connection: Connection,
): ConnectionRole | null {
  if (connection.isSystem) return user.role === 'Admin' ? 'admin' : 'viewer'
  if (connection.ownerId === user.id) return 'admin'
  if (connection.scope === 'personal') return null
  if (user.role === 'Admin') return 'admin'
  const grant = connection.grants.find((g) => g.userId === user.id)
  return grant ? grant.role : null
}

/**
 * Statement-level enforcement using the connection role (source of truth for
 * data operations). Returns null when allowed, or a reason when blocked.
 */
export function checkConnectionStatementAllowed(
  role: ConnectionRole,
  type: StatementType,
): string | null {
  const caps = connectionCapabilities(role)
  const perm = permissionForStatement(type)
  const label = CONNECTION_ROLE_LABEL[role]
  if (perm === 'query.write' && !caps.canWrite) {
    return `Your ${label} access on this connection cannot run ${type} statements. Editor access or higher is required.`
  }
  if (perm === 'query.ddl' && !caps.canDDL) {
    return `Your ${label} access on this connection cannot run ${type} statements. Schema changes require Editor access or higher.`
  }
  return null
}

const READ_STATEMENTS: StatementType[] = ['SELECT']
const WRITE_STATEMENTS: StatementType[] = ['INSERT', 'UPDATE', 'DELETE']
const DDL_STATEMENTS: StatementType[] = ['CREATE', 'DROP', 'ALTER', 'TRUNCATE']

/** Classify a raw SQL string by its leading keyword. */
export function classifyStatement(sql: string): StatementType {
  const trimmed = sql
    .replace(/--.*$/gm, '') // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
    .trim()
    .toUpperCase()

  const keyword = trimmed.split(/\s+/)[0] as StatementType
  const known: StatementType[] = [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'CREATE',
    'DROP',
    'ALTER',
    'TRUNCATE',
  ]
  return known.includes(keyword) ? keyword : 'UNKNOWN'
}

/** Which permission a given statement type requires. */
export function permissionForStatement(type: StatementType): Permission {
  if (READ_STATEMENTS.includes(type)) return 'query.read'
  if (WRITE_STATEMENTS.includes(type)) return 'query.write'
  if (DDL_STATEMENTS.includes(type)) return 'query.ddl'
  return 'query.read'
}

/** Returns null if allowed, or a human-readable reason if blocked. */
export function checkStatementAllowed(
  role: Role,
  type: StatementType,
): string | null {
  const permission = permissionForStatement(type)
  if (can(role, permission)) return null

  if (permission === 'query.write') {
    return `${role} role cannot run ${type} statements. Data modification requires Editor or Admin.`
  }
  if (permission === 'query.ddl') {
    return `${role} role cannot run ${type} statements. Schema changes require Editor or Admin.`
  }
  return `${role} role is not permitted to run ${type} statements.`
}
