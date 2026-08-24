import type { DBAdapter, ConnectionConfig } from './types'
import type { DriverId } from '@/lib/types'

// Module-level singleton cache guarded against dev-mode hot-reload duplication.
declare global {
  // eslint-disable-next-line no-var
  var __connCache:
    | Map<string, { adapter: DBAdapter; lastUsed: number; config: ConnectionConfig }>
    | undefined
}

const cache = globalThis.__connCache ?? (globalThis.__connCache = new Map())

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/** Get or create an adapter for the given connection id. */
export async function getAdapter(
  connId: string,
  factory: () => Promise<DBAdapter>,
): Promise<DBAdapter> {
  const hit = cache.get(connId)
  if (hit) {
    hit.lastUsed = Date.now()
    return hit.adapter
  }
  const adapter = await factory()
  cache.set(connId, { adapter, lastUsed: Date.now(), config: {} as ConnectionConfig })
  return adapter
}

/** Store the config alongside a cached adapter (called after connect). */
export function setAdapterConfig(connId: string, config: ConnectionConfig): void {
  const entry = cache.get(connId)
  if (entry) {
    entry.config = config
  }
}

/** Get the cached config for a connection (for re-connect if needed). */
export function getAdapterConfig(connId: string): ConnectionConfig | undefined {
  return cache.get(connId)?.config
}

/** Remove and disconnect a cached adapter. */
export async function evictAdapter(connId: string): Promise<void> {
  const entry = cache.get(connId)
  if (!entry) return
  try {
    await entry.adapter.disconnect()
  } catch {
    // ignore disconnect errors during eviction
  }
  cache.delete(connId)
}

/** Evict all adapters that have been idle for longer than IDLE_TIMEOUT_MS. */
export async function sweepIdleConnections(): Promise<void> {
  const now = Date.now()
  for (const [id, entry] of cache.entries()) {
    if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
      await evictAdapter(id)
    }
  }
}

/** Check if a cached adapter is still alive via testConnection(). */
export async function isAdapterAlive(connId: string): Promise<boolean> {
  const entry = cache.get(connId)
  if (!entry) return false
  try {
    return await entry.adapter.testConnection()
  } catch {
    await evictAdapter(connId)
    return false
  }
}

/** Get the list of currently cached connection ids. */
export function getCachedConnectionIds(): string[] {
  return Array.from(cache.keys())
}
