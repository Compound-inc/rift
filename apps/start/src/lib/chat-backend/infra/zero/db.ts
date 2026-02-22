import { zeroNodePg } from '@rocicorp/zero/server/adapters/pg'
import type { NodePgTransaction } from '@rocicorp/zero/server/adapters/pg'
import type { ServerTransaction } from '@rocicorp/zero/server'
import { Pool } from 'pg'
import { createBuilder } from '@rocicorp/zero'
import { schema } from '@/integrations/zero/schema'
import type { Schema as ZeroSchema } from '@/integrations/zero/schema'

const connectionString = process.env.ZERO_UPSTREAM_DB
const pool = connectionString ? new Pool({ connectionString }) : null
const zeroDatabase = pool ? zeroNodePg(schema, pool) : null

export type ZeroServerTransaction = ServerTransaction<ZeroSchema, NodePgTransaction>

// Shared ZQL builder for server-side repositories. Keep a single builder so query
// shapes stay centralized and strongly typed against the same schema as Zero clients.
export const zql = createBuilder(schema)

export function getZeroDatabase() {
  return zeroDatabase
}

