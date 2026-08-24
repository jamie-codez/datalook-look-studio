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
# Pass them as build args, then export as ENV so process.env sees them.
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

ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_DEFAULT_DB_DRIVER=$NEXT_PUBLIC_DEFAULT_DB_DRIVER
ENV NEXT_PUBLIC_DEFAULT_ADMIN_NAME=$NEXT_PUBLIC_DEFAULT_ADMIN_NAME
ENV NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL=$NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL
ENV NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD=$NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD
ENV NEXT_PUBLIC_SYSTEM_DB_NAME=$NEXT_PUBLIC_SYSTEM_DB_NAME
ENV NEXT_PUBLIC_DEFAULT_DB_HOST=$NEXT_PUBLIC_DEFAULT_DB_HOST
ENV NEXT_PUBLIC_DEFAULT_DB_PORT=$NEXT_PUBLIC_DEFAULT_DB_PORT
ENV NEXT_PUBLIC_DEFAULT_DB_USER=$NEXT_PUBLIC_DEFAULT_DB_USER
ENV NEXT_PUBLIC_DEFAULT_DB_PASSWORD=$NEXT_PUBLIC_DEFAULT_DB_PASSWORD
ENV NEXT_PUBLIC_DEFAULT_DB_NAME=$NEXT_PUBLIC_DEFAULT_DB_NAME
ENV NEXT_PUBLIC_AES_KEY=$NEXT_PUBLIC_AES_KEY
ENV NEXT_PUBLIC_SKIP_ONBOARDING=$NEXT_PUBLIC_SKIP_ONBOARDING

RUN pnpm build

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Include pg, tsx, and the init script so the entrypoint can initialize the DB
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate \
  && pnpm install --prod --frozen-lockfile --ignore-scripts \
  && pnpm add -D tsx @types/pg @types/node

COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000

CMD ["./entrypoint.sh"]
