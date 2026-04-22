import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { AgentSessionStore } from '@/lib/backend/agent'
import {
  WritingPersistenceError,
  WritingProjectNotFoundError,
  WritingChatNotFoundError,
} from '../domain/errors'
import { getProjectConversationSql } from './persistence'
import { WritingProjectService } from './project.service'

function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export type WritingAgentSessionRecord = {
  readonly conversationId: string
  readonly runtime: string
  readonly sessionJson: string
  readonly createdAt: number
  readonly updatedAt: number
}

export type WritingAgentSessionServiceShape = {
  readonly loadConversationSession: (input: {
    readonly projectId: string
    readonly conversationId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<
    WritingAgentSessionRecord | null,
    | WritingProjectNotFoundError
    | WritingChatNotFoundError
    | WritingPersistenceError
  >
  readonly saveConversationSession: (input: {
    readonly projectId: string
    readonly conversationId: string
    readonly userId: string
    readonly organizationId?: string
    readonly sessionJson: string
    readonly requestId: string
  }) => Effect.Effect<
    void,
    | WritingProjectNotFoundError
    | WritingChatNotFoundError
    | WritingPersistenceError
  >
}

export class WritingAgentSessionService extends ServiceMap.Service<
  WritingAgentSessionService,
  WritingAgentSessionServiceShape
>()('writing-backend/WritingAgentSessionService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const projects = yield* WritingProjectService
      const sessions = yield* AgentSessionStore

      const assertScopedConversation = Effect.fn(
        'WritingAgentSessionService.assertScopedConversation',
      )(
        ({
          projectId,
          conversationId,
          userId,
          organizationId,
          requestId,
        }: {
          readonly projectId: string
          readonly conversationId: string
          readonly userId: string
          readonly organizationId?: string
          readonly requestId: string
        }) =>
          Effect.gen(function* () {
            yield* projects.getProject({
              projectId,
              userId,
              organizationId,
              requestId,
            })

            const conversation = yield* getProjectConversationSql({
              conversationId,
              projectId,
            }).pipe(
              Effect.provideService(PgClient.PgClient, sql),
              Effect.mapError((error) =>
                toPersistenceError(
                  requestId,
                  'Failed to validate writing conversation scope',
                  error,
                ),
              ),
            )

            if (!conversation) {
              return yield* Effect.fail(
                new WritingChatNotFoundError({
                  message: 'Writing conversation not found',
                  requestId,
                  chatId: conversationId,
                }),
              )
            }
          }),
      )

      return {
        loadConversationSession: Effect.fn(
        'WritingAgentSessionService.loadConversationSession',
        )(({ projectId, conversationId, userId, organizationId, requestId }) =>
          Effect.gen(function* () {
            yield* assertScopedConversation({
              projectId,
              conversationId,
              userId,
              organizationId,
              requestId,
            })

            const row = yield* sessions.loadSession({
              conversationId,
              runtime: 'pi',
            }).pipe(
              Effect.mapError((error) =>
                toPersistenceError(
                  requestId,
                  'Failed to load writing agent session',
                  error,
                ),
              ),
            )

            return row as WritingAgentSessionRecord | null
          }),
        ),
        saveConversationSession: Effect.fn(
          'WritingAgentSessionService.saveConversationSession',
        )(({ projectId, conversationId, userId, organizationId, sessionJson, requestId }) =>
          Effect.gen(function* () {
            yield* assertScopedConversation({
              projectId,
              conversationId,
              userId,
              organizationId,
              requestId,
            })

            yield* sessions.saveSession({
              conversationId,
              runtime: 'pi',
              sessionJson,
            }).pipe(
              Effect.mapError((error) =>
                toPersistenceError(
                  requestId,
                  'Failed to save writing agent session',
                  error,
                ),
              ),
            )
          }),
        ),
      }
    }),
  )
}
