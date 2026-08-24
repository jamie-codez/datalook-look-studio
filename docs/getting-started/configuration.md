# Configuration

All configuration is via environment variables. Since Datalook Studio is a client-side app, all variables use the `NEXT_PUBLIC_` prefix.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | `development` | `production` for real deployments, `development` for demo mode |
| `NEXT_PUBLIC_DEFAULT_DB_DRIVER` | `postgres` | System store driver on first run |
| `NEXT_PUBLIC_DEFAULT_ADMIN_NAME` | `Admin` | Initial admin display name |
| `NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL` | `admin@yourcompany.com` | Initial admin email |
| `NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD` | `datalook` | Initial admin password |
| `NEXT_PUBLIC_SYSTEM_DB_NAME` | `datalook-studio` | System database name |
| `NEXT_PUBLIC_AES_KEY` | _(auto-generated)_ | Base64-encoded 256-bit AES key for credential encryption |

## Environment modes

### Development

- Shows demo data and quick-login shortcuts
- System store picker is shown on first run
- Audit log is pre-populated with sample events

### Production

- Empty workspace on first run
- Seeds a single default admin from environment variables
- Auto-configures the system store from `NEXT_PUBLIC_DEFAULT_DB_DRIVER`

## AES encryption key

Connection credentials (host, port, database, username) are encrypted with AES-GCM before being saved to IndexedDB.

If `NEXT_PUBLIC_AES_KEY` is not set, a key is auto-generated and stored in the browser's IndexedDB. This is fine for single-user setups but means credentials can't be shared across devices.

For team deployments, generate a fixed key and set it as an environment variable:

```bash
openssl rand -base64 32
```

Set the output as `NEXT_PUBLIC_AES_KEY`.

!!! warning
    If you change the AES key after connections have been created, existing connections will need to be re-created since their credentials can no longer be decrypted.
