import { Pool } from 'pg'

let zeroUpstreamPool: Pool | null | undefined
let shutdownRegistered = false
let shutdownInFlight: Promise<void> | null = null

function readConnectionString(): string | null {
  const raw = process.env.ZERO_UPSTREAM_DB?.trim()
  return raw && raw.length > 0 ? raw : null
}

async function closeZeroUpstreamPool(): Promise<void> {
  if (!zeroUpstreamPool) return
  if (shutdownInFlight) {
    await shutdownInFlight
    return
  }

  const pool = zeroUpstreamPool
  zeroUpstreamPool = null
  shutdownInFlight = pool
    .end()
    .catch(() => undefined)
    .finally(() => {
      shutdownInFlight = null
    })

  await shutdownInFlight
}

function registerShutdownHooks() {
  if (shutdownRegistered) return
  shutdownRegistered = true

  const shutdown = () => {
    void closeZeroUpstreamPool()
  }

  process.once('beforeExit', shutdown)
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

export function getZeroUpstreamPool(): Pool | null {
  if (zeroUpstreamPool !== undefined) {
    return zeroUpstreamPool
  }

  const connectionString = readConnectionString()
  if (!connectionString) {
    zeroUpstreamPool = null
    return zeroUpstreamPool
  }

  zeroUpstreamPool = new Pool({ connectionString })
  if (typeof zeroUpstreamPool.on === 'function') {
    zeroUpstreamPool.on('error', (error) => {
      console.error('Unexpected upstream Postgres pool error', error)
    })
  }
  registerShutdownHooks()
  return zeroUpstreamPool
}

export function requireZeroUpstreamPool(): Pool {
  const pool = getZeroUpstreamPool()
  if (pool) return pool
  throw new Error('Missing required environment variable ZERO_UPSTREAM_DB.')
}
