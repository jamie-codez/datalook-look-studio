import { NextRequest, NextResponse } from 'next/server'
import { appendAuditLog } from '@/lib/db/system-db'
import { getSessionFromRequest, SESSION_COOKIE } from '@/lib/auth/session'
import type { Role } from '@/lib/types'

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  if (session) {
    try {
      await appendAuditLog({
        action: 'Sign out',
        actor: session.email,
        role: session.role as Role,
        target: session.email,
        status: 'allowed',
      })
    } catch {
      // Best-effort — don't block logout on audit log failure.
    }
  }
  return res
}
