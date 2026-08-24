// Builds the pinned "system store" that backs the app's own metadata. The user
// picks the family (SQL-like vs NoSQL) on first run; the datasets are shaped to
// match the chosen driver's data model but always render in the grid.

import type { Column, Connection, DriverId, TableKind } from './types'
import { driverMeta } from './drivers'
import {
  SYSTEM_DB_NAME,
  DEFAULT_DB_HOST,
  DEFAULT_DB_PORT,
  DEFAULT_DB_USER,
  DEFAULT_DB_NAME,
} from './env'

export const SYSTEM_CONNECTION_ID = 'conn-system'

function c(
  name: string,
  type: string,
  opts: Partial<{ pk: boolean; nullable: boolean }> = {},
): Column {
  return { name, type, nullable: opts.nullable ?? false, isPrimaryKey: opts.pk }
}

/** Column sets per dataset, chosen by data-model family. */
function datasets(driver: DriverId): {
  name: string
  kind: TableKind
  rowCount: number
  columns: Column[]
}[] {
  const { category, vocab } = driverMeta(driver)
  const kind: TableKind =
    category === 'document'
      ? 'collection'
      : category === 'keyvalue' || category === 'widecolumn'
        ? 'keyspace'
        : 'table'

  if (category === 'document') {
    return [
      {
        name: 'users',
        kind,
        rowCount: 8,
        columns: [
          c('_id', 'objectId', { pk: true }),
          c('name', 'string'),
          c('email', 'string'),
          c('role', 'string'),
          c('customRoleId', 'string'),
        ],
      },
      {
        name: 'roles',
        kind,
        rowCount: 3,
        columns: [
          c('_id', 'objectId', { pk: true }),
          c('name', 'string'),
          c('description', 'string'),
          c('permissions', 'array<string>'),
          c('color', 'string'),
        ],
      },
      {
        name: 'connections',
        kind,
        rowCount: 24,
        columns: [
          c('_id', 'objectId', { pk: true }),
          c('name', 'string'),
          c('driver', 'string'),
          c('credentials', 'document'),
          c('grants', 'array<document>'),
          c('metadata', 'map'),
        ],
      },
      {
        name: 'audit_log',
        kind,
        rowCount: 640,
        columns: [
          c('_id', 'objectId', { pk: true }),
          c('action', 'string'),
          c('user', 'document'),
          c('at', 'timestamp'),
        ],
      },
    ]
  }

  if (category === 'keyvalue') {
    return [
      {
        name: 'keyspace',
        kind,
        rowCount: 128,
        columns: [
          c('key', 'string', { pk: true }),
          c('type', 'string'),
          c('value', 'json'),
          c('ttl_seconds', 'integer', { nullable: true }),
        ],
      },
    ]
  }

  if (category === 'widecolumn') {
    return [
      {
        name: 'connections',
        kind,
        rowCount: 24,
        columns: [
          c('partition_key', 'text', { pk: true }),
          c('name', 'text'),
          c('driver', 'text'),
          c('attributes', 'map'),
        ],
      },
      {
        name: 'audit_log',
        kind,
        rowCount: 640,
        columns: [
          c('partition_key', 'text', { pk: true }),
          c('action', 'text'),
          c('actor', 'text'),
          c('at', 'timestamp'),
        ],
      },
    ]
  }

  // SQL family
  return [
    {
      name: 'users',
      kind,
      rowCount: 8,
      columns: [
        c('id', 'bigint', { pk: true }),
        c('name', 'varchar(120)'),
        c('email', 'varchar(255)'),
        c('role', 'varchar(24)'),
        c('custom_role_id', 'varchar(48)', { nullable: true }),
        c('created_at', 'timestamptz'),
      ],
    },
    {
      name: 'roles',
      kind,
      rowCount: 3,
      columns: [
        c('id', 'bigint', { pk: true }),
        c('name', 'varchar(80)'),
        c('description', 'text'),
        c('permissions', 'jsonb'),
        c('color', 'varchar(48)'),
      ],
    },
    {
      name: 'connections',
      kind,
      rowCount: 24,
      columns: [
        c('id', 'bigint', { pk: true }),
        c('name', 'varchar(120)'),
        c('driver', 'varchar(24)'),
        c('scope', 'varchar(12)'),
        c('owner_id', 'varchar(48)'),
        c('encrypted', 'boolean'),
      ],
    },
    {
      name: 'audit_log',
      kind,
      rowCount: 640,
      columns: [
        c('id', 'bigint', { pk: true }),
        c('action', 'varchar(80)'),
        c('actor', 'varchar(120)'),
        c('status', 'varchar(16)'),
        c('at', 'timestamptz'),
      ],
    },
    {
      name: 'query_history',
      kind,
      rowCount: 1280,
      columns: [
        c('id', 'bigint', { pk: true }),
        c('statement_type', 'varchar(16)'),
        c('duration_ms', 'integer'),
        c('at', 'timestamptz'),
      ],
    },
  ]
}

/** Construct the system-store connection for the chosen driver. */
export function buildSystemConnection(
  driver: DriverId,
  ownerId: string,
): Connection {
  const meta = driverMeta(driver)
  const schemaName = meta.vocab.container
  const schemaId = `${SYSTEM_CONNECTION_ID}.${schemaName}`
  return {
    id: SYSTEM_CONNECTION_ID,
    name: `System Store — ${meta.label}`,
    driver,
    host: DEFAULT_DB_HOST || 'internal://datalook-system',
    port: DEFAULT_DB_PORT || meta.defaultPort,
    database: DEFAULT_DB_NAME || SYSTEM_DB_NAME,
    username: DEFAULT_DB_USER,
    status: 'connected',
    readOnly: false,
    accent: meta.accent,
    version: `${meta.label} (system)`,
    uptimeHours: 1,
    scope: 'shared',
    ownerId,
    grants: [],
    encrypted: true,
    isSystem: true,
    schemas: [
      {
        id: schemaId,
        name: schemaName,
        procedures: [],
        tables: datasets(driver).map((d) => ({
          id: `${schemaId}.${d.name}`,
          name: d.name,
          kind: d.kind,
          rowCount: d.rowCount,
          columns: d.columns,
        })),
      },
    ],
  }
}
