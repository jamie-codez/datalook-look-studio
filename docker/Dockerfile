# syntax=docker/dockerfile:1

# ---- Dependencies ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- Builder ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars are inlined at build time by Next.js.
# Pass them as build args so the production bundle has the correct values.
ARG NEXT_PUBLIC_APP_ENV=production
ARG NEXT_PUBLIC_DEFAULT_DB_DRIVER
ARG NEXT_PUBLIC_DEFAULT_ADMIN_NAME
ARG NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL
ARG NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD
ARG NEXT_PUBLIC_SYSTEM_DB_NAME
ARG NEXT_PUBLIC_DEFAULT_DB_HOST
ARG NEXT_PUBLIC_DEFAULT_DB_PORT
ARG NEXT_PUBLIC_DEFAULT_DB_USER
ARG NEXT_PUBLIC_DEFAULT_DB_PASSWORD
ARG NEXT_PUBLIC_DEFAULT_DB_NAME
ARG NEXT_PUBLIC_AES_KEY
ARG NEXT_PUBLIC_SKIP_ONBOARDING

RUN pnpm build

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
