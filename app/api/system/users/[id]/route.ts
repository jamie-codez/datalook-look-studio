import { NextRequest, NextResponse } from 'next/server'
import { updateUser, deleteUser, appendAuditLog } from '@/lib/db/system-db'
import { hashPassword } from '@/lib/auth/password'
import { getSessionFromRequest } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import type { Role } from '@/lib/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  const isSelf = session.uid === id
  const isManager = can(session.role as Role, 'users.manage')
  if (!isSelf && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, email, role, password, customRoleId } = body

    // Only a user manager may change role/custom role assignment.
    if ((role !== undefined || customRoleId !== undefined) && !isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await updateUser(id, {
      name,
      email,
      role,
      customRoleId,
      passwordHash: password ? hashPassword(password) : undefined,
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await appendAuditLog({
      action: isSelf ? 'Update profile' : 'Update user',
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
    await deleteUser(id)
    await appendAuditLog({
      action: 'Remove user',
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
