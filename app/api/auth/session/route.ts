import { NextRequest, NextResponse } from 'next/server'
import { getUserById } from '@/lib/db/system-db'
import { getSessionFromRequest } from '@/lib/auth/session'

/** GET — resolve the current session cookie to a live user record. */
export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  try {
    const user = await getUserById(session.uid)
    if (!user) return NextResponse.json({ user: null }, { status: 401 })
    return NextResponse.json({ user })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
