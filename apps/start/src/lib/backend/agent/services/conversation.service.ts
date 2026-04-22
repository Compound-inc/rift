import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import type { AgentConversationRecord } from '../types'
import {
  formatSqlClientCause,
  sqlJson,
} from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { normalizeScopedOrgId, now } from '../persistence'

function toError(message: string, cause?: unknown) {
  return new Error(`${message}: ${formatSqlClientCause(cause)}`)
}

type AgentConversationRow = {
  readonly id: string
  readonly product: string
  readonly scope_type: string
  readonly scope_id: string
  readonly owner_user_id: string
  readonly owner_org_id: string
  readonly title: string
  readonly default_model_id: string
  readonly status: AgentConversationRecord['status']
  readonly metadata_json: unknown
  readonly created_at: number
  readonly updated_at: number
  readonly last_message_at: number
}

function mapConversationRow(row: AgentConversationRow): AgentConversationRecord {
  return {
    id: row.id,
    product: row.product,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    ownerUserId: row.owner_user_id,
    ownerOrgId: row.owner_org_id,
    title: row.title,
    defaultModelId: row.default_model_id,
    status: row.status,
    metadataJson:
      typeof row.metadata_json === 'object' && row.metadata_json !== null
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  }
}

export type AgentConversationServiceShape = {
  readonly createConversation: (input: {
    readonly product: string
    readonly scopeType: string
    readonly scopeId: string
    readonly ownerUserId: string
    readonly ownerOrgId?: string
    readonly title: string
    readonly defaultModelId: string
    readonly metadataJson?: Record<string, unknown>
  }) => Effect.Effect<AgentConversationRecord, Error>
  readonly getScopedConversation: (input: {
    readonly conversationId: string
    readonly userId: string
    readonly organizationId?: string
  }) => Effect.Effect<AgentConversationRecord | null, Error>
  readonly listScopedConversations: (input: {
    readonly product: string
    readonly scopeType: string
    readonly scopeId: string
    readonly userId: string
    readonly organizationId?: string
  }) => Effect.Effect<readonly AgentConversationRecord[], Error>
  readonly touchConversation: (input: {
    readonly conversationId: string
    readonly updatedAt?: number
    readonly title?: string
    readonly defaultModelId?: string
    readonly metadataJson?: Record<string, unknown>
  }) => Effect.Effect<void, Error>
}

export class AgentConversationService extends ServiceMap.Service<
  AgentConversationService,
  AgentConversationServiceShape
>()('agent/AgentConversationService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      return {
        createConversation: Effect.fn('AgentConversationService.createConversation')((input) =>
          Effect.gen(function* () {
            const createdAt = now()
            const record: AgentConversationRecord = {
              id: crypto.randomUUID(),
              product: input.product,
              scopeType: input.scopeType,
              scopeId: input.scopeId,
              ownerUserId: input.ownerUserId,
              ownerOrgId: normalizeScopedOrgId(input.ownerOrgId),
              title: input.title,
              defaultModelId: input.defaultModelId,
              status: 'active',
              metadataJson: input.metadataJson ?? {},
              createdAt,
              updatedAt: createdAt,
              lastMessageAt: createdAt,
            }

            yield* sql`
              insert into agent_conversations (
                id,
                product,
                scope_type,
                scope_id,
                owner_user_id,
                owner_org_id,
                title,
                default_model_id,
                status,
                metadata_json,
                created_at,
                updated_at,
                last_message_at
              ) values (
                ${record.id},
                ${record.product},
                ${record.scopeType},
                ${record.scopeId},
                ${record.ownerUserId},
                ${record.ownerOrgId},
                ${record.title},
                ${record.defaultModelId},
                ${record.status},
                ${sqlJson(sql, record.metadataJson)},
                ${record.createdAt},
                ${record.updatedAt},
                ${record.lastMessageAt}
              )
            `

            return record
          }).pipe(Effect.mapError((error) => toError('Failed to create agent conversation', error))),
        ),
        getScopedConversation: Effect.fn('AgentConversationService.getScopedConversation')(
          (input) =>
            Effect.gen(function* () {
              const rows = yield* sql<AgentConversationRow>`
                select *
                from agent_conversations
                where id = ${input.conversationId}
                  and owner_user_id = ${input.userId}
                  and owner_org_id = ${normalizeScopedOrgId(input.organizationId)}
                limit 1
              `

              const row = rows[0]
              return row ? mapConversationRow(row) : null
            }).pipe(Effect.mapError((error) => toError('Failed to load agent conversation', error))),
        ),
        listScopedConversations: Effect.fn('AgentConversationService.listScopedConversations')(
          (input) =>
            Effect.gen(function* () {
              const rows = yield* sql<AgentConversationRow>`
                select *
                from agent_conversations
                where product = ${input.product}
                  and scope_type = ${input.scopeType}
                  and scope_id = ${input.scopeId}
                  and owner_user_id = ${input.userId}
                  and owner_org_id = ${normalizeScopedOrgId(input.organizationId)}
                order by updated_at desc
              `

              return rows.map(mapConversationRow)
            }).pipe(Effect.mapError((error) => toError('Failed to list agent conversations', error))),
        ),
        touchConversation: Effect.fn('AgentConversationService.touchConversation')((input) =>
          Effect.gen(function* () {
            const updatedAt = input.updatedAt ?? now()

            yield* sql`
              update agent_conversations
              set
                updated_at = ${updatedAt},
                last_message_at = ${updatedAt},
                title = coalesce(${input.title ?? null}, title),
                default_model_id = coalesce(${input.defaultModelId ?? null}, default_model_id),
                metadata_json = coalesce(
                  ${input.metadataJson ? sqlJson(sql, input.metadataJson) : null}::jsonb,
                  metadata_json
                )
              where id = ${input.conversationId}
            `
          }).pipe(Effect.mapError((error) => toError('Failed to update agent conversation', error))),
        ),
      }
    }),
  )
}
