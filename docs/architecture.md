# Architecture

## Overview

Datalook Studio is a **client-side-only** application. There is no backend server, no API, and no database to manage. The entire app runs in the browser.

```
┌─────────────────────────────────────────────────────┐
│                    Browser (client)                   │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  React 19    │  │  Next.js 16  │  │ Tailwind v4 │ │
│  │  UI Layer    │  │  App Router  │  │  + shadcn   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────────┘ │
│         │                  │                          │
│  ┌──────┴──────────────────┴──────────────────────┐ │
│  │              State Management                   │ │
│  │  AuthProvider · WorkspaceProvider · ThemeProvider│ │
│  └──────┬──────────────────────────────────────────┘ │
│         │                                             │
│  ┌──────┴──────────────────────────────────────────┐ │
│  │           IndexedDB Persistence                  │ │
│  │  meta · connections · queries · audit            │ │
│  └──────┬──────────────────────────────────────────┘ │
│         │                                             │
│  ┌──────┴──────────────────────────────────────────┐ │
│  │        Web Crypto API (AES-GCM)                  │ │
│  │     Connection credential encryption at rest     │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## State management

Three React Context providers manage all application state:

### AuthProvider

- Current user and session
- User list (for admin console)
- Role-based access control (RBAC) checks via `useRBAC()` hook
- Custom role CRUD operations
- User switching (demo mode)

### WorkspaceProvider

- Connections (personal + shared)
- Tab management (SQL editor, data browser, properties, server status, settings, admin)
- Query history
- Audit log
- Connection CRUD and access management

### ThemeProvider

- Light/dark mode
- Accent color (6 presets)
- Persists to `localStorage`

## Persistence (IndexedDB)

The app uses IndexedDB with 4 object stores:

| Store | Purpose |
|---|---|
| `meta` | System metadata, system store config |
| `connections` | All connection definitions (encrypted) |
| `queries` | Saved SQL queries per database type |
| `audit` | Audit log entries |

### Encryption

Connection credentials (host, port, database, username) are encrypted with **AES-GCM** via the Web Crypto API before being written to IndexedDB. The encryption key is either:

- Auto-generated and stored in IndexedDB (default)
- Provided via `NEXT_PUBLIC_AES_KEY` environment variable (recommended for teams)

## UI components

The app uses **shadcn/ui** components built on **Base UI** (not Radix). Components live in `components/ui/`.

## Database drivers

All 11 drivers are defined in `lib/drivers.ts`. Each driver has:

- An ID, label, category, accent color
- Default port
- Container label (schemas vs databases, tables vs collections)
- Entity plural label

The driver system is extensible — add a new driver by adding to the `DRIVERS` array and the `DriverId` type.

## RBAC

Roles and permissions are defined in `lib/rbac.ts`:

- 3 built-in roles: Admin, Editor, Viewer
- Custom roles with arbitrary permission sets
- Connection-level roles for shared connections
- Permission checks via `can(permission)` hook

## Why no backend?

Datalook Studio is designed for teams who want a database GUI without the operational overhead of running a backend service. The browser is the runtime. IndexedDB is the database. Web Crypto is the security layer.

This means:

- **No server to maintain** — Deploy as a static site or container
- **No data leaves the browser** — Connections are stored locally, encrypted
- **Scales horizontally for free** — Each user's data is in their own browser
- **Trade-off** — No cross-device sync (by design). Each device is independent.
