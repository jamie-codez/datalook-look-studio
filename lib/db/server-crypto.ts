import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

/**
 * Server-side AES-256-GCM encryption/decryption for connection credentials.
 * Uses CONN_ENCRYPTION_KEY from environment (32-byte hex or base64 string).
 *
 * This is separate from the client-side Web Crypto encryption (lib/crypto.ts)
 * which uses IndexedDB-stored keys. Route Handlers need server-side decryption
 * to access credentials for database connections.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getMasterKey(): Buffer {
  const envKey = process.env.NEXT_PUBLIC_AES_KEY || process.env.CONN_ENCRYPTION_KEY
  if (!envKey) {
    // Derive a deterministic key from the env value by hashing to 32 bytes
    return createHash('sha256').update('default-key-change-me').digest()
  }
  // If the key is hex or base64, decode it; otherwise hash it to 32 bytes
  if (/^[0-9a-f]{64}$/i.test(envKey)) {
    return Buffer.from(envKey, 'hex')
  }
  try {
    const decoded = Buffer.from(envKey, 'base64')
    if (decoded.length === 32) return decoded
  } catch {
    // not base64
  }
  return createHash('sha256').update(envKey).digest()
}

/** Encrypt a JSON-serializable value. Returns `iv.ciphertext.authTag` in base64. */
export function encryptServer(value: unknown): string {
  const key = getMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), ciphertext.toString('base64'), authTag.toString('base64')].join('.')
}

/** Decrypt a token produced by encryptServer. */
export function decryptServer<T = unknown>(token: string): T {
  const [ivB64, dataB64, tagB64] = token.split('.')
  if (!ivB64 || !dataB64 || !tagB64) throw new Error('Invalid encrypted token format')
  const key = getMasterKey()
  const iv = Buffer.from(ivB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plain = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(plain.toString('utf8')) as T
}

/** Decrypt a token produced by the client-side encryptJson (iv.ciphertext format, Web Crypto). */
export function decryptClientToken<T = unknown>(token: string): T {
  if (token.startsWith('plain:')) {
    const b64 = token.slice('plain:'.length)
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as T
  }
  // Client-side format: iv.ciphertext (no authTag — Web Crypto GCM includes it in ciphertext)
  const [ivB64, dataB64] = token.split('.')
  if (!ivB64 || !dataB64) throw new Error('Invalid client token format')
  const key = getMasterKey()
  const iv = Buffer.from(ivB64, 'base64')
  // Web Crypto AES-GCM appends the 16-byte auth tag to the ciphertext
  const data = Buffer.from(dataB64, 'base64')
  const authTag = data.subarray(data.length - 16)
  const ciphertext = data.subarray(0, data.length - 16)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plain.toString('utf8')) as T
}

export interface ServerCredentials {
  host: string
  port: number
  database: string
  username: string
  password: string
}

/** Decrypt connection credentials from a stored connection's enc field. */
export function decryptCredentials(encToken: string): ServerCredentials {
  // Try server-side format (3 parts) first, then client-side format (2 parts)
  const parts = encToken.split('.')
  if (parts.length >= 3) {
    return decryptServer<ServerCredentials>(encToken)
  }
  return decryptClientToken<ServerCredentials>(encToken)
}
