import { NextRequest, NextResponse } from 'next/server'
import { getConnectedAdapter, sweepConnections } from '@/lib/db/adapter-factory'
import { saveServerConnection } from '@/lib/db/server-store'
import type { ConnectionConfig } from '@/lib/db/types'
import { DBError } from '@/lib/db/types'
import type { DriverId } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
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
      ownerId,
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

    // Test the connection first
    const adapter = await getConnectedAdapter(config)
    const alive = await adapter.testConnection()
    if (!alive) {
      return NextResponse.json(
        { error: 'Connection test failed — verify host, port, and credentials' },
        { status: 502 },
      )
    }

    // Persist with encrypted credentials
    saveServerConnection({
      ...config,
      name,
      readOnly,
      scope,
      ownerId,
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
