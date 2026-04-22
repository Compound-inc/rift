import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import type {
  AgentLiveEvent,
  AgentMessageEnvelope,
  AgentTurnEnvelope,
  AgentTurnStatus,
} from '@/lib/shared/agent'
import {
  formatSqlClientCause,
  sqlJson,
} from '@/lib/backend/server-effect/services/upstream-postgres.service'
import type {
  AgentConversationRecord,
  AgentMessageRecord,
  AgentTurnRecord,
} from '../types'
import {
  now,
  prepareAgentTurnEnvelopeForPersistence,
  projectAgentMessagesForConversationHistory,
} from '../persistence'

function toError(message: string, cause?: unknown) {
  return new Error(`${message}: ${formatSqlClientCause(cause)}`)
}

export type AgentTurnStoreShape = {
  readonly createPendingTurn: (input: {
    readonly conversation: AgentConversationRecord
    readonly requestId: string
    readonly modelId?: string
    readonly providerId?: string
    readonly changeSetId?: string
    readonly turnJson: AgentTurnEnvelope
  }) => Effect.Effect<AgentTurnRecord, Error>
  readonly checkpointTurn: (input: {
    readonly conversation: AgentConversationRecord
    readonly turnId: string
    readonly status: AgentTurnStatus
    readonly turnJson: AgentTurnEnvelope
    readonly userMessageId?: string
    readonly assistantMessageId?: string
    readonly liveEvent?: AgentLiveEvent
  }) => Effect.Effect<void, Error>
  readonly completeTurn: (input: {
    readonly conversation: AgentConversationRecord
    readonly turnId: string
    readonly status: Extract<AgentTurnStatus, 'completed' | 'failed' | 'aborted'>
    readonly turnJson: AgentTurnEnvelope
    readonly errorJson?: Record<string, unknown>
    readonly userMessageId?: string
    readonly assistantMessageId?: string
  }) => Effect.Effect<void, Error>
}

type AgentIndexRow = {
  readonly next_index: number | null
}

type ExistingMessageIndexRow = {
  readonly first_message_index: number | null
}

function toMessageRow(input: {
  readonly conversation: AgentConversationRecord
  readonly turnId: string
  readonly message: AgentMessageEnvelope
  readonly messageIndex: number
  readonly status: AgentTurnStatus
  readonly updatedAt: number
}): AgentMessageRecord {
  return {
    id: input.message.id,
    conversationId: input.conversation.id,
    turnId: input.turnId,
    product: input.conversation.product,
    role: input.message.role,
    messageIndex: input.messageIndex,
    status: input.status,
    partsJson: input.message.parts,
    toolCallId: input.message.toolCallId,
    toolName: input.message.toolName,
    isError: input.message.isError,
    createdAt: input.message.createdAt,
    updatedAt: input.updatedAt,
  }
}

const lockConversationRow = Effect.fn('AgentTurnStore.lockConversationRow')(
  (sql: PgClient.PgClient, conversationId: string) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ id: string }>`
        select id
        from agent_conversations
        where id = ${conversationId}
        for update
      `

      if (!rows[0]) {
        return yield* Effect.fail(new Error('agent conversation not found'))
      }
    }),
)

const readNextTurnIndex = Effect.fn('AgentTurnStore.readNextTurnIndex')(
  (sql: PgClient.PgClient, conversationId: string) =>
    Effect.gen(function* () {
      const rows = yield* sql<AgentIndexRow>`
        select (coalesce(max(turn_index), 0) + 1)::int as next_index
        from agent_turns
        where conversation_id = ${conversationId}
      `

      return rows[0]?.next_index ?? 1
    }),
)

const readNextMessageIndex = Effect.fn('AgentTurnStore.readNextMessageIndex')(
  (sql: PgClient.PgClient, conversationId: string) =>
    Effect.gen(function* () {
      const rows = yield* sql<AgentIndexRow>`
        select (coalesce(max(message_index), 0) + 1)::int as next_index
        from agent_messages
        where conversation_id = ${conversationId}
      `

      return rows[0]?.next_index ?? 1
    }),
)

const readExistingMessageIndex = Effect.fn('AgentTurnStore.readExistingMessageIndex')(
  (sql: PgClient.PgClient, turnId: string) =>
    Effect.gen(function* () {
      const rows = yield* sql<ExistingMessageIndexRow>`
        select min(message_index)::int as first_message_index
        from agent_messages
        where turn_id = ${turnId}
      `

      return rows[0]?.first_message_index ?? null
    }),
)

const persistProjectedMessages = Effect.fn('AgentTurnStore.persistProjectedMessages')(
  (input: {
    readonly sql: PgClient.PgClient
    readonly conversation: AgentConversationRecord
    readonly turnId: string
    readonly status: AgentTurnStatus
    readonly turnJson: AgentTurnEnvelope
  }) =>
    Effect.gen(function* () {
      const projectedMessages = projectAgentMessagesForConversationHistory(
        input.turnJson.messages,
      )
      const updatedAt = now()
      const existingMessageIndex = yield* readExistingMessageIndex(
        input.sql,
        input.turnId,
      )
      const initialMessageIndex =
        existingMessageIndex ??
        (yield* readNextMessageIndex(input.sql, input.conversation.id))

      yield* input.sql`
        delete from agent_messages
        where turn_id = ${input.turnId}
      `

      let messageIndex = initialMessageIndex
      for (const message of projectedMessages) {
        const row = toMessageRow({
          conversation: input.conversation,
          turnId: input.turnId,
          message,
          messageIndex,
          status: input.status,
          updatedAt,
        })

        yield* input.sql`
          insert into agent_messages (
            id,
            conversation_id,
            turn_id,
            product,
            role,
            message_index,
            status,
            parts_json,
            tool_call_id,
            tool_name,
            is_error,
            created_at,
            updated_at
          ) values (
            ${row.id},
            ${row.conversationId},
            ${row.turnId},
            ${row.product},
            ${row.role},
            ${row.messageIndex},
            ${row.status},
            ${sqlJson(input.sql, row.partsJson)},
            ${row.toolCallId ?? null},
            ${row.toolName ?? null},
            ${row.isError ?? null},
            ${row.createdAt},
            ${row.updatedAt}
          )
        `
        messageIndex += 1
      }
    }),
)

function persistableTurnJson(turnJson: AgentTurnEnvelope): AgentTurnEnvelope {
  return prepareAgentTurnEnvelopeForPersistence(turnJson)
}

export class AgentTurnStore extends ServiceMap.Service<
  AgentTurnStore,
  AgentTurnStoreShape
>()('agent/AgentTurnStore') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      return {
        createPendingTurn: Effect.fn('AgentTurnStore.createPendingTurn')((input) =>
          sql.withTransaction(
            Effect.gen(function* () {
              yield* lockConversationRow(sql, input.conversation.id)

              const startedAt = now()
              const turnIndex = yield* readNextTurnIndex(sql, input.conversation.id)
              const turnJson = persistableTurnJson({
                ...input.turnJson,
                turnIndex,
              })

              const record: AgentTurnRecord = {
                id: turnJson.turnId,
                conversationId: input.conversation.id,
                product: input.conversation.product,
                runtime: 'pi',
                status: 'pending',
                requestId: input.requestId,
                modelId: input.modelId,
                providerId: input.providerId,
                turnIndex,
                userMessageId: undefined,
                assistantMessageId: undefined,
                changeSetId: input.changeSetId,
                turnJson,
                errorJson: undefined,
                startedAt,
                completedAt: undefined,
                updatedAt: startedAt,
              }

              yield* sql`
                insert into agent_turns (
                  id,
                  conversation_id,
                  product,
                  runtime,
                  status,
                  request_id,
                  model_id,
                  provider_id,
                  turn_index,
                  user_message_id,
                  assistant_message_id,
                  change_set_id,
                  turn_json,
                  error_json,
                  started_at,
                  completed_at,
                  updated_at
                ) values (
                  ${record.id},
                  ${record.conversationId},
                  ${record.product},
                  ${record.runtime},
                  ${record.status},
                  ${record.requestId},
                  ${record.modelId ?? null},
                  ${record.providerId ?? null},
                  ${record.turnIndex},
                  ${record.userMessageId ?? null},
                  ${record.assistantMessageId ?? null},
                  ${record.changeSetId ?? null},
                  ${sqlJson(sql, record.turnJson)},
                  null,
                  ${record.startedAt},
                  null,
                  ${record.updatedAt}
                )
              `

              return record
            }),
          ).pipe(
            Effect.mapError((error) => toError('Failed to create agent turn', error)),
          ),
        ),
        checkpointTurn: Effect.fn('AgentTurnStore.checkpointTurn')((input) =>
          sql.withTransaction(
            Effect.gen(function* () {
              yield* lockConversationRow(sql, input.conversation.id)

              const updatedAt = now()
              const turnJson = persistableTurnJson(input.turnJson)

              yield* sql`
                update agent_turns
                set
                  status = ${input.status},
                  user_message_id = ${input.userMessageId ?? null},
                  assistant_message_id = ${input.assistantMessageId ?? null},
                  turn_json = ${sqlJson(sql, turnJson)},
                  updated_at = ${updatedAt}
                where id = ${input.turnId}
              `

              yield* persistProjectedMessages({
                sql,
                conversation: input.conversation,
                turnId: input.turnId,
                status: input.status,
                turnJson,
              })

              yield* sql`
                update agent_conversations
                set
                  updated_at = ${updatedAt},
                  last_message_at = ${updatedAt}
                where id = ${input.conversation.id}
              `
            }),
          ).pipe(
            Effect.mapError((error) =>
              toError('Failed to checkpoint agent turn', error),
            ),
          ),
        ),
        completeTurn: Effect.fn('AgentTurnStore.completeTurn')((input) =>
          sql.withTransaction(
            Effect.gen(function* () {
              yield* lockConversationRow(sql, input.conversation.id)

              const updatedAt = now()
              const turnJson = persistableTurnJson(input.turnJson)

              yield* sql`
                update agent_turns
                set
                  status = ${input.status},
                  user_message_id = ${input.userMessageId ?? null},
                  assistant_message_id = ${input.assistantMessageId ?? null},
                  turn_json = ${sqlJson(sql, turnJson)},
                  error_json = ${
                    input.errorJson ? sqlJson(sql, input.errorJson) : null
                  }::jsonb,
                  completed_at = ${updatedAt},
                  updated_at = ${updatedAt}
                where id = ${input.turnId}
              `

              yield* persistProjectedMessages({
                sql,
                conversation: input.conversation,
                turnId: input.turnId,
                status: input.status,
                turnJson,
              })

              yield* sql`
                update agent_conversations
                set
                  updated_at = ${updatedAt},
                  last_message_at = ${updatedAt}
                where id = ${input.conversation.id}
              `
            }),
          ).pipe(
            Effect.mapError((error) => toError('Failed to complete agent turn', error)),
          ),
        ),
      }
    }),
  )
}
