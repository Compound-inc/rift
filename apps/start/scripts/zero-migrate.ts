/**
 * Production-safe Zero schema runner.
 *
 * Single-source-of-truth model: `zero/migrations/schema.sql` IS the schema.
 * It must be written so every statement is idempotent (`CREATE TABLE IF NOT
 * EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT
 * EXISTS`, `INSERT … ON CONFLICT DO NOTHING`). Deploys re-apply the file on
 * every run; if you need to evolve the schema, edit `schema.sql` directly.
 *
 * What this script does:
 * 1. Loads `ZERO_UPSTREAM_DB` from env / .env files.
 * 2. Acquires a Postgres advisory lock so only one runner deploys at a time.
 * 3. Runs Better Auth migrations first so auth-owned tables exist.
 * 4. Applies `zero/migrations/schema.sql` inside a transaction.
 *
 * Run from apps/start:
 *   bun run scripts/zero-migrate.ts
 */

import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool } from 'pg'

const appDir = join(import.meta.dir, '..')
const authConfigPath = join(appDir, 'src/lib/backend/auth/auth.server.ts')
const schemaPath = join(appDir, 'zero', 'migrations', 'schema.sql')
const LOCK_KEY = 4_123_771

async function loadEnv(): Promise<void> {
  const envLocal = join(appDir, '.env.local')
  const env = join(appDir, '.env')
  for (const p of [envLocal, env]) {
    try {
      const text = await readFile(p, 'utf-8')
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        const value = trimmed.slice(eq + 1).trim()
        if (!process.env[key]) process.env[key] = value
      }
    } catch {
      // Ignore missing env files.
    }
  }
}

/**
 * Runs Better Auth's own migration command before applying schema.sql.
 *
 * Zero's schema depends on Better Auth-owned tables (`user`, `organization`,
 * `member`, `invitation`). On a blank database, those tables do not exist
 * yet, so deploys need to bring auth schema up first.
 */
function runBetterAuthMigrations(): void {
  console.log('Running Better Auth migrations...')
  const result = spawnSync(
    'bunx',
    ['@better-auth/cli', 'migrate', '--yes', '--config', authConfigPath],
    {
      env: process.env,
      stdio: 'inherit',
      cwd: appDir,
    },
  )

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function main(): Promise<void> {
  await loadEnv()

  const connectionString = [
    process.env.ZERO_UPSTREAM_DB,
    process.env.DATABASE_URL,
    process.env.DATABASE_PUBLIC_URL,
    process.env.POSTGRES_URL,
    process.env.PGURL,
  ]
    .map((value) => value?.trim())
    .find((value) => Boolean(value))

  if (!connectionString) {
    console.error(
      'No Postgres connection string found. Set ZERO_UPSTREAM_DB, DATABASE_URL, or DATABASE_PUBLIC_URL.',
    )
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    console.log('Acquiring deploy lock...')
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])

    runBetterAuthMigrations()

    console.log('Applying schema.sql...')
    const schemaSql = await readFile(schemaPath, 'utf-8')
    await client.query('BEGIN')
    try {
      await client.query(schemaSql)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    console.log('Schema applied.')
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY])
    } catch {
      // Ignore unlock failures if the connection is already closed.
    }
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
