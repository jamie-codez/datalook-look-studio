import { NextRequest, NextResponse } from 'next/server'
import { evictConnectionAdapters } from '@/lib/db/connection-manager'
import {
  loadServerConnection,
  loadServerConnectionRecord,
  saveServerConnection,
  deleteServerConnection,
} from '@/lib/db/server-store'
import { guardConnection } from '@/lib/db/access'
import { getConnectedAdapter } from '@/lib/db/adapter-factory'
import { SYSTEM_CONNECTION_ID } from '@/lib/system-store'
import type { DriverId } from '@/lib/types'

/** PUT — update a connection's settings. A blank password keeps the stored one. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (id === SYSTEM_CONNECTION_ID) {
      return NextResponse.json({ error: 'The system store is configured by the server' }, { status: 400 })
    }
    const denied = await guardConnection(request, id, 'admin')
    if (denied) return denied

    const existing = await loadServerConnection(id)
    const record = await loadServerConnectionRecord(id)
    if (!existing || !record) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const body = await request.json()
    const config = {
      id,
      driver: (body.driver || existing.driver) as DriverId,
      host: body.host ?? existing.host,
      port: body.port ?? existing.port,
      database: body.database ?? existing.database,
      username: body.username ?? existing.username,
      password: body.password ? body.password : existing.password,
      filePath: body.filePath ?? existing.filePath,
      region: body.region ?? existing.region,
      localDataCenter: body.localDataCenter ?? existing.localDataCenter,
      tls: body.tls ?? existing.tls,
      connectionString: body.connectionString ?? existing.connectionString,
    }

    // Test the edited config before saving it, and drop any cached adapter
    // so the next request connects with the new settings.
    await evictConnectionAdapters(id)
    const adapter = await getConnectedAdapter(config)
    if (!(await adapter.testConnection())) {
      await evictConnectionAdapters(id)
      return NextResponse.json(
        { error: 'Connection test failed — verify host, port, and credentials' },
        { status: 502 },
      )
    }

    await saveServerConnection({
      ...config,
      name: body.name ?? record.name,
      readOnly: body.readOnly ?? record.readOnly,
      scope: body.scope ?? record.scope,
      topology: body.topology ?? record.topology,
      replicaHosts: body.replicaHosts ?? record.options.replicaHosts,
      // Ownership never changes through an edit.
      ownerId: record.ownerId,
    })
    return NextResponse.json({ id, status: 'connected' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

/** DELETE — remove a connection and its grants. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (id === SYSTEM_CONNECTION_ID) {
      return NextResponse.json({ error: 'The system store cannot be removed' }, { status: 400 })
    }
    const denied = await guardConnection(request, id, 'admin')
    if (denied) return denied

    await evictConnectionAdapters(id)
    await deleteServerConnection(id)
    return NextResponse.json({ id, deleted: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
