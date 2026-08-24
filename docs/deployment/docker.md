# Docker Deployment

## Quick start

```bash
docker compose -f docker/docker-compose.yaml up -d app
```

The app is available at `http://localhost:3000`.

## Full stack (app + databases)

```bash
docker compose -f docker/docker-compose.yaml up -d
```

This starts the app plus all 10 database engines for testing connections.

## Configuration

Environment variables are set in `docker/docker-compose.yaml`:

```yaml
services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - '3000:3000'
    environment:
      NEXT_PUBLIC_APP_ENV: production
      NEXT_PUBLIC_DEFAULT_DB_DRIVER: postgres
      NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL: admin@yourcompany.com
      NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD: datalook
      NEXT_PUBLIC_SYSTEM_DB_NAME: datalook-studio
      # NEXT_PUBLIC_AES_KEY: <base64-encoded-256-bit-key>
```

## Building the image

```bash
docker compose -f docker/docker-compose.yaml build app
```

The Dockerfile uses a multi-stage build:

1. **deps** — Installs npm dependencies with pnpm
2. **builder** — Builds the Next.js production bundle with `output: 'standalone'`
3. **runner** — Minimal Alpine image running `node server.js` as a non-root user

## Health check

The app responds to HTTP requests on port 3000. Add a health check in your compose file if needed:

```yaml
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Behind a reverse proxy

The app works behind any reverse proxy (nginx, Caddy, Traefik). No special configuration is needed — it's a standard Next.js standalone server.

Example nginx config:

```nginx
server {
    listen 80;
    server_name studio.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
