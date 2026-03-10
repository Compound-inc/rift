/**
 * Full dev reset: Better Auth migrations + Zero (Postgres, replica files).
 *
 * Run this for a clean slate. It:
 * 1. Applies Better Auth schema (user, organization, member, invitation, etc.)
 * 2. Drops Zero publication and tables, re-applies Zero schema, creates publication
 * 3. Removes Zero replica files (zero.db, zero.db-wal, zero.db-shm)
 *
 * Run from apps/start: `bun run db:reset`
 */

import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const appDir = join(import.meta.dir, '..')
const authConfigPath = join(appDir, 'src/lib/auth/auth.server.ts')

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

async function main(): Promise<void> {
  await loadEnv()

  if (!process.env.ZERO_UPSTREAM_DB?.trim()) {
    console.error(
      'ZERO_UPSTREAM_DB is not set. Set it in apps/start/.env or .env.local.',
    )
    process.exit(1)
  }

  console.log('1. Running Better Auth migrations...')
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

  console.log('\n2. Running Zero reset...')
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
