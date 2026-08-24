# Vercel Deployment

## Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Preview deployment (dev)
vercel

# Production deployment
vercel --prod
```

## Environment variables

Set environment variables in the Vercel dashboard or via CLI:

```bash
vercel env add NEXT_PUBLIC_APP_ENV
vercel env add NEXT_PUBLIC_DEFAULT_DB_DRIVER
vercel env add NEXT_PUBLIC_DEFAULT_ADMIN_NAME
vercel env add NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL
vercel env add NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD
vercel env add NEXT_PUBLIC_SYSTEM_DB_NAME
```

For production, set:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL` | Your admin email |
| `NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD` | A secure password |
| `NEXT_PUBLIC_AES_KEY` | `openssl rand -base64 32` output |

## GitHub integration

1. Import the repository in Vercel
2. Set environment variables
3. Every push to `main` triggers a production deployment
4. Every PR triggers a preview deployment

## CI/CD with GitHub Actions

The repository includes GitHub Actions workflows for:

- **Preview deployments** on PRs (`.github/workflows/preview.yml`)
- **Production deployments** on pushes to `main` (`.github/workflows/production.yml`)

See [CI/CD documentation](../ci-cd.md) for details.
