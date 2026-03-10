/**
 * Full dev reset: drops all tables (auth + Zero), then recreates everything.
 *
 * Run this for a clean slate. It:
 * 1. Drops all tables in public schema (session, user, Zero tables, etc.)
 * 2. Applies Better Auth schema (user, organization, member, invitation, etc.)
 * 3. Drops Zero publication and tables, re-applies Zero schema, creates publication
 * 4. Removes Zero replica files (zero.db, zero.db-wal, zero.db-shm)
 *
 * Run from apps/start: `bun run db:reset`
 */

import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool } from 'pg'

const appDir = join(import.meta.dir, '..')
const authConfigPath = join(appDir, 'src/lib/auth/auth.server.ts')

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

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
      // ignore missing files
    }
  }
}

async function dropAllTables(pool: Pool): Promise<void> {
  await pool.query('DROP PUBLICATION IF EXISTS zero_data')

  const tableQuery = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  )

  if (!tableQuery.rowCount || tableQuery.rowCount === 0) {
    console.log('  No tables to drop.')
    return
  }

  console.log(`  Dropping ${tableQuery.rowCount} table(s)...`)
  for (const { table_name } of tableQuery.rows) {
    const qualified = `${quoteIdentifier('public')}.${quoteIdentifier(table_name)}`
    await pool.query(`DROP TABLE IF EXISTS ${qualified} CASCADE`)
    console.log(`  ✓ dropped ${table_name}`)
  }
}

async function main(): Promise<void> {
  await loadEnv()

  const connectionString = process.env.ZERO_UPSTREAM_DB?.trim()
  if (!connectionString) {
    console.error(
      'ZERO_UPSTREAM_DB is not set. Set it in apps/start/.env or .env.local.',
    )
    process.exit(1)
  }

  console.log('1. Dropping all tables (auth + Zero)...')
  const pool = new Pool({ connectionString })
  try {
    await dropAllTables(pool)
  } finally {
    await pool.end()
  }

  console.log('\n2. Running Better Auth migrations...')
  const migrateResult = spawnSync(
    'bunx',
    ['@better-auth/cli', 'migrate', '--yes', '--config', authConfigPath],
    {
      env: process.env,
      stdio: 'inherit',
      cwd: appDir,
    },
  )
  if (migrateResult.status !== 0) {
    process.exit(migrateResult.status ?? 1)
  }

  console.log('\n3. Running Zero reset...')
  const zeroResult = spawnSync('bun', ['run', 'scripts/zero-dev-reset.ts'], {
    env: process.env,
    stdio: 'inherit',
    cwd: appDir,
  })
  if (zeroResult.status !== 0) {
    process.exit(zeroResult.status ?? 1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
