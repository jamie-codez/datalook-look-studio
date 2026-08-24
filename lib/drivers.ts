import type { DriverCategory, DriverId } from './types'

export interface DriverMeta {
  id: DriverId
  /** display name shown in menus and badges */
  label: string
  /** compact name for the connection tree badge */
  short: string
  category: DriverCategory
  /** default TCP port pre-filled in the connection form (0 = file/embedded) */
  defaultPort: number
  /** design-token color used to tint the connection dot */
  accent: string
  /** one-line description shown in the driver picker */
  blurb: string
  /** whether this driver can back the app's own system store */
  systemCapable: boolean
  /** vocabulary used when describing this store's structure in the UI */
  vocab: {
    /** top-level grouping (e.g. schema, database, keyspace) */
    container: string
    /** row-collection unit (e.g. table, collection, key-space) */
    dataset: string
  }
}

const SQL_VOCAB = { container: 'schema', dataset: 'table' } as const
const DOC_VOCAB = { container: 'database', dataset: 'collection' } as const
const KV_VOCAB = { container: 'namespace', dataset: 'keyspace' } as const
const WIDE_VOCAB = { container: 'keyspace', dataset: 'table' } as const

export const DRIVERS: Record<DriverId, DriverMeta> = {
  postgres: {
    id: 'postgres',
    label: 'PostgreSQL',
    short: 'PG',
    category: 'sql',
    defaultPort: 5432,
    accent: 'var(--chart-1)',
    blurb: 'Relational SQL database with rich types and JSONB.',
    systemCapable: true,
    vocab: SQL_VOCAB,
  },
  mysql: {
    id: 'mysql',
    label: 'MySQL',
    short: 'My',
    category: 'sql',
    defaultPort: 3306,
    accent: 'var(--chart-3)',
    blurb: 'Popular open-source relational SQL database.',
    systemCapable: true,
    vocab: SQL_VOCAB,
  },
  sqlite: {
    id: 'sqlite',
    label: 'SQLite',
    short: 'SL',
    category: 'sql',
    defaultPort: 0,
    accent: 'var(--chart-4)',
    blurb: 'Embedded, file-based relational SQL engine.',
    systemCapable: true,
    vocab: SQL_VOCAB,
  },
  clickhouse: {
    id: 'clickhouse',
    label: 'ClickHouse',
    short: 'CH',
    category: 'sql',
    defaultPort: 8123,
    accent: 'var(--chart-2)',
    blurb: 'Columnar SQL warehouse for analytics at scale.',
    systemCapable: false,
    vocab: SQL_VOCAB,
  },
  cockroach: {
    id: 'cockroach',
    label: 'CockroachDB',
    short: 'CR',
    category: 'sql',
    defaultPort: 26257,
    accent: 'var(--chart-1)',
    blurb: 'Distributed SQL, Postgres-wire compatible.',
    systemCapable: true,
    vocab: SQL_VOCAB,
  },
  mssql: {
    id: 'mssql',
    label: 'SQL Server',
    short: 'MS',
    category: 'sql',
    defaultPort: 1433,
    accent: 'var(--chart-5)',
    blurb: "Microsoft's T-SQL relational database.",
    systemCapable: true,
    vocab: SQL_VOCAB,
  },
  mongodb: {
    id: 'mongodb',
    label: 'MongoDB',
    short: 'MG',
    category: 'document',
    defaultPort: 27017,
    accent: 'var(--chart-2)',
    blurb: 'Document store of nested JSON collections.',
    systemCapable: true,
    vocab: DOC_VOCAB,
  },
  couchdb: {
    id: 'couchdb',
    label: 'CouchDB',
    short: 'CDB',
    category: 'document',
    defaultPort: 5984,
    accent: 'var(--chart-3)',
    blurb: 'JSON document database with HTTP access.',
    systemCapable: true,
    vocab: DOC_VOCAB,
  },
  redis: {
    id: 'redis',
    label: 'Redis',
    short: 'RD',
    category: 'keyvalue',
    defaultPort: 6379,
    accent: 'var(--chart-5)',
    blurb: 'In-memory key-value store and data structures.',
    systemCapable: true,
    vocab: KV_VOCAB,
  },
  cassandra: {
    id: 'cassandra',
    label: 'Cassandra',
    short: 'CS',
    category: 'widecolumn',
    defaultPort: 9042,
    accent: 'var(--chart-4)',
    blurb: 'Wide-column distributed store with keyspaces.',
    systemCapable: false,
    vocab: WIDE_VOCAB,
  },
  dynamodb: {
    id: 'dynamodb',
    label: 'DynamoDB',
    short: 'DDB',
    category: 'widecolumn',
    defaultPort: 8000,
    accent: 'var(--chart-1)',
    blurb: 'Serverless key-value and wide-column store.',
    systemCapable: true,
    vocab: WIDE_VOCAB,
  },
}

export const DRIVER_LIST: DriverMeta[] = Object.values(DRIVERS)

export const CATEGORY_LABEL: Record<DriverCategory, string> = {
  sql: 'SQL',
  document: 'Document',
  keyvalue: 'Key-value',
  widecolumn: 'Wide-column',
}

export const CATEGORY_ORDER: DriverCategory[] = [
  'sql',
  'document',
  'keyvalue',
  'widecolumn',
]

export function driverMeta(id: DriverId): DriverMeta {
  return DRIVERS[id]
}

export function driverLabel(id: DriverId): string {
  return DRIVERS[id]?.label ?? id
}

export function driverAccent(id: DriverId): string {
  return DRIVERS[id]?.accent ?? 'var(--muted-foreground)'
}

export function isNoSql(id: DriverId): boolean {
  return DRIVERS[id]?.category !== 'sql'
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Title-cased label for the top-level container ("Schema", "Database", …). */
export function containerLabel(id: DriverId): string {
  return titleCase(driverMeta(id).vocab.container)
}

/** Pluralised, title-cased label for the row-collection unit ("Collections"). */
export function entityPlural(id: DriverId): string {
  const d = driverMeta(id).vocab.dataset
  return titleCase(d.endsWith('s') ? d : `${d}s`)
}

/** Drivers grouped by category, in display order. */
export function driversByCategory(): { category: DriverCategory; drivers: DriverMeta[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    drivers: DRIVER_LIST.filter((d) => d.category === category),
  })).filter((g) => g.drivers.length > 0)
}
