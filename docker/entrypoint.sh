#!/bin/sh
set -e

# Run the database initialization script if PGHOST is set
if [ -n "$PGHOST" ]; then
  echo "[entrypoint] Running database initialization..."

  # Retry up to 5 times with 3-second intervals
  RETRY=0
  MAX_RETRIES=5
  until [ $RETRY -ge $MAX_RETRIES ]; do
    RETRY=$((RETRY + 1))
    echo "[entrypoint] Attempt $RETRY/$MAX_RETRIES..."
    if node_modules/.bin/tsx scripts/init-db.ts; then
      echo "[entrypoint] Database initialization successful."
      break
    else
      if [ $RETRY -ge $MAX_RETRIES ]; then
        echo "[entrypoint] WARNING: Database initialization failed after $MAX_RETRIES attempts."
        echo "[entrypoint] App will start, but the system database may not be ready."
      else
        echo "[entrypoint] Retrying in 3 seconds..."
        sleep 3
      fi
    fi
  done
else
  echo "[entrypoint] PGHOST not set — skipping database initialization."
  echo "[entrypoint] Run 'npx tsx scripts/init-db.ts' manually after starting Postgres."
fi

echo "[entrypoint] Starting Datalook Studio..."
exec node server.js
