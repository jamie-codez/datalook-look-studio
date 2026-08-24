// Encryption-at-rest for connection credentials.
//
// A single AES-GCM 256-bit key is generated with the Web Crypto API and stored
// in IndexedDB as a NON-EXTRACTABLE CryptoKey. Because the key is
// non-extractable, its raw bytes can never be read back out (not even by our
// own code), yet the browser can still use it to encrypt/decrypt in-session.
// Credential ciphertext therefore stays unreadable at rest without this key.

import { META_STORE, idbGet, idbPut } from './idb'
import { AES_KEY_B64 } from './env'

const KEY_ID = 'master-key'
const ENV_KEY_ID = 'env-master-key'

let keyPromise: Promise<CryptoKey | null> | null = null

function hasSubtle(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.generateKey === 'function'
  )
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Load the persisted master key, generating and storing one on first use. */
export function getMasterKey(): Promise<CryptoKey | null> {
  if (keyPromise) return keyPromise
  keyPromise = (async () => {
    if (!hasSubtle()) return null

    // If an env-supplied key exists, import it (extractable for re-export if needed).
    if (AES_KEY_B64) {
      const envKey = await idbGet<CryptoKey>(META_STORE, ENV_KEY_ID)
      if (envKey) return envKey
      try {
        const raw = fromBase64(AES_KEY_B64)
        const key = await crypto.subtle.importKey(
          'raw',
          raw,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        )
        await idbPut(META_STORE, key, ENV_KEY_ID)
        return key
      } catch {
        // Invalid key format — fall through to generated key
      }
    }

    const existing = await idbGet<CryptoKey>(META_STORE, KEY_ID)
    if (existing) return existing
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      // extractable = false → raw key material is never exposed
      false,
      ['encrypt', 'decrypt'],
    )
    await idbPut(META_STORE, key, KEY_ID)
    return key
  })()
  return keyPromise
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/**
 * Encrypt an arbitrary JSON-serialisable value. Returns an opaque
 * `iv.ciphertext` base64 token, or a reversible marker when Web Crypto is
 * unavailable (SSR / very old browsers) so the app still functions.
 */
export async function encryptJson(value: unknown): Promise<string> {
  const key = await getMasterKey()
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  if (!key) return `plain:${toBase64(plaintext)}`
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  )
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`
}

/** Decrypt a token produced by {@link encryptJson}. */
export async function decryptJson<T = unknown>(token: string): Promise<T> {
  if (token.startsWith('plain:')) {
    const bytes = fromBase64(token.slice('plain:'.length))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  }
  const key = await getMasterKey()
  if (!key) throw new Error('Master key unavailable for decryption')
  const [ivB64, dataB64] = token.split('.')
  const iv = fromBase64(ivB64)
  const data = fromBase64(dataB64)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

/** True when real (non-fallback) encryption is active in this environment. */
export function encryptionAvailable(): boolean {
  return hasSubtle()
}
