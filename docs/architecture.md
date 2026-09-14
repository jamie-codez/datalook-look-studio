# Architecture

## Overview

Datalook Studio has a real server-side layer: Next.js Route Handlers
(`app/api/**`) hold a connection-adapter framework — one class per database
driver in `lib/db/adapters/`, dispatched through `lib/db/adapter-factory.ts`
— that actually connects to and queries the databases you point it at.
Connection credentials are encrypted (AES-256-GCM) and held server-side; they
are never sent to the browser.

What *is* configurable is where the app's own identity data lives — its
users, roles, and audit log — controlled by `NEXT_PUBLIC_SYSTEM_BACKEND`:

- **`browser`** (default): a zero-backend demo mode. Users, roles, and the
  audit log live in the browser's IndexedDB; "login" is a client-side
  password comparison with no server-verified identity. Good for trying the
  app locally; not suitable for a real multi-user deployment.
- **`postgres`**: the real mode. Users, roles, and the audit log live in a
  Postgres schema (`datalook`) provisioned by `scripts/init-db.ts`. Login is
  verified server-side against a scrypt password hash, and the session is a
  signed httpOnly cookie (`lib/auth/session.ts`) — never stored in the
  browser's own storage. This is what `docker/docker-compose.yaml` runs.

```
                    Browser
   ┌─────────────────────────────────────────┐
   │  React 19 UI · AuthProvider · Workspace  │
   │  Provider · ThemeProvider                │
   └───────────────────┬───────────────────────┘
                        │ fetch()
                        ▼
                 Route Handlers (app/api/**)
   ┌─────────────────────────────────────────┐
   │ /api/connections/**                      │  → lib/db/adapter-factory.ts
   │   queries the databases you connect to     →  lib/db/adapters/*.ts
   │                                           │     (postgres, mysql, mongo,
   │ /api/auth/* · /api/system/*  (postgres     │      redis, cassandra, …)
   │   backend only)                          │
   └───────┬───────────────────────┬───────────┘
           │                       │
           ▼                       ▼
  .data/connections.json    Postgres "datalook" schema
  (AES-256-GCM encrypted    (users, roles, audit_log —
   connection credentials,   only when SYSTEM_BACKEND=
   server filesystem)        postgres; scripts/init-db.ts)
```

In `browser` backend mode, the identity side of that diagram doesn't exist —
`AuthProvider` reads/writes IndexedDB directly instead of calling
`/api/auth/*` or `/api/system/*`, and there is no real login boundary.

## State management

Three React Context providers manage all application state:

### AuthProvider (`components/providers/auth-provider.tsx`)

Picks one of two implementations at render time based on
`NEXT_PUBLIC_SYSTEM_BACKEND` (a deployment-time constant, not per-render
state):

- `RealAuthProvider` (`postgres` backend): current user comes from
  `GET /api/auth/session` (a signed cookie, resolved against the real `users`
  table); login/logout/user & role CRUD all call `/api/auth/*` and
  `/api/system/*`.
- `DemoAuthProvider` (`browser` backend, unchanged from earlier versions):
  users/roles/password live in IndexedDB (production) or in-memory mock data
  (development); login is a plain string comparison.

### WorkspaceProvider

- Connections (personal + shared) — metadata persisted via IndexedDB
  (`lib/persistence.ts`) on the client, credentials persisted server-side via
  `lib/db/server-store.ts`.
- Tab management (SQL editor, data browser, properties, server status,
  settings, admin).
- Query history (in-memory only — not persisted across reloads yet).
- Audit log — real (`/api/system/audit-log`) in `postgres` backend mode,
  IndexedDB otherwise.
- Connection CRUD and access management, via `/api/connections`.

### ThemeProvider

- Light/dark mode
- Accent color (6 presets)
- Persists to `localStorage`

## The system store (`lib/system-store.ts`)

The "System Store" connection shown in the navigator (id `conn-system`) is
special-cased: `lib/db/server-store.ts` auto-registers it server-side from
`PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`SYSTEM_DB_NAME` whenever those are
set, pointing at the real `datalook` schema — so browsing it goes through the
same generic Postgres adapter and `/api/connections/**` routes as any other
connection, and returns real rows. `password_hash` is redacted from the
generic row browser for the `users` table specifically (see
`app/api/connections/[id]/[db]/[table]/rows/route.ts`), and reading or
writing it requires an authenticated session (write requires the Admin role).

When `PGHOST` isn't set (i.e. `browser` backend mode), the system connection
falls back to a client-fabricated schema with placeholder row counts, purely
for demo purposes — `lib/system-store.ts` gates this on
`NEXT_PUBLIC_SYSTEM_BACKEND`.

## Auth (`postgres` backend mode)

- Passwords are hashed with Node's built-in `scrypt` (`lib/auth/password.ts`)
  — never stored or compared in plaintext.
- Sessions are stateless signed tokens (`lib/auth/session.ts`): a JSON
  payload plus an HMAC-SHA256 signature, in an httpOnly, `SameSite=Lax`
  cookie. This means logout clears the cookie but doesn't revoke the token
  itself — a captured token stays valid until it expires (7 days). Set
  `SESSION_SECRET` explicitly in any real deployment (falls back to an
  insecure built-in default otherwise, with a logged warning).
- `scripts/init-db.ts` creates the schema, tables, and the first Admin user
  on first run (via `docker/entrypoint.sh` in the Docker image, or run
  manually with `npx tsx scripts/init-db.ts`).

## Persistence (`browser` backend mode / demo)

The app uses IndexedDB with 4 object stores:

| Store | Purpose |
|---|---|
| `meta` | System metadata, system store config |
| `connections` | Connection metadata (client-side cache; credentials themselves live server-side) |
| `queries` | Saved SQL queries per database type |
| `audit` | Audit log entries |

Connection credentials are additionally encrypted server-side
(`lib/db/server-crypto.ts`, AES-256-GCM) and stored in `.data/connections.json`
on the server filesystem — fine for a single-instance Docker/standalone
deployment, not for Vercel's ephemeral filesystem or a multi-instance
deployment.

## UI components

The app uses **shadcn/ui** components built on **Base UI** (not Radix). Components live in `components/ui/`.

## Database drivers

10 of the 11 drivers listed in `lib/drivers.ts` have a real, working adapter
in `lib/db/adapters/`: PostgreSQL, MySQL, CockroachDB, ClickHouse, SQLite,
MongoDB, CouchDB, Redis, Cassandra, DynamoDB. **MSSQL is listed but not
implemented** — `lib/db/adapter-factory.ts` throws a clear `unsupported`
error rather than silently using the wrong wire protocol, and it's shown
disabled in the driver picker.

Each driver entry has:

- An ID, label, category, accent color
- Default port
- Container label (schemas vs databases, tables vs collections)
- A `supported` flag (defaults to true; false hides/disables it in pickers)

The driver system is extensible — add a new driver by adding an adapter class
implementing `DBAdapter` (`lib/db/types.ts`), registering it in
`ADAPTER_FACTORIES`, and adding its metadata to `DRIVERS` and the `DriverId`
type.

## RBAC

Roles and permissions are defined in `lib/rbac.ts`:

- 3 built-in roles: Admin, Editor, Viewer
- Custom roles with arbitrary permission sets
- Connection-level roles (`viewer`/`editor`/`manager`/`admin`) for shared connections
- Permission checks via `can(role, permission)` and the `useRBAC()` hook client-side; the same `can()` is used server-side in `/api/system/**` routes to authorize mutations

## Known gaps

- **Server Status tab** shows illustrative (not live) metrics for every
  connection — no driver has real monitoring/metrics collection yet. The tab
  is labeled "Simulated metrics" so this isn't presented as real telemetry.
- **Query history** and the **connections**/**query_history** Postgres tables
  created by `scripts/init-db.ts` are schema-only — not yet wired to any read
  path.
- **Connection storage** (`.data/connections.json`) doesn't work on
  serverless/ephemeral filesystems (Vercel) or multi-instance deployments.
