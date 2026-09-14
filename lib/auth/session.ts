import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

/**
 * Signed, stateless session cookie for the real (Postgres-backed) auth path.
 * Not a JWT (no external dependency) — just base64url(json).hex(hmac-sha256).
 */

export const SESSION_COOKIE = 'dl_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface SessionPayload {
  uid: string
  email: string
  role: string
  exp: number
}

function getSecret(): Buffer {
  const configured = process.env.SESSION_SECRET || process.env.CONN_ENCRYPTION_KEY
  if (configured) return createHash('sha256').update(configured).digest()
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[auth/session] SESSION_SECRET is not set — falling back to an insecure default. ' +
        'Set SESSION_SECRET in production so sessions cannot be forged.',
    )
  }
  return createHash('sha256').update('datalook-studio-default-session-secret').digest()
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('hex')
}

export function createSessionToken(user: { id: string; email: string; role: string }): string {
  const payload: SessionPayload = {
    uid: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  }
  const json = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${json}.${sign(json)}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const [json, sig] = token.split('.')
  if (!json || !sig) return null
  const expected = sign(json)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
}

export const SESSION_COOKIE_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000)
