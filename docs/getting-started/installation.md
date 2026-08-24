# Installation

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 22+ |
| pnpm | 9+ |
| Docker (optional) | 24+ |

## Install dependencies

```bash
git clone https://github.com/datalook/studio.git
cd studio
pnpm install
```

## Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

In development mode (`NEXT_PUBLIC_APP_ENV=development`), the app shows demo data and quick-login shortcuts.

## Start local databases (optional)

To test real database connections locally, spin up Docker containers for all supported databases:

```bash
pnpm db:up          # start all databases
pnpm db:down        # stop all databases
pnpm db:reset       # stop and wipe all volumes
```

This starts PostgreSQL, MySQL, MSSQL, CockroachDB, ClickHouse, MongoDB, CouchDB, Redis, Cassandra, and DynamoDB Local.

## Production build

```bash
pnpm build
pnpm start
```

## TypeScript check

```bash
npx tsc --noEmit
```
