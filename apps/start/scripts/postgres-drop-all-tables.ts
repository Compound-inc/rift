/**
 * Drop every user table from the Postgres database used by local Zero development.
 *
 * Why this exists:
 * - `zero:reset` only removes a fixed list of known Zero tables.
 * - If the schema drifts, tables are renamed, or extra app tables are created,
 *   those relations can survive a reset and leave the database in a bad state.
 *
 * What this script does:
 * 1. Loads `ZERO_UPSTREAM_DB` from `apps/start/.env.local` or `apps/start/.env`.
 * 2. Reads every base table in the `public` schema.
 * 3. Drops each table with `CASCADE` so dependent constraints and objects are removed too.
 *
 * Run from `apps/start`:
 *   bun run postgres:drop-all-tables
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool } from 'pg'

const appDir = join(import.meta.dir, '..')

async function loadEnv(): Promise<void> {
  const envFiles = [join(appDir, '.env.local'), join(appDir, '.env')]

  for (const envFile of envFiles) {
    try {
      const text = await readFile(envFile, 'utf-8')

      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const separatorIndex = trimmed.indexOf('=')
        if (separatorIndex <= 0) continue

        const key = trimmed.slice(0, separatorIndex).trim()
        const value = trimmed.slice(separatorIndex + 1).trim()

        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    } catch {
      // Missing env files are valid in CI or when values already come from the shell.
    }
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
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
    const tableQuery = await pool.query<{ table_name: string }>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
    )

    if (tableQuery.rowCount === 0) {
      console.log('No tables found in schema "public".')
      return
    }

    console.log(
      `Dropping ${tableQuery.rowCount} table${tableQuery.rowCount === 1 ? '' : 's'} from schema "public"...`,
    )

    for (const { table_name } of tableQuery.rows) {
      const qualifiedTableName = `${quoteIdentifier('public')}.${quoteIdentifier(table_name)}`
      await pool.query(`DROP TABLE IF EXISTS ${qualifiedTableName} CASCADE`)
      console.log(`  - dropped ${qualifiedTableName}`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Failed to drop Postgres tables.', error)
  process.exit(1)
})
