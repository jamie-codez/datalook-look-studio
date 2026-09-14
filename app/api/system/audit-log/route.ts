import { NextRequest, NextResponse } from 'next/server'
import { listAuditLog, appendAuditLog } from '@/lib/db/system-db'
import { getSessionFromRequest } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import type { Role } from '@/lib/types'

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!can(session.role as Role, 'audit.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const entries = await listAuditLog()
    return NextResponse.json({ entries })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

/**
 * POST — append an entry for an in-app action (query run, connection
 * created, transaction committed, etc). Actor/role come from the session,
 * never from the request body, so a client can't forge who did what.
 */
export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const { action, target, status } = await request.json()
    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }
    await appendAuditLog({
      action,
      actor: session.email,
      role: session.role as Role,
      target: typeof target === 'string' ? target : '',
      status: status === 'blocked' ? 'blocked' : 'allowed',
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
