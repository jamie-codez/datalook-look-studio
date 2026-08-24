# Connections

## Creating a connection

1. Click **New Connection** in the top bar
2. The dialog is organized into tabs:
   - **Connection** — Name, driver, host, port, database, username
   - **Topology** — Standalone, replica set, or master/slave with replica hosts
   - **Access** — Read-only mode, shared/personal visibility, team grants (admin only)

## Supported drivers

| Driver | Category | Default Port |
|---|---|---|
| PostgreSQL | SQL | 5432 |
| MySQL | SQL | 3306 |
| MSSQL | SQL | 1433 |
| CockroachDB | SQL | 26257 |
| ClickHouse | SQL | 9000 |
| SQLite | SQL | — |
| MongoDB | Document | 27017 |
| CouchDB | Document | 5984 |
| Redis | Key-value | 6379 |
| Cassandra | Wide-column | 9042 |
| DynamoDB | Wide-column | 8000 |

## Connection visibility

- **Personal** — Visible only to you. Available to all users.
- **Shared** — Visible to the team. Admins can assign specific users with granular roles (Owner, Editor, Viewer).

## Read-only mode

Read-only connections reject all write and DDL statements for every role. This is enforced at the application level.

## YAML import/export

In the New Connection dialog, expand **Import / Export YAML** to:

- **Upload** a `.yaml` file with connection configurations
- **Paste** YAML text and parse it
- **Export** the current form as a YAML file

Example YAML format:

```yaml
connections:
  - name: Analytics Replica
    driver: postgres
    host: db.example.internal
    port: 5432
    database: appdb
    username: app
    readOnly: false
    topology: replicaSet
    replicaHosts:
      - host: replica-1.example.internal
        port: 5432
        role: secondary
```

## Removing connections

Click the **⋮** menu next to a connection in the navigator and select **Remove connection**. Only connection owners and admins can remove shared connections.
