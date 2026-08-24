// Central place for environment-driven configuration. All values are read
// from NEXT_PUBLIC_* variables so they're available in both server and
// client bundles — nothing here is a secret (this app has no real backend;
// see components/providers/auth-provider.tsx for the demo auth limitations).

import { DRIVERS } from './drivers'
import type { DriverId } from './types'

export type AppEnv = 'development' | 'production'

function isDriverId(value: string | undefined): value is DriverId {
  return !!value && value in DRIVERS
}

/** "production" hides demo/mock data & quick-login shortcuts; anything else behaves as a demo. */
export const APP_ENV: AppEnv =
  process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'production' : 'development'

export const isProduction = APP_ENV === 'production'

/** Driver used to initialize the system store on first run in production. */
export const DEFAULT_DB_DRIVER: DriverId = isDriverId(
  process.env.NEXT_PUBLIC_DEFAULT_DB_DRIVER,
)
  ? (process.env.NEXT_PUBLIC_DEFAULT_DB_DRIVER as DriverId)
  : 'postgres'

export const DEFAULT_ADMIN_NAME =
  process.env.NEXT_PUBLIC_DEFAULT_ADMIN_NAME?.trim() || 'Admin'

export const DEFAULT_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL?.trim() || 'admin@yourcompany.com'

/**
 * Demo-only password accepted at login. There is no backend in this app, so
 * this is NOT a real security boundary — swap the auth provider for a real
 * identity system before using NEXT_PUBLIC_APP_ENV=production for anything
 * that matters.
 */
export const DEFAULT_ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD?.trim() || 'datalook'

/**
 * Optional base64-encoded 256-bit AES key for encrypting connection credentials
 * at rest. When supplied via the environment, the app will import this key
 * instead of generating a random one, allowing the same key to be shared across
 * deployments. If omitted, a key is generated and stored in IndexedDB per-browser.
 */
export const AES_KEY_B64 = process.env.NEXT_PUBLIC_AES_KEY?.trim() || ''

/** Name of the system database created on first run in production. */
export const SYSTEM_DB_NAME =
  process.env.NEXT_PUBLIC_SYSTEM_DB_NAME?.trim() || 'datalook-studio'
