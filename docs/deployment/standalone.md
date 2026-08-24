# Standalone Deployment

Next.js standalone output mode produces a minimal server that doesn't require `node_modules`.

## Build

```bash
pnpm build
```

This creates `.next/standalone/` with a self-contained `server.js`.

## Run

```bash
node .next/standalone/server.js
```

The server listens on port 3000 by default. Override with:

```bash
PORT=8080 node .next/standalone/server.js
```

## Deploy to a server

1. Build the app: `pnpm build`
2. Copy these to your server:
   - `.next/standalone/` (the entire directory)
   - `.next/static/` → place inside `.next/standalone/.next/static/`
   - `public/` → place inside `.next/standalone/public/`
3. Run: `node server.js`

## Process management

Use PM2 or systemd to keep the app running:

### PM2

```bash
pm2 start .next/standalone/server.js --name datalook-studio
pm2 save
pm2 startup
```

### systemd

```ini
[Unit]
Description=Datalook Studio
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/datalook-studio
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NEXT_PUBLIC_APP_ENV=production

[Install]
WantedBy=multi-user.target
```
