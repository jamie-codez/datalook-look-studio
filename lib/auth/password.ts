import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Password hashing for the real (Postgres-backed) auth path.
 * Uses Node's built-in scrypt (no native dependency) rather than bcrypt.
 * Stored format: "scrypt:<saltHex>:<hashHex>".
 */

const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LENGTH)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, saltHex, hashHex] = parts
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(password, salt, expected.length)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
