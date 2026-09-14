import { NextRequest, NextResponse } from 'next/server'
import { listUsers, createUser, appendAuditLog } from '@/lib/db/system-db'
import { hashPassword } from '@/lib/auth/password'
import { getSessionFromRequest } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import type { Role } from '@/lib/types'

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const users = await listUsers()
    return NextResponse.json({ users })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!can(session.role as Role, 'users.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const { name, email, role, password, customRoleId } = body
    if (!name || !email || !role) {
      return NextResponse.json({ error: 'name, email, and role are required' }, { status: 400 })
    }
    const user = await createUser({
      name,
      email,
      role,
      customRoleId,
      passwordHash: password ? hashPassword(password) : undefined,
    })
    await appendAuditLog({
      action: 'Create user',
      actor: session.email,
      role: session.role as Role,
      target: user.email,
      status: 'allowed',
    })
    return NextResponse.json({ user })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
