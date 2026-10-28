import type { DBAdapter, ConnectionConfig } from './types'
import type { DriverId } from '@/lib/types'
import { PostgresAdapter } from './adapters/postgres'
import { MysqlAdapter } from './adapters/mysql'
import { CockroachAdapter } from './adapters/cockroach'
import { ClickHouseAdapter } from './adapters/clickhouse'
import { SqliteAdapter } from './adapters/sqlite'
import { MongoAdapter } from './adapters/mongodb'
import { CouchDBAdapter } from './adapters/couchdb'
import { DynamoDBAdapter } from './adapters/dynamodb'
import { CassandraAdapter } from './adapters/cassandra'
import { RedisAdapter } from './adapters/redis'
import { MssqlAdapter } from './adapters/mssql'
import { getAdapter, setAdapterConfig, isAdapterAlive, evictAdapter, sweepIdleConnections } from './connection-manager'

const ADAPTER_FACTORIES: Record<DriverId, () => DBAdapter> = {
  postgres: () => new PostgresAdapter(),
  mysql: () => new MysqlAdapter(),
  cockroach: () => new CockroachAdapter(),
  clickhouse: () => new ClickHouseAdapter(),
  sqlite: () => new SqliteAdapter(),
  mssql: () => new MssqlAdapter(),
  mongodb: () => new MongoAdapter(),
  couchdb: () => new CouchDBAdapter(),
  redis: () => new RedisAdapter(),
  cassandra: () => new CassandraAdapter(),
  dynamodb: () => new DynamoDBAdapter(),
}

/**
 * The same server, pointed at another database. Each database gets its own
 * cache entry (the id is suffixed), so browsing two databases on one server
 * never shares a connection that is bound to the wrong one.
 */
export function forDatabase(config: ConnectionConfig, database?: string): ConnectionConfig {
  if (!database || database === config.database) return config
  return { ...config, id: `${config.id}@${database}`, database }
}

/**
 * Get a connected adapter for the given connection config.
 * Uses the singleton cache, re-connecting if the cached adapter is stale.
 */
export async function getConnectedAdapter(config: ConnectionConfig): Promise<DBAdapter> {
  const alive = await isAdapterAlive(config.id)
  if (alive) {
    return getAdapter(config.id, async () => {
      const adapter = ADAPTER_FACTORIES[config.driver]()
      await adapter.connect(config)
      return adapter
    })
  }

  // Either not cached or stale — evict and create fresh
  await evictAdapter(config.id)

  const adapter = await getAdapter(config.id, async () => {
    const a = ADAPTER_FACTORIES[config.driver]()
    await a.connect(config)
    return a
  })
  setAdapterConfig(config.id, config)
  return adapter
}

/** Run a sweep of idle connections. Call periodically (e.g. on each API request). */
export async function sweepConnections(): Promise<void> {
  await sweepIdleConnections()
}
