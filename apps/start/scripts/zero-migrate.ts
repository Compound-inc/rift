/**
 * Production-safe Zero migration runner.
 *
 * Why this exists:
 * - `zero:reset` is destructive and only suitable for local development.
 * - Production/staging need forward-only, idempotent migrations that run once.
 * - We also need protection against concurrent deploys racing migrations.
 *
 * What this script does:
 * 1. Loads `ZERO_UPSTREAM_DB` from env/.env files.
 * 2. Acquires a Postgres advisory lock so only one runner migrates at a time.
 * 3. Runs Better Auth migrations first so auth-owned tables exist.
 * 4. Creates a migration ledger table if needed.
 * 5. Applies `zero/migrations/schema.sql` (the baseline) through the same
 *    ledger. It is idempotent (`IF NOT EXISTS` everywhere), so re-running it
 *    is safe; the ledger ensures it is recorded exactly once. Editing
 *    `schema.sql` after it has been recorded will trip the checksum guard
 *    and fail the deploy on purpose — new tables must go in a new
 *    timestamped migration file, never by editing the baseline in place.
 * 6. Applies timestamped `zero/migrations/*.sql` files in lexical order.
 * 7. Records filename + checksum, and fails if an already-applied file changed.
 *
 * Run from apps/start:
 *   bun run scripts/zero-migrate.ts
 */

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool } from 'pg'
import type { PoolClient } from 'pg'

const appDir = join(import.meta.dir, '..')
const authConfigPath = join(appDir, 'src/lib/backend/auth/auth.server.ts')
const migrationsDir = join(appDir, 'zero', 'migrations')
const MIGRATION_TABLE = 'zero_schema_migrations'
const LOCK_KEY = 4_123_771
const BASELINE_SCHEMA_FILE = 'schema.sql'

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

function checksum(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Applies a migration file exactly once using the shared migration ledger.
 *
 * Keeping the write path centralized ensures the baseline schema and the
 * timestamped forward-only migrations use the same checksum validation and
 * transaction semantics.
 */
async function applyMigration(
  client: PoolClient,
  filename: string,
  sql: string,
): Promise<void> {
  const fileChecksum = checksum(sql)

  const existing = await client.query<{
    checksum: string
  }>(
    `SELECT checksum
     FROM ${MIGRATION_TABLE}
     WHERE filename = $1`,
    [filename],
  )

  if (existing.rowCount && existing.rows[0]) {
    const appliedChecksum = existing.rows[0].checksum
    if (appliedChecksum !== fileChecksum) {
      throw new Error(
        `Migration ${filename} was already applied with a different checksum. Create a new migration file instead of editing old ones.`,
      )
    }
    console.log(`- skip ${filename} (already applied)`)
    return
  }

  console.log(`- apply ${filename}`)
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query(
      `INSERT INTO ${MIGRATION_TABLE} (filename, checksum)
       VALUES ($1, $2)`,
      [filename, fileChecksum],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

/**
 * Runs Better Auth's own migration command before Zero's schema bootstrap.
 *
 * Zero's baseline schema depends on Better Auth-owned tables like `user`,
 * `organization`, `member`, and `invitation`. On a blank database, those
 * tables do not exist yet, so the deploy script needs to bring auth schema up
 * first before applying `schema.sql` and the incremental Zero migrations.
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
      'No Postgres connection string found. Set ZERO_UPSTREAM_DB, DATABASE_URL, or DATABASE_PUBLIC_URL in Railway variables.',
    )
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    console.log('Acquiring migration lock...')
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])

    runBetterAuthMigrations()

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const files = (await readdir(migrationsDir))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort((a, b) => a.localeCompare(b))

    console.log(`Found ${files.length} migration files.`)

    /**
     * Always run the baseline schema before timestamped migrations.
     *
     * The previous implementation only applied `schema.sql` when the
     * `threads` table was missing, on the assumption that `schema.sql`
     * represented a frozen baseline. In practice, new tables kept being
     * added directly to `schema.sql` after environments had already been
     * bootstrapped, so those environments silently fell behind and later
     * `ALTER TABLE` migrations exploded against tables that did not exist.
     *
     * Running it every time is safe because every statement in `schema.sql`
     * uses `IF NOT EXISTS`, and the migration ledger guarantees the file is
     * recorded exactly once. The checksum guard in `applyMigration` then
     * forces any future change to `schema.sql` to be made via a new
     * timestamped migration file rather than an in-place edit.
     */
    const schemaPath = join(migrationsDir, BASELINE_SCHEMA_FILE)
    const schemaSql = await readFile(schemaPath, 'utf-8')
    await applyMigration(client, BASELINE_SCHEMA_FILE, schemaSql)

    if (files.length === 0) {
      console.log('No timestamped migration files found.')
      return
    }

    for (const filename of files) {
      const fullPath = join(migrationsDir, filename)
      const sql = await readFile(fullPath, 'utf-8')
      await applyMigration(client, filename, sql)
    }

    console.log('Migrations complete.')
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY])
    } catch {
      // Ignore unlock failures if connection is already closed.
    }
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
