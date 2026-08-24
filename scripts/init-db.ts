#!/usr/bin/env npx tsx
/**
 * Initialize the Datalook Studio system database.
 *
 * Connects to the default Postgres instance (from env vars or defaults),
 * creates the system database if it doesn't exist, then creates the schema
 * and tables for users, roles, connections, audit_log, and query_history.
 * Also creates the admin user from env vars.
 *
 * Usage:
 *   npx tsx scripts/init-db.ts
 *
 * Environment variables (all optional, shown with defaults):
 *   PGHOST=localhost
 *   PGPORT=5432
 *   PGUSER=postgres
 *   PGPASSWORD=postgres
 *   SYSTEM_DB_NAME=datalook-studio
 *   ADMIN_NAME=Admin
 *   ADMIN_EMAIL=admin@datalook.com
 *   ADMIN_PASSWORD=Datalook@123
 */

import { Client } from 'pg'

const PGHOST = process.env.PGHOST || 'localhost'
const PGPORT = parseInt(process.env.PGPORT || '5432', 10)
const PGUSER = process.env.PGUSER || 'postgres'
const PGPASSWORD = process.env.PGPASSWORD || 'postgres'
const SYSTEM_DB_NAME = process.env.SYSTEM_DB_NAME || 'datalook-studio'
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@datalook.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Datalook@123'

async function main() {
  console.log(`[init-db] Connecting to Postgres at ${PGHOST}:${PGPORT} as ${PGUSER}...`)

  // Connect to the default 'postgres' database to create the system DB.
  const adminClient = new Client({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: 'postgres',
  })

  try {
    await adminClient.connect()
    console.log('[init-db] Connected to postgres database.')

    // Check if the system database already exists.
    const res = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [SYSTEM_DB_NAME],
    )

    if (res.rowCount && res.rowCount > 0) {
      console.log(`[init-db] Database "${SYSTEM_DB_NAME}" already exists.`)
    } else {
      console.log(`[init-db] Creating database "${SYSTEM_DB_NAME}"...`)
      await adminClient.query(`CREATE DATABASE "${SYSTEM_DB_NAME}"`)
      console.log(`[init-db] Database "${SYSTEM_DB_NAME}" created.`)
    }

    await adminClient.end()
  } catch (err) {
    console.error('[init-db] Failed to connect or create database:', err)
    process.exit(1)
  }

  // Connect to the system database to create schema and tables.
  const dbClient = new Client({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: SYSTEM_DB_NAME,
  })

  try {
    await dbClient.connect()
    console.log(`[init-db] Connected to "${SYSTEM_DB_NAME}".`)

    // Create schema
    console.log('[init-db] Creating schema "datalook"...')
    await dbClient.query('CREATE SCHEMA IF NOT EXISTS datalook')

    // Create tables
    console.log('[init-db] Creating tables...')

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS datalook.users (
        id          BIGSERIAL PRIMARY KEY,
        name        VARCHAR(120) NOT NULL,
        email       VARCHAR(255) NOT NULL UNIQUE,
        role        VARCHAR(24)  NOT NULL DEFAULT 'Viewer',
        custom_role_id VARCHAR(48),
        password_hash VARCHAR(255),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS datalook.roles (
        id          BIGSERIAL PRIMARY KEY,
        name        VARCHAR(80) NOT NULL UNIQUE,
        description TEXT,
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        color       VARCHAR(48),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS datalook.connections (
        id          BIGSERIAL PRIMARY KEY,
        name        VARCHAR(120) NOT NULL,
        driver      VARCHAR(24)  NOT NULL,
        host        VARCHAR(255) NOT NULL,
        port        INTEGER,
        database    VARCHAR(255),
        username    VARCHAR(120),
        password_enc TEXT,
        scope       VARCHAR(12)  NOT NULL DEFAULT 'personal',
        owner_id    VARCHAR(48),
        encrypted   BOOLEAN      NOT NULL DEFAULT false,
        read_only   BOOLEAN      NOT NULL DEFAULT false,
        topology    VARCHAR(24)  DEFAULT 'standalone',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS datalook.audit_log (
        id          BIGSERIAL PRIMARY KEY,
        action      VARCHAR(80)  NOT NULL,
        actor       VARCHAR(120),
        role        VARCHAR(24),
        target      VARCHAR(255),
        status      VARCHAR(16)  NOT NULL DEFAULT 'allowed',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS datalook.query_history (
        id              BIGSERIAL PRIMARY KEY,
        connection_id   BIGINT,
        statement_type  VARCHAR(16),
        body            TEXT,
        duration_ms     INTEGER,
        status          VARCHAR(16),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS datalook.connection_grants (
        id              BIGSERIAL PRIMARY KEY,
        connection_id   BIGINT NOT NULL REFERENCES datalook.connections(id) ON DELETE CASCADE,
        user_id         BIGINT NOT NULL REFERENCES datalook.users(id) ON DELETE CASCADE,
        role            VARCHAR(24) NOT NULL DEFAULT 'viewer',
        UNIQUE(connection_id, user_id)
      )
    `)

    console.log('[init-db] All tables created.')

    // Create admin user if not exists
    console.log(`[init-db] Checking for admin user "${ADMIN_EMAIL}"...`)
    const adminRes = await dbClient.query(
      'SELECT id FROM datalook.users WHERE email = $1',
      [ADMIN_EMAIL.toLowerCase()],
    )

    if (adminRes.rowCount && adminRes.rowCount > 0) {
      console.log(`[init-db] Admin user "${ADMIN_EMAIL}" already exists (id: ${adminRes.rows[0].id}).`)
    } else {
      console.log(`[init-db] Creating admin user: ${ADMIN_NAME} <${ADMIN_EMAIL}>...`)
      await dbClient.query(
        `INSERT INTO datalook.users (name, email, role, password_hash)
         VALUES ($1, $2, 'Admin', $3)`,
        [ADMIN_NAME, ADMIN_EMAIL.toLowerCase(), ADMIN_PASSWORD],
      )
      console.log('[init-db] Admin user created with Admin role.')
    }

    // Create first audit log entry
    const auditRes = await dbClient.query(
      `SELECT id FROM datalook.audit_log WHERE action = 'System initialization' LIMIT 1`,
    )
    if (!auditRes.rowCount || auditRes.rowCount === 0) {
      await dbClient.query(
        `INSERT INTO datalook.audit_log (action, actor, role, target, status)
         VALUES ('System initialization', $1, 'Admin', $2, 'allowed')`,
        [ADMIN_NAME, SYSTEM_DB_NAME],
      )
      console.log('[init-db] First audit log entry created.')
    } else {
      console.log('[init-db] Audit log already has initialization entry.')
    }

    console.log(`[init-db] Initialization complete. Database "${SYSTEM_DB_NAME}" is ready.`)
    await dbClient.end()
  } catch (err) {
    console.error('[init-db] Failed to initialize database:', err)
    process.exit(1)
  }
}

main()
