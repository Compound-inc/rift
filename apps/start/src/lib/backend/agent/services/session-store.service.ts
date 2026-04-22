import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { formatSqlClientCause } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import type { AgentSessionRecord } from '../types'
import { now } from '../persistence'

function toError(message: string, cause?: unknown) {
  return new Error(`${message}: ${formatSqlClientCause(cause)}`)
}

type AgentSessionRow = {
  readonly conversation_id: string
  readonly runtime: string
  readonly session_json: string
  readonly created_at: number
  readonly updated_at: number
}

function mapSessionRow(row: AgentSessionRow): AgentSessionRecord {
  return {
    conversationId: row.conversation_id,
    runtime: row.runtime,
    sessionJson: row.session_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type AgentSessionStoreShape = {
  readonly loadSession: (input: {
    readonly conversationId: string
    readonly runtime: string
  }) => Effect.Effect<AgentSessionRecord | null, Error>
  readonly saveSession: (input: {
    readonly conversationId: string
    readonly runtime: string
    readonly sessionJson: string
  }) => Effect.Effect<void, Error>
}

export class AgentSessionStore extends ServiceMap.Service<
  AgentSessionStore,
  AgentSessionStoreShape
>()('agent/AgentSessionStore') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      return {
        loadSession: Effect.fn('AgentSessionStore.loadSession')((input) =>
          Effect.gen(function* () {
            const rows = yield* sql<AgentSessionRow>`
              select *
              from agent_sessions
              where conversation_id = ${input.conversationId}
                and runtime = ${input.runtime}
              limit 1
            `

            const row = rows[0]
            return row ? mapSessionRow(row) : null
          }).pipe(Effect.mapError((error) => toError('Failed to load agent session', error))),
        ),
        saveSession: Effect.fn('AgentSessionStore.saveSession')((input) =>
          Effect.gen(function* () {
            const persistedAt = now()

            yield* sql`
              insert into agent_sessions (
                conversation_id,
                runtime,
                session_json,
                created_at,
                updated_at
              ) values (
                ${input.conversationId},
                ${input.runtime},
                ${input.sessionJson},
                ${persistedAt},
                ${persistedAt}
              )
              on conflict (conversation_id) do update
              set
                runtime = excluded.runtime,
                session_json = excluded.session_json,
                updated_at = excluded.updated_at
            `
          }).pipe(Effect.mapError((error) => toError('Failed to save agent session', error))),
        ),
      }
    }),
  )
}
