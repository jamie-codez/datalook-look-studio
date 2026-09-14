import { NextRequest, NextResponse } from 'next/server'
import { listRoles, createRole, appendAuditLog } from '@/lib/db/system-db'
import { getSessionFromRequest } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import type { Role } from '@/lib/types'

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const roles = await listRoles()
    return NextResponse.json({ roles })
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
    const { name, description, permissions, color } = body
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const role = await createRole({
      name,
      description: description ?? '',
      permissions: permissions ?? [],
      color: color ?? 'var(--chart-1)',
    })
    await appendAuditLog({
      action: 'Create role',
      actor: session.email,
      role: session.role as Role,
      target: role.name,
      status: 'allowed',
    })
    return NextResponse.json({ role })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
