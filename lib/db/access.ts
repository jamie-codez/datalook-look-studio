import { NextResponse, type NextRequest } from 'next/server'
import { getSessionFromRequest, type SessionPayload } from '@/lib/auth/session'
import { SYSTEM_BACKEND_IS_POSTGRES } from '@/lib/env'
import { SYSTEM_CONNECTION_ID } from '@/lib/system-store'
import { loadServerConnectionRecord, type ServerConnectionRecord } from './server-store'
import type { ConnectionAccessRole } from './system-db'
import { classifyStatement, permissionForStatement } from '@/lib/rbac'

const RANK: Record<ConnectionAccessRole, number> = {
  viewer: 0,
  editor: 1,
  manager: 2,
  admin: 3,
}

/**
 * Server-side mirror of effectiveConnectionRole() in lib/rbac.ts. The client
 * copy only decides what to show; this one decides what the API will do.
 */
function roleFor(
  session: SessionPayload,
  record: ServerConnectionRecord,
): ConnectionAccessRole | null {
  if (record.ownerId === session.uid) return 'admin'
  if (record.scope === 'personal') return null
  if (session.role === 'Admin') return 'admin'
  return record.grants.find((g) => g.userId === session.uid)?.role ?? null
}

/**
 * Returns an error response when the caller can't use connection `id` at the
 * `need` level, or null when access is allowed. Browser-demo mode has no
 * server identity, so there's nothing to enforce there and it passes through.
 */
export async function guardConnection(
  request: NextRequest,
  id: string,
  need: ConnectionAccessRole,
): Promise<NextResponse | null> {
  if (!SYSTEM_BACKEND_IS_POSTGRES) return null

  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (id === SYSTEM_CONNECTION_ID) {
    // The system store is visible to everyone signed in, writable only by admins.
    const role: ConnectionAccessRole = session.role === 'Admin' ? 'admin' : 'viewer'
    return RANK[role] >= RANK[need]
      ? null
      : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const record = await loadServerConnectionRecord(id)
  if (!record) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const role = roleFor(session, record)
  if (!role || RANK[role] < RANK[need]) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Read-only connections refuse data writes whatever the caller's role.
  if (need === 'editor' && record.readOnly) {
    return NextResponse.json({ error: 'This connection is read-only' }, { status: 403 })
  }
  return null
}

/**
 * Like guardConnection, but chooses the required level from the query itself:
 * SELECT-style SQL needs viewer, anything else (or any non-SQL native query,
 * which we can't classify) needs editor.
 */
export async function guardQuery(
  request: NextRequest,
  id: string,
  query: unknown,
): Promise<NextResponse | null> {
  const isReadOnlySql =
    typeof query === 'string' &&
    permissionForStatement(classifyStatement(query)) === 'query.read'
  return guardConnection(request, id, isReadOnlySql ? 'viewer' : 'editor')
}

export { roleFor }
