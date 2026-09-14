import { NextRequest, NextResponse } from 'next/server'
import { getConnectedAdapter } from '@/lib/db/adapter-factory'
import { loadServerConnection } from '@/lib/db/server-store'
import { DBError } from '@/lib/db/types'
import { SYSTEM_CONNECTION_ID } from '@/lib/system-store'
import { getSessionFromRequest } from '@/lib/auth/session'

/** GET — live server metrics for a connection, when its driver can report any. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const config = loadServerConnection(id)
    if (!config) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }
    // Same posture as the rows route: the system store holds real identity
    // data, so reading even its metrics requires a live session.
    if (id === SYSTEM_CONNECTION_ID && !getSessionFromRequest(request)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const adapter = await getConnectedAdapter(config)
    if (!adapter.getServerMetrics) {
      return NextResponse.json({
        metrics: { unavailableReason: 'No live metrics support for this driver yet.' },
      })
    }
    const metrics = await adapter.getServerMetrics()
    return NextResponse.json({ metrics })
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
