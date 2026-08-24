import { NextRequest, NextResponse } from 'next/server'
import { getConnectedAdapter } from '@/lib/db/adapter-factory'
import { loadServerConnection } from '@/lib/db/server-store'
import { DBError } from '@/lib/db/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const config = loadServerConnection(id)
    if (!config) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const body = await request.json()
    const query = body.query ?? body.sql ?? body.statement
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing "query" field' }, { status: 400 })
    }

    const adapter = await getConnectedAdapter(config)
    const result = await adapter.query(query)

    return NextResponse.json(result)
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
