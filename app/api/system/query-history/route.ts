import { NextRequest, NextResponse } from 'next/server'
import { listQueryHistory, appendQueryHistory } from '@/lib/db/system-db'
import { getSessionFromRequest } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const entries = await listQueryHistory()
    return NextResponse.json({ entries })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const { sql, durationMs, status, connectionName, rowCount, statementType } = await request.json()
    if (typeof sql !== 'string') {
      return NextResponse.json({ error: 'sql is required' }, { status: 400 })
    }
    await appendQueryHistory({
      sql,
      durationMs: Number(durationMs) || 0,
      status: typeof status === 'string' ? status : 'success',
      connectionName: typeof connectionName === 'string' ? connectionName : '',
      rowCount: Number(rowCount) || 0,
      statementType: typeof statementType === 'string' ? statementType : 'UNKNOWN',
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
