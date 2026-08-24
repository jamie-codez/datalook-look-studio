# Quick Start

## 1. Start the app

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## 2. Sign in

In development mode, use the quick-login buttons to sign in as:

- **Admin** — Full access, can manage users and connections
- **Editor** — Can create connections and run queries
- **Viewer** — Read-only access

In production mode, sign in with the admin credentials configured via environment variables.

## 3. Create a connection

1. Click **New Connection** in the top bar
2. Fill in the **Connection** tab (name, driver, host, port, database, username)
3. Optionally configure **Topology** (standalone, replica set, master/slave)
4. Optionally configure **Access** (read-only mode, shared/personal visibility, team grants)
5. Click **Create connection**

!!! tip "YAML import"
    You can also import connections from a YAML file. Expand the **Import / Export YAML** section in the dialog.

## 4. Browse data

1. Expand a connection in the navigator sidebar
2. Expand a schema
3. Click a table to view its data

## 5. Run SQL queries

1. Click **New Query** in the top bar
2. If no connection is active, you'll be prompted to select a data source
3. Write your SQL in the editor
4. Click **Run** (or press `Ctrl+Enter`)
5. Export results using the export dropdown (CSV, TSV, JSON, Text)

## 6. Customize appearance

1. Open **Settings** (gear icon or from the avatar dropdown)
2. Under **Appearance**, choose light/dark mode and an accent color
3. Colors are persisted per device
