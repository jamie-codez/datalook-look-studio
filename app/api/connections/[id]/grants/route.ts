import { NextRequest, NextResponse } from 'next/server'
import { setServerConnectionGrants, type ServerConnectionRecord } from '@/lib/db/server-store'
import { guardConnection } from '@/lib/db/access'
import type { ConnectionAccessRole } from '@/lib/db/system-db'

const ROLES: ConnectionAccessRole[] = ['viewer', 'editor', 'manager', 'admin']

/** PUT — replace the access grants on a shared connection. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const denied = await guardConnection(request, id, 'admin')
    if (denied) return denied

    const body = await request.json()
    const grants: ServerConnectionRecord['grants'] = Array.isArray(body.grants) ? body.grants : []
    for (const g of grants) {
      if (!g || typeof g.userId !== 'string' || !ROLES.includes(g.role)) {
        return NextResponse.json({ error: 'Each grant needs a userId and a valid role' }, { status: 400 })
      }
    }

    await setServerConnectionGrants(id, grants)
    return NextResponse.json({ id, grants })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
