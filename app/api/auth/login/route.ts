import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, appendAuditLog } from '@/lib/db/system-db'
import { verifyPassword } from '@/lib/auth/password'
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await findUserByEmail(String(email))
    if (!user || !user.passwordHash || !verifyPassword(String(password), user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = createSessionToken(user)
    await appendAuditLog({
      action: 'Sign in',
      actor: user.name,
      role: user.role,
      target: user.email,
      status: 'allowed',
    })

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, initials: user.initials, customRoleId: user.customRoleId },
    })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE,
    })
    return res
  } catch (err) {
    if (err instanceof Error && err.message.includes('System backend not configured')) {
      return NextResponse.json({ error: 'Real auth backend is not configured on this deployment' }, { status: 501 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
