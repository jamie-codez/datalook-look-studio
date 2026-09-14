import { NextRequest, NextResponse } from 'next/server'
import { updateRole, deleteRole, appendAuditLog } from '@/lib/db/system-db'
import { getSessionFromRequest } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import type { Role } from '@/lib/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!can(session.role as Role, 'users.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  try {
    const body = await request.json()
    const role = await updateRole(id, body)
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    await appendAuditLog({
      action: 'Update role',
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!can(session.role as Role, 'users.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  try {
    await deleteRole(id)
    await appendAuditLog({
      action: 'Remove role',
      actor: session.email,
      role: session.role as Role,
      target: id,
      status: 'allowed',
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
