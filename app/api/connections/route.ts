import { NextRequest, NextResponse } from 'next/server'
import { getConnectedAdapter } from '@/lib/db/adapter-factory'
import { saveServerConnection, listServerConnectionRecords, type ServerConnectionRecord } from '@/lib/db/server-store'
import { roleFor } from '@/lib/db/access'
import type { ConnectionConfig } from '@/lib/db/types'
import { DBError } from '@/lib/db/types'
import { getSessionFromRequest } from '@/lib/auth/session'
import { SYSTEM_BACKEND_IS_POSTGRES } from '@/lib/env'
import { can } from '@/lib/rbac'
import type { DriverId, Role } from '@/lib/types'

/** Connection metadata safe to send to the browser: never credentials. */
function toDto(record: ServerConnectionRecord) {
  return {
    id: record.id,
    name: record.name,
    driver: record.driver,
    host: record.host,
    port: record.port,
    database: record.database,
    username: record.username,
    scope: record.scope,
    ownerId: record.ownerId,
    readOnly: record.readOnly,
    topology: record.topology ?? 'standalone',
    options: record.options,
    grants: record.grants,
  }
}

/** GET — connections the signed-in user can see (their own, plus shared ones they've been granted). */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    if (!SYSTEM_BACKEND_IS_POSTGRES) {
      // Browser demo: the local JSON store is per-machine, there's no identity to filter by.
      const records = await listServerConnectionRecords()
      return NextResponse.json({ connections: records.map(toDto) })
    }
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const records = await listServerConnectionRecords()
    const visible = records.filter((r) => roleFor(session, r) !== null)
    return NextResponse.json({ connections: visible.map(toDto) })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    if (SYSTEM_BACKEND_IS_POSTGRES) {
      if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      if (!can(session.role as Role, 'connection.manage')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const {
      id,
      driver,
      name,
      host,
      port,
      database,
      username,
      password,
      filePath,
      region,
      localDataCenter,
      tls,
      connectionString,
      readOnly,
      scope,
      topology,
      replicaHosts,
    } = body

    if (!id || !driver) {
      return NextResponse.json({ error: 'Missing required fields: id, driver' }, { status: 400 })
    }

    const config: ConnectionConfig = {
      id,
      driver: driver as DriverId,
      host: host || '',
      port: port || 0,
      database: database || '',
      username: username || '',
      password: password || '',
      filePath,
      region,
      localDataCenter,
      tls,
      connectionString,
    }

    // Test the connection before anything is persisted, so a bad config never
    // becomes a saved connection.
    const adapter = await getConnectedAdapter(config)
    const alive = await adapter.testConnection()
    if (!alive) {
      return NextResponse.json(
        { error: 'Connection test failed — verify host, port, and credentials' },
        { status: 502 },
      )
    }

    // Owner is always the caller in real mode; a body-supplied ownerId is ignored.
    await saveServerConnection({
      ...config,
      name,
      readOnly,
      scope,
      topology,
      replicaHosts,
      ownerId: session?.uid ?? body.ownerId,
    })

    return NextResponse.json({ id, status: 'connected' })
  } catch (err) {
    if (err instanceof DBError) {
      const status =
        err.kind === 'auth' ? 401 :
        err.kind === 'permission' ? 403 :
        err.kind === 'not-found' ? 404 :
        err.kind === 'timeout' || err.kind === 'network' ? 502 :
        500
      return NextResponse.json({ error: err.message, kind: err.kind }, { status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
