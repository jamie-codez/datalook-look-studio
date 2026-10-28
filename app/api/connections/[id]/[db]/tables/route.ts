import { NextRequest, NextResponse } from 'next/server'
import { forDatabase, getConnectedAdapter } from '@/lib/db/adapter-factory'
import { loadServerConnection } from '@/lib/db/server-store'
import { guardConnection } from '@/lib/db/access'
import { DBError } from '@/lib/db/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; db: string }> },
) {
  try {
    const { id, db } = await params
    const schema = request.nextUrl.searchParams.get('schema') || undefined
    const denied = await guardConnection(request, id, 'viewer')
    if (denied) return denied
    const config = await loadServerConnection(id)
    if (!config) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const target = forDatabase(config, decodeURIComponent(db))

    const adapter = await getConnectedAdapter(target)
    const tables = await adapter.listTablesOrCollections(decodeURIComponent(db), schema)

    return NextResponse.json({ tables })
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
