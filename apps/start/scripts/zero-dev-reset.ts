/**
 * Full dev reset: Postgres (Zero upstream), Zero replica files, and re-apply migrations.
 *
 *
 * What it does:
 * 1. Drops Zero publication and all Zero tables in Postgres.
 * 2. Re-applies the Zero schema (zero/migrations/schema.sql).
 * 3. Deletes Zero replica files (zero.db, zero.db-wal, zero.db-shm) so zero-cache starts fresh.
 *
 * Browser (Zero client): IndexedDB is not cleared by this script. For a full client reset,
 * clear site data for localhost in DevTools (Application → Storage → Clear site data)
 * or use an incognito window.
 *
 * Run from repo root: `cd apps/start && bun run scripts/zero-dev-reset.ts`
 * Or from apps/start: `bun run scripts/zero-dev-reset.ts`
 */

import { readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool } from 'pg'

const appDir = join(import.meta.dir, '..')
const zeroDir = join(appDir, 'zero')
const scriptsDir = join(zeroDir, 'scripts')
const migrationsDir = join(zeroDir, 'migrations')

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

async function runSql(pool: Pool, sql: string, label: string): Promise<void> {
  await pool.query(sql)
  console.log(`  ✓ ${label}`)
}

async function main(): Promise<void> {
  await loadEnv()
  const connectionString = process.env.ZERO_UPSTREAM_DB
  if (!connectionString) {
    console.error(
      'ZERO_UPSTREAM_DB is not set. Set it in apps/start/.env or .env.local.',
    )
    process.exit(1)
  }

  const pool = new Pool({ connectionString })

  try {
    console.log('1. Dropping Postgres publication and Zero tables...')
    const dropSql = await readFile(
      join(scriptsDir, 'drop-all-zero-tables.sql'),
      'utf-8',
    )
    await runSql(pool, dropSql, 'drop-all-zero-tables.sql')

    console.log('2. Re-applying Zero schema...')
    const schemaPath = join(migrationsDir, 'schema.sql')
    const schemaSql = await readFile(schemaPath, 'utf-8')
    await runSql(pool, schemaSql, 'schema.sql')

    console.log('  Creating publication for zero-cache replication...')
    await runSql(
      pool,
      `CREATE PUBLICATION zero_data FOR TABLE users, organizations, threads, messages, org_ai_policy, attachments`,
      'CREATE PUBLICATION zero_data',
    )

    console.log('3. Removing Zero replica files (zero-cache local SQLite)...')
    const replicaPath =
      process.env.ZERO_REPLICA_FILE || join(appDir, 'zero.db')
    const replicaBase = replicaPath.endsWith('.db')
      ? replicaPath.slice(0, -3)
      : replicaPath
    const toRemove = [
      replicaPath,
      `${replicaBase}-wal`,
      `${replicaBase}-shm`,
    ]
    for (const p of toRemove) {
      try {
        await unlink(p)
        console.log(`  ✓ removed ${p}`)
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`  ⚠ could not remove ${p}:`, e)
        }
      }
    }

    console.log('\nDone. Next steps:')
    console.log('  - Restart zero-cache: bun run zero-cache')
    console.log('  - Restart the app dev server.')
    console.log(
      '  - For a clean browser client, clear site data for localhost (DevTools → Application → Clear site data).',
    )
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
