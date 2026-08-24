# Roles & Permissions

## Built-in roles

| Role | Description |
|---|---|
| **Admin** | Full access — manage users, connections, audit logs, system store |
| **Editor** | Create connections, run queries, control transactions |
| **Viewer** | Read-only access — run SELECT queries, browse data |

## Custom roles

Admins can create custom roles with fine-grained permissions. Custom roles are managed in the admin console.

### Permissions

| Permission | Description |
|---|---|
| `users.manage` | Create, update, and remove users |
| `connections.create` | Create new connections |
| `connections.create.shared` | Create shared (team) connections |
| `transaction.control` | Commit and rollback transactions |
| `audit.view` | View audit logs |

## Connection-level roles

For shared connections, admins can assign per-connection roles:

| Role | Description |
|---|---|
| **Owner** | Full control — edit, delete, manage access |
| **Editor** | Use the connection, run queries |
| **Viewer** | Read-only access to the connection |

## Audit logging

All significant actions are logged:

- Connection creation and removal
- Query execution (success, error, blocked)
- Transaction commits and rollbacks
- Permission-denied events
- User management actions

Audit logs are persisted in IndexedDB and can be exported as JSON from the admin console.
