# SQL Editor

## Opening a SQL editor

Click **New Query** in the top bar. If no connection is active, you'll be prompted to select a data source.

## Running queries

- Click **Run** in the top bar, or press `Ctrl+Enter`
- Results appear in the results grid below the editor
- Query execution time and row count are shown in the status bar

## Query history

Every executed query is saved to the query history. View past queries with their:

- SQL text
- Timestamp
- Duration
- Status (success, error, blocked)
- Connection name
- Row count

## Saved queries

Queries are persisted per database type in IndexedDB. You can save, load, and delete queries from the editor toolbar.

## Transaction control

Admins and Editors can commit and rollback transactions using the buttons in the top bar. Viewers see these buttons disabled.

## Permissions

| Role | Can run SELECT | Can run write/DDL |
|---|---|---|
| Admin | Yes | Yes |
| Editor | Yes | Yes |
| Viewer | Yes | No |
| Custom | Depends on permissions | Depends on permissions |

Read-only connections reject write/DDL for all roles.
