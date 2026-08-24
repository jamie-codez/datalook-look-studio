import type { Connection, TableMeta, User } from './types'

export const MOCK_USERS: User[] = [
  { id: 'u-admin', name: 'Ada Okafor', email: 'ada@datalook.dev', role: 'Admin', initials: 'AO' },
  { id: 'u-editor', name: 'Ravi Menon', email: 'ravi@datalook.dev', role: 'Editor', initials: 'RM' },
  { id: 'u-viewer', name: 'Lena Fischer', email: 'lena@datalook.dev', role: 'Viewer', initials: 'LF' },
]

export const EXTRA_TEAM_USERS: User[] = [
  { id: 'u-4', name: 'Marcus Reyes', email: 'marcus@datalook.dev', role: 'Editor', initials: 'MR' },
  { id: 'u-5', name: 'Sofia Lindqvist', email: 'sofia@datalook.dev', role: 'Viewer', initials: 'SL' },
  { id: 'u-6', name: 'Tomoko Ito', email: 'tomoko@datalook.dev', role: 'Viewer', initials: 'TI' },
]

function col(
  name: string,
  type: string,
  opts: Partial<{ nullable: boolean; pk: boolean; fk: boolean; ref: string; def: string }> = {},
) {
  return {
    name,
    type,
    nullable: opts.nullable ?? false,
    isPrimaryKey: opts.pk,
    isForeignKey: opts.fk,
    references: opts.ref,
    defaultValue: opts.def,
  }
}

export const CONNECTIONS: Connection[] = [
  {
    id: 'conn-prod',
    name: 'Production — Postgres',
    driver: 'postgres',
    host: 'db.prod.datalook.internal',
    port: 5432,
    database: 'shopdb',
    username: 'app_readonly',
    status: 'connected',
    readOnly: false,
    accent: 'var(--chart-1)',
    version: 'PostgreSQL 16.2',
    uptimeHours: 3721,
    scope: 'shared',
    ownerId: 'u-admin',
    grants: [
      { userId: 'u-editor', role: 'editor' },
      { userId: 'u-viewer', role: 'viewer' },
      { userId: 'u-4', role: 'manager' },
    ],
    schemas: [
      {
        id: 'conn-prod.public',
        name: 'public',
        procedures: [
          { id: 'p-1', name: 'recalculate_totals', returns: 'void', language: 'plpgsql' },
          { id: 'p-2', name: 'active_customer_count', returns: 'integer', language: 'sql' },
        ],
        tables: [
          {
            id: 'conn-prod.public.customers',
            name: 'customers',
            kind: 'table',
            rowCount: 84213,
            columns: [
              col('id', 'bigint', { pk: true }),
              col('email', 'varchar(255)'),
              col('full_name', 'varchar(160)'),
              col('country', 'varchar(2)'),
              col('lifetime_value', 'numeric(12,2)', { def: '0' }),
              col('is_active', 'boolean', { def: 'true' }),
              col('created_at', 'timestamptz', { def: 'now()' }),
            ],
          },
          {
            id: 'conn-prod.public.orders',
            name: 'orders',
            kind: 'table',
            rowCount: 512900,
            columns: [
              col('id', 'bigint', { pk: true }),
              col('customer_id', 'bigint', { fk: true, ref: 'customers.id' }),
              col('status', 'varchar(24)', { def: "'pending'" }),
              col('total', 'numeric(12,2)'),
              col('currency', 'varchar(3)', { def: "'USD'" }),
              col('placed_at', 'timestamptz', { def: 'now()' }),
            ],
          },
          {
            id: 'conn-prod.public.products',
            name: 'products',
            kind: 'table',
            rowCount: 1892,
            columns: [
              col('id', 'bigint', { pk: true }),
              col('sku', 'varchar(48)'),
              col('name', 'varchar(200)'),
              col('price', 'numeric(10,2)'),
              col('stock', 'integer', { def: '0' }),
              col('category', 'varchar(64)', { nullable: true }),
            ],
          },
          {
            id: 'conn-prod.public.stores',
            name: 'stores',
            kind: 'table',
            rowCount: 42,
            columns: [
              col('id', 'bigint', { pk: true }),
              col('name', 'varchar(120)'),
              col('city', 'varchar(80)'),
              col('country', 'varchar(2)'),
              col('latitude', 'numeric(9,6)'),
              col('longitude', 'numeric(9,6)'),
              col('is_flagship', 'boolean', { def: 'false' }),
              col('opened_at', 'date'),
            ],
          },
          {
            id: 'conn-prod.public.warehouses',
            name: 'warehouses',
            kind: 'table',
            rowCount: 18,
            columns: [
              col('id', 'bigint', { pk: true }),
              col('code', 'varchar(12)'),
              col('city', 'varchar(80)'),
              col('location', 'varchar(48)'),
              col('capacity_units', 'integer'),
              col('active', 'boolean', { def: 'true' }),
            ],
          },
          {
            id: 'conn-prod.public.active_customers',
            name: 'active_customers',
            kind: 'view',
            rowCount: 61044,
            columns: [
              col('id', 'bigint'),
              col('email', 'varchar(255)'),
              col('lifetime_value', 'numeric(12,2)'),
            ],
          },
        ],
      },
      {
        id: 'conn-prod.analytics',
        name: 'analytics',
        procedures: [],
        tables: [
          {
            id: 'conn-prod.analytics.daily_revenue',
            name: 'daily_revenue',
            kind: 'table',
            rowCount: 1096,
            columns: [
              col('day', 'date', { pk: true }),
              col('revenue', 'numeric(14,2)'),
              col('orders', 'integer'),
              col('refunds', 'numeric(12,2)', { def: '0' }),
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'conn-staging',
    name: 'Staging — MySQL',
    driver: 'mysql',
    host: 'staging-mysql.datalook.internal',
    port: 3306,
    database: 'crm',
    username: 'dev',
    status: 'connected',
    readOnly: false,
    accent: 'var(--chart-3)',
    version: 'MySQL 8.0.36',
    uptimeHours: 214,
    scope: 'shared',
    ownerId: 'u-admin',
    grants: [
      { userId: 'u-editor', role: 'manager' },
      { userId: 'u-5', role: 'viewer' },
    ],
    schemas: [
      {
        id: 'conn-staging.crm',
        name: 'crm',
        procedures: [{ id: 'p-3', name: 'sync_leads', returns: 'int', language: 'sql' }],
        tables: [
          {
            id: 'conn-staging.crm.leads',
            name: 'leads',
            kind: 'table',
            rowCount: 12045,
            columns: [
              col('id', 'int', { pk: true }),
              col('company', 'varchar(160)'),
              col('owner', 'varchar(120)'),
              col('stage', 'varchar(40)', { def: "'new'" }),
              col('value', 'decimal(12,2)', { nullable: true }),
              col('created_at', 'datetime', { def: 'CURRENT_TIMESTAMP' }),
            ],
          },
          {
            id: 'conn-staging.crm.contacts',
            name: 'contacts',
            kind: 'table',
            rowCount: 33871,
            columns: [
              col('id', 'int', { pk: true }),
              col('lead_id', 'int', { fk: true, ref: 'leads.id' }),
              col('name', 'varchar(160)'),
              col('email', 'varchar(200)'),
              col('phone', 'varchar(40)', { nullable: true }),
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'conn-edge',
    name: 'Edge Cache — SQLite',
    driver: 'sqlite',
    host: 'file:/var/data/edge.db',
    port: 0,
    database: 'edge.db',
    username: 'local',
    status: 'disconnected',
    readOnly: true,
    accent: 'var(--chart-4)',
    version: 'SQLite 3.45',
    uptimeHours: 0,
    scope: 'shared',
    ownerId: 'u-admin',
    grants: [],
    schemas: [
      {
        id: 'conn-edge.main',
        name: 'main',
        procedures: [],
        tables: [
          {
            id: 'conn-edge.main.sessions',
            name: 'sessions',
            kind: 'table',
            rowCount: 4210,
            columns: [
              col('token', 'text', { pk: true }),
              col('user_id', 'integer'),
              col('expires_at', 'integer'),
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'conn-mongo',
    name: 'Events — MongoDB',
    driver: 'mongodb',
    host: 'mongo.prod.datalook.internal',
    port: 27017,
    database: 'events',
    username: 'analytics',
    status: 'connected',
    readOnly: false,
    accent: 'var(--chart-2)',
    version: 'MongoDB 7.0',
    uptimeHours: 980,
    scope: 'shared',
    ownerId: 'u-admin',
    grants: [
      { userId: 'u-editor', role: 'editor' },
      { userId: 'u-viewer', role: 'viewer' },
    ],
    schemas: [
      {
        id: 'conn-mongo.events',
        name: 'events',
        procedures: [],
        tables: [
          {
            id: 'conn-mongo.events.orders',
            name: 'orders',
            kind: 'collection',
            rowCount: 8400,
            columns: [
              col('_id', 'objectId', { pk: true }),
              col('status', 'string'),
              col('customer', 'document'),
              col('items', 'array<document>'),
              col('payment', 'document'),
              col('tags', 'array<string>'),
              col('placed_at', 'timestamp'),
            ],
          },
          {
            id: 'conn-mongo.events.sessions',
            name: 'sessions',
            kind: 'collection',
            rowCount: 51200,
            columns: [
              col('_id', 'objectId', { pk: true }),
              col('user', 'document'),
              col('events', 'array<document>'),
              col('metadata', 'map'),
              col('started_at', 'timestamp'),
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'conn-redis',
    name: 'Cache — Redis',
    driver: 'redis',
    host: 'redis.edge.datalook.internal',
    port: 6379,
    database: '0',
    username: 'default',
    status: 'connected',
    readOnly: true,
    accent: 'var(--chart-5)',
    version: 'Redis 7.2',
    uptimeHours: 1500,
    scope: 'shared',
    ownerId: 'u-admin',
    grants: [{ userId: 'u-editor', role: 'viewer' }],
    schemas: [
      {
        id: 'conn-redis.db0',
        name: 'db0',
        procedures: [],
        tables: [
          {
            id: 'conn-redis.db0.keyspace',
            name: 'keyspace',
            kind: 'keyspace',
            rowCount: 3200,
            columns: [
              col('key', 'string', { pk: true }),
              col('type', 'string'),
              col('value', 'json'),
              col('ttl_seconds', 'integer', { nullable: true }),
            ],
          },
        ],
      },
    ],
  },
  {
    // Personal connection — visible only to its owner (Ravi, a global Editor).
    id: 'conn-ravi-scratch',
    name: "Ravi's Scratch — SQLite",
    driver: 'sqlite',
    host: 'file:/home/ravi/scratch.db',
    port: 0,
    database: 'scratch.db',
    username: 'ravi',
    status: 'connected',
    readOnly: false,
    accent: 'var(--chart-2)',
    version: 'SQLite 3.45',
    uptimeHours: 12,
    scope: 'personal',
    ownerId: 'u-editor',
    grants: [],
    schemas: [
      {
        id: 'conn-ravi-scratch.main',
        name: 'main',
        procedures: [],
        tables: [
          {
            id: 'conn-ravi-scratch.main.experiments',
            name: 'experiments',
            kind: 'table',
            rowCount: 128,
            columns: [
              col('id', 'integer', { pk: true }),
              col('label', 'text'),
              col('score', 'real', { nullable: true }),
              col('created_at', 'integer'),
            ],
          },
        ],
      },
    ],
  },
]

// --- Deterministic sample row generation -----------------------------------

const FIRST = ['Ada', 'Ravi', 'Lena', 'Marcus', 'Sofia', 'Tomoko', 'Elena', 'Kwame', 'Yuki', 'Diego', 'Nadia', 'Owen']
const LAST = ['Okafor', 'Menon', 'Fischer', 'Reyes', 'Lindqvist', 'Ito', 'Volkov', 'Mensah', 'Tanaka', 'Silva', 'Haddad', 'Bright']
const COUNTRIES = ['US', 'GB', 'DE', 'JP', 'BR', 'IN', 'SE', 'CA', 'FR', 'NG']
const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'refunded', 'cancelled']
const STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
const CATEGORIES = ['Apparel', 'Electronics', 'Home', 'Books', 'Toys', 'Grocery']
const WORDS = ['Nimbus', 'Vertex', 'Orbit', 'Pulse', 'Quartz', 'Lumen', 'Atlas', 'Cobalt', 'Ember', 'Delta']
const STORE_KINDS = ['Flagship', 'Outlet', 'Downtown', 'Mall', 'Popup', 'Central']

// Real-world city anchors so generated coordinates land on actual places and
// keep city / country / lat / lng coherent within a single row.
const GEO_CITIES: { city: string; country: string; lat: number; lng: number }[] = [
  { city: 'New York', country: 'US', lat: 40.7128, lng: -74.006 },
  { city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278 },
  { city: 'Tokyo', country: 'JP', lat: 35.6762, lng: 139.6503 },
  { city: 'Berlin', country: 'DE', lat: 52.52, lng: 13.405 },
  { city: 'São Paulo', country: 'BR', lat: -23.5505, lng: -46.6333 },
  { city: 'Mumbai', country: 'IN', lat: 19.076, lng: 72.8777 },
  { city: 'Stockholm', country: 'SE', lat: 59.3293, lng: 18.0686 },
  { city: 'Toronto', country: 'CA', lat: 43.6532, lng: -79.3832 },
  { city: 'Paris', country: 'FR', lat: 48.8566, lng: 2.3522 },
  { city: 'Lagos', country: 'NG', lat: 6.5244, lng: 3.3792 },
  { city: 'Sydney', country: 'AU', lat: -33.8688, lng: 151.2093 },
  { city: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198 },
]

const GEO_COL = /^(lat|latitude|lng|lon|long|longitude|location|coordinates|coords|geo|geom|point|position|latlng|city|country)$/i

/** True when a table carries geolocation-relevant columns. */
function tableHasGeo(table: TableMeta): boolean {
  return table.columns.some((c) => GEO_COL.test(c.name))
}

// Small seeded PRNG so grids are stable across renders.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const TAGS = ['beta', 'vip', 'trial', 'churned', 'priority', 'internal', 'eu', 'us']
const EVENTS = ['login', 'purchase', 'refund', 'signup', 'view', 'click', 'export']

/** Build a deterministic nested object/array for document & wide-column types. */
function nestedValueForColumn(
  colName: string,
  colType: string,
  rand: () => number,
  index: number,
): unknown {
  const name = colName.toLowerCase()
  const type = colType.toLowerCase()
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const fixed = (n: number) => Math.round(rand() * n * 100) / 100

  // Arrays / lists / sets → array of primitives or small objects.
  if (
    type.startsWith('array') ||
    type.startsWith('list') ||
    type.startsWith('set') ||
    name === 'tags' ||
    name === 'items' ||
    name === 'events'
  ) {
    if (name === 'items' || name === 'line_items') {
      const n = 1 + Math.floor(rand() * 3)
      return Array.from({ length: n }, () => ({
        sku: `${pick(WORDS).slice(0, 3).toUpperCase()}-${1000 + Math.floor(rand() * 8999)}`,
        qty: 1 + Math.floor(rand() * 5),
        price: fixed(400),
      }))
    }
    if (name === 'events' || name === 'history') {
      const n = 1 + Math.floor(rand() * 3)
      return Array.from({ length: n }, () => ({
        type: pick(EVENTS),
        at: new Date(Date.now() - Math.floor(rand() * 6e9)).toISOString(),
      }))
    }
    const n = 1 + Math.floor(rand() * 3)
    return Array.from({ length: n }, () => pick(TAGS))
  }

  // Maps → key/value object.
  if (type.startsWith('map') || name === 'attributes' || name === 'metadata') {
    return {
      source: pick(['web', 'ios', 'android', 'api']),
      region: pick(COUNTRIES),
      score: Math.floor(rand() * 100),
    }
  }

  // Objects / documents / json → nested record, shaped by column name.
  if (name === 'address' || name === 'location') {
    return {
      city: pick(['Berlin', 'Tokyo', 'Lagos', 'Paris', 'Toronto']),
      country: pick(COUNTRIES),
      geo: { lat: fixed(90), lng: fixed(180) },
    }
  }
  if (name === 'profile' || name === 'user' || name === 'customer') {
    return {
      name: `${pick(FIRST)} ${pick(LAST)}`,
      email: `${pick(FIRST).toLowerCase()}@example.com`,
      preferences: { theme: pick(['dark', 'light']), locale: pick(['en', 'de', 'ja']) },
    }
  }
  if (name === 'payment' || name === 'billing') {
    return {
      method: pick(['card', 'paypal', 'wire']),
      amount: fixed(999),
      currency: pick(['USD', 'EUR', 'GBP']),
      captured: rand() > 0.3,
    }
  }
  // Generic document.
  return {
    id: index + 1,
    kind: pick(WORDS),
    active: rand() > 0.4,
    nested: { level: Math.floor(rand() * 5), label: pick(TAGS) },
  }
}

/** Column types that should render as nested/expandable values. */
function isNestedType(colType: string): boolean {
  const t = colType.toLowerCase()
  return (
    t.includes('json') ||
    t.includes('document') ||
    t.includes('object') ||
    t.startsWith('array') ||
    t.startsWith('list') ||
    t.startsWith('set') ||
    t.startsWith('map')
  )
}

function valueForColumn(
  colName: string,
  colType: string,
  rand: () => number,
  index: number,
): unknown {
  if (isNestedType(colType)) {
    return nestedValueForColumn(colName, colType, rand, index)
  }
  const name = colName.toLowerCase()
  const type = colType.toLowerCase()
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

  if (name === 'id' || name.endsWith('_id') || name === 'user_id') {
    return name === 'id' ? index + 1 : 1 + Math.floor(rand() * 5000)
  }
  if (name === 'email') {
    return `${pick(FIRST).toLowerCase()}.${pick(LAST).toLowerCase()}@example.com`
  }
  if (name === 'full_name' || name === 'name' || name === 'owner') {
    if (name === 'name' && !type.includes('char') && !type.includes('text')) {
      /* fallthrough */
    } else {
      return `${pick(FIRST)} ${pick(LAST)}`
    }
  }
  if (name === 'company') return `${pick(WORDS)} ${pick(['Inc', 'Labs', 'Group', 'Co'])}`
  if (name === 'country' || name === 'currency') {
    return name === 'currency' ? pick(['USD', 'EUR', 'GBP', 'JPY']) : pick(COUNTRIES)
  }
  if (name === 'status') return pick(STATUSES)
  if (name === 'stage') return pick(STAGES)
  if (name === 'category') return pick(CATEGORIES)
  if (name === 'sku') return `${pick(WORDS).slice(0, 3).toUpperCase()}-${1000 + Math.floor(rand() * 8999)}`
  if (name === 'phone') return `+1 ${200 + Math.floor(rand() * 799)} ${1000 + Math.floor(rand() * 8999)}`
  if (name === 'token') return Math.floor(rand() * 1e12).toString(36).padStart(10, '0')
  if (name === 'key') {
    return `${pick(['user', 'cart', 'session', 'rate', 'lock'])}:${1000 + index}:${pick(['data', 'meta', 'v2'])}`
  }
  if (name === 'type') return pick(['string', 'hash', 'list', 'set', 'zset'])

  if (type.includes('bool')) return rand() > 0.25
  if (type.includes('numeric') || type.includes('decimal')) {
    return Math.round(rand() * 500000) / 100
  }
  if (type.includes('int')) return Math.floor(rand() * 10000)
  if (type.includes('date') && !type.includes('time')) {
    const d = new Date(2024, 0, 1 + Math.floor(rand() * 700))
    return d.toISOString().slice(0, 10)
  }
  if (type.includes('time')) {
    const d = new Date(Date.now() - Math.floor(rand() * 3.15e10))
    return d.toISOString().replace('T', ' ').slice(0, 19)
  }
  if (name.includes('name') || type.includes('char') || type.includes('text')) {
    return `${pick(WORDS)} ${pick(['Pro', 'Mini', 'Max', 'Lite', 'Plus'])}`
  }
  return `${pick(WORDS)}-${index}`
}

/** Generate up to `limit` deterministic rows for a table. */
export function generateRows(table: TableMeta, limit = 200): Record<string, unknown>[] {
  const seed = hashString(table.id)
  const count = Math.min(limit, table.rowCount)
  const hasGeo = tableHasGeo(table)
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    const rand = mulberry32(seed + i * 2654435761)
    const row: Record<string, unknown> = {}

    // Pick a coherent city anchor for the whole row when it carries geo data.
    const anchor = GEO_CITIES[hashString(`${table.id}:${i}`) % GEO_CITIES.length]
    const lat = anchor.lat + (rand() - 0.5) * 0.24
    const lng = anchor.lng + (rand() - 0.5) * 0.24

    for (const c of table.columns) {
      const name = c.name.toLowerCase()
      if (hasGeo && GEO_COL.test(c.name)) {
        if (name === 'city') row[c.name] = anchor.city
        else if (name === 'country') row[c.name] = anchor.country
        else if (name === 'latitude' || name === 'lat') row[c.name] = Number(lat.toFixed(6))
        else if (['longitude', 'lng', 'lon', 'long'].includes(name))
          row[c.name] = Number(lng.toFixed(6))
        else row[c.name] = `${lat.toFixed(6)},${lng.toFixed(6)}` // combined location column
        continue
      }
      if (hasGeo && name === 'name') {
        row[c.name] = `${anchor.city} ${STORE_KINDS[Math.floor(rand() * STORE_KINDS.length)]}`
        continue
      }
      row[c.name] = valueForColumn(c.name, c.type, rand, i)
    }
    rows.push(row)
  }
  return rows
}

export function findTable(connections: Connection[], tableId: string): TableMeta | undefined {
  for (const conn of connections) {
    for (const schema of conn.schemas) {
      const t = schema.tables.find((t) => t.id === tableId)
      if (t) return t
    }
  }
  return undefined
}
