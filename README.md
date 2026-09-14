# Datalook Studio

A self-hosted database management dashboard for teams. Connect to PostgreSQL, MySQL, MongoDB, Redis, Cassandra, and more — all from a single, polished web UI with role-based access control and encrypted credentials. Runs as a lightweight demo with no backend, or as a real deployment with server-verified auth and a Postgres-backed system store — see [Architecture](#architecture).

![Datalook Studio](public/logo-dark.svg)

## Why Datalook Studio?

Most database GUIs are desktop applications (DBeaver, TablePlus) or single-vendor web tools (phpMyAdmin, MongoDB Compass). Teams that manage multiple database engines end up juggling several tools, each with its own auth model and no shared visibility.

**Datalook Studio** solves this by providing:

- **Multi-engine support** — 10 working database drivers (PostgreSQL, MySQL, CockroachDB, ClickHouse, MongoDB, CouchDB, Redis, Cassandra, DynamoDB, SQLite) from one interface. MSSQL is listed but not yet implemented — see [`lib/db/adapter-factory.ts`](lib/db/adapter-factory.ts).
- **Role-based access control** — Built-in roles (Admin, Editor, Viewer) plus custom roles with fine-grained permissions. Shared and personal connections.
- **Credentials encrypted at rest** — AES-GCM encryption (server-side for connections created through the app; Web Crypto in the browser-only demo mode). Connection credentials are never stored in plaintext.
- **Two deployment modes** — a zero-backend browser demo (all state in IndexedDB, no real auth) for trying the app, or a real backend (Postgres-backed users/roles/audit log, hashed passwords, signed sessions) for an actual team deployment. See [Architecture](#architecture).
- **Team-ready** — Shared connections with per-user grants, audit logging, and an admin console for user management.
- **SQL editor + data browser** — Write queries with syntax highlighting, browse table data, export results in CSV/TSV/JSON/Text formats.
- **Query storage** — Save and reload queries per database type with IndexedDB persistence.
- **YAML import/export** — Define connection configurations as YAML files for version control and reproducible deployments.
- **Customizable theming** — Light/dark mode with 6 accent colors, persisted per device.

## Architecture

Datalook Studio has a real server-side layer: Next.js Route Handlers hold a
connection-adapter framework (`lib/db/adapters/*`, one class per driver) that
does the actual querying, so database credentials never reach the browser.
What varies between deployment modes is **who the app's own users, roles, and
audit log answer to** — controlled by `NEXT_PUBLIC_SYSTEM_BACKEND`:

```
┌───────────────────────────────┐        ┌───────────────────────────────┐
│  NEXT_PUBLIC_SYSTEM_BACKEND=   │        │  NEXT_PUBLIC_SYSTEM_BACKEND=   │
│  browser  (default, demo)      │        │  postgres (real deployment)    │
│                                 │        │                                 │
│  Browser                       │        │  Browser                       │
│  ┌───────────────────────────┐ │        │  ┌───────────────────────────┐ │
│  │ React UI · AuthProvider    │ │        │  │ React UI · AuthProvider    │ │
│  │ (client-side password      │ │        │  │ (calls /api/auth/*,        │ │
│  │  check, no server identity)│ │        │  │  session in httpOnly cookie│ │
│  └──────────────┬──────────────┘ │        │  └──────────────┬──────────────┘ │
│  ┌──────────────┴──────────────┐ │        │                 │                │
│  │ IndexedDB: users, roles,    │ │        │  Server (Route Handlers)       │
│  │ audit log, connection meta  │ │        │  ┌──────────────┴──────────────┐ │
│  └───────────────────────────┘ │        │  │ /api/auth/* · /api/system/* │ │
│                                 │        │  │ scrypt password hashing,    │ │
│  Server (Route Handlers)       │        │  │ signed session cookies      │ │
│  ┌───────────────────────────┐ │        │  └──────────────┬──────────────┘ │
│  │ /api/connections/**        │ │        │  ┌──────────────┴──────────────┐ │
│  │ (queries real databases    │ │        │  │ Postgres "datalook" schema  │ │
│  │  the user connects to)     │ │        │  │ users · roles · audit_log   │ │
│  └───────────────────────────┘ │        │  │ (scripts/init-db.ts)        │ │
│                                 │        │  └──────────────┬──────────────┘ │
│                                 │        │  ┌──────────────┴──────────────┐ │
│                                 │        │  │ /api/connections/** (same   │ │
│                                 │        │  │ adapter framework as left)  │ │
│                                 │        │  └───────────────────────────┘ │
└───────────────────────────────┘        └───────────────────────────────┘
```

In both modes, connection credentials for databases you connect *to* are
encrypted server-side (`lib/db/server-crypto.ts`, AES-256-GCM) and stored in
`.data/connections.json` on the server filesystem — fine for a single-instance
Docker/standalone deployment, but not for Vercel's ephemeral filesystem or a
multi-instance deployment (see `docs/deployment/vercel.md`).

The `postgres` backend is what `docker/docker-compose.yaml` runs by default.
It gets you real server-verified login (hashed passwords, signed session
cookies, no plaintext anywhere) and a real audit trail, but note: sessions are
stateless signed tokens, not server-tracked — logging out clears the cookie
but doesn't revoke the token itself, so a captured token remains valid until
it expires (7 days). Set `SESSION_SECRET` explicitly for any real deployment.

### Key directories

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router pages and layout |
| `components/` | React UI components (workspace, auth, providers, UI primitives) |
| `components/providers/` | Context providers for auth, workspace, theme |
| `components/workspace/` | Main workspace UI — navigator, SQL editor, results grid, tabs |
| `lib/` | Core logic — types, drivers, RBAC, persistence, encryption |
| `docker/` | Dockerfile and docker-compose for self-hosted deployment |
| `docs/` | MkDocs documentation source |
| `.github/workflows/` | CI/CD pipelines |

## Quick start

### Prerequisites

- Node.js 22+
- pnpm 9+

### Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs in development mode with demo data and quick-login shortcuts.

### Local databases (optional)

Spin up real database instances for testing connections:

```bash
pnpm db:up        # start all databases via Docker
pnpm db:down      # stop
pnpm db:reset     # stop and wipe volumes
```

## Deployment

### Option 1: Docker (recommended for self-hosting)

```bash
# Build and start the app + databases
docker compose -f docker/docker-compose.yaml up -d

# Or just the app
docker compose -f docker/docker-compose.yaml up -d app
```

The app is available at `http://localhost:3000`.

**Environment variables** (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | `development` | `production` for real deployments |
| `NEXT_PUBLIC_SYSTEM_BACKEND` | `browser` | `postgres` for a real server-backed system store + auth (see Architecture above) |
| `NEXT_PUBLIC_DEFAULT_DB_DRIVER` | `postgres` | System store driver on first run (must be `postgres` when `NEXT_PUBLIC_SYSTEM_BACKEND=postgres`) |
| `NEXT_PUBLIC_DEFAULT_ADMIN_NAME` | `Admin` | Initial admin display name |
| `NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL` | `admin@yourcompany.com` | Initial admin email |
| `NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD` | `datalook` | Login password in `browser` backend mode only; ignored in `postgres` mode (see `ADMIN_PASSWORD` below) |
| `NEXT_PUBLIC_SYSTEM_DB_NAME` | `datalook-studio` | System database name |
| `NEXT_PUBLIC_SKIP_ONBOARDING` | _(unset)_ | `true` to seed admin from env vars and skip onboarding; unset for interactive onboarding |
| `NEXT_PUBLIC_AES_KEY` | _(auto-generated)_ | Base64-encoded 256-bit AES key for credential encryption |

Server-only (never sent to the browser — required for `NEXT_PUBLIC_SYSTEM_BACKEND=postgres`):

| Variable | Default | Description |
|---|---|---|
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` | `localhost` / `5432` / `postgres` / `postgres` | Postgres connection used by `scripts/init-db.ts` and by the running app to read/write the real system store |
| `SYSTEM_DB_NAME` | `datalook-studio` | Database name for the system store |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `Admin` / `admin@datalook.com` / `Datalook@123` | Admin user created by `scripts/init-db.ts` on first run (password is hashed before storage) |
| `SESSION_SECRET` | _(insecure built-in default — set this)_ | Signs session cookies; generate with `openssl rand -base64 32` |
| `CONN_ENCRYPTION_KEY` | _(hashed built-in default — set this)_ | Encrypts connection credentials at rest on the server filesystem |

### Option 2: Vercel

```bash
vercel          # preview deployment
vercel --prod   # production deployment
```

Set the environment variables in the Vercel dashboard or via CLI:

```bash
vercel env add NEXT_PUBLIC_APP_ENV
vercel env add NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL
# ... etc
```

### Option 3: Standalone Node.js

```bash
pnpm build
node .next/standalone/server.js
```

## Documentation

Full documentation is available at [docs.datalook.dev](https://docs.datalook.dev) (deployed on Cloudflare Workers).

To run docs locally:

```bash
pip install mkdocs mkdocs-material
mkdocs serve
```

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui, Lucide icons
- **State**: React Context (AuthProvider, WorkspaceProvider, ThemeProvider)
- **Persistence**: `browser` backend mode: IndexedDB with Web Crypto (AES-GCM). `postgres` backend mode: real Postgres schema (`scripts/init-db.ts`) for users/roles/audit log, server-side AES-256-GCM (Node crypto) for connection credentials
- **Language**: TypeScript 5.7
- **Package manager**: pnpm

## License

Apache-2.0 — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
