import { Effect, Layer, ServiceMap } from 'effect'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import {
  ZeroDatabaseNotConfiguredError,
  ZeroDatabaseService,
} from '@/lib/backend/server-effect/services/zero-database.service'
import {
  WritingChatNotFoundError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import { getProjectChat, getScopedProject, now } from './persistence'

function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export type WritingAgentSessionRecord = {
  readonly chatId: string
  readonly projectId: string
  readonly sessionJsonl: string
  readonly createdAt: number
  readonly updatedAt: number
}

export type WritingAgentSessionServiceShape = {
  readonly loadChatSession: (input: {
    readonly projectId: string
    readonly chatId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<
    WritingAgentSessionRecord | null,
    | WritingProjectNotFoundError
    | WritingChatNotFoundError
    | WritingPersistenceError
  >
  readonly saveChatSession: (input: {
    readonly projectId: string
    readonly chatId: string
    readonly userId: string
    readonly organizationId?: string
    readonly sessionJsonl: string
    readonly requestId: string
  }) => Effect.Effect<
    void,
    | WritingProjectNotFoundError
    | WritingChatNotFoundError
    | WritingPersistenceError
  >
}

/**
 * Keeps PI native session JSONL beside writing chats so each request can reopen
 * exact session state through SessionManager.open(), including tool history and
 * any PI-managed metadata.
 */
export class WritingAgentSessionService extends ServiceMap.Service<
  WritingAgentSessionService,
  WritingAgentSessionServiceShape
>()('writing-backend/WritingAgentSessionService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService

      const assertScopedChat = async (input: {
        readonly db: any
        readonly projectId: string
        readonly chatId: string
        readonly userId: string
        readonly organizationId?: string
        readonly requestId: string
      }) => {
        const project = await getScopedProject({
          db: input.db,
          projectId: input.projectId,
          userId: input.userId,
          organizationId: input.organizationId,
        })
        if (!project) {
          throw new WritingProjectNotFoundError({
            message: 'Writing project not found',
            requestId: input.requestId,
            projectId: input.projectId,
          })
        }

        const chat = await getProjectChat({
          db: input.db,
          chatId: input.chatId,
          projectId: input.projectId,
        })
        if (!chat) {
          throw new WritingChatNotFoundError({
            message: 'Writing chat not found',
            requestId: input.requestId,
            chatId: input.chatId,
          })
        }
      }

      const loadChatSession: WritingAgentSessionServiceShape['loadChatSession'] =
        Effect.fn('WritingAgentSessionService.loadChatSession')(
          ({ projectId, chatId, userId, organizationId, requestId }) =>
            zeroDatabase
              .withDatabase((db) =>
                Effect.tryPromise({
                  try: async () => {
                    await assertScopedChat({
                      db,
                      projectId,
                      chatId,
                      userId,
                      organizationId,
                      requestId,
                    })

                    const row = await db.run(
                      zql.writingChatSession
                        .where('chatId', chatId)
                        .where('projectId', projectId)
                        .one(),
                    )

                    return (row as WritingAgentSessionRecord | null) ?? null
                  },
                  catch: (error) => {
                    if (
                      error instanceof WritingProjectNotFoundError ||
                      error instanceof WritingChatNotFoundError
                    ) {
                      return error
                    }
                    return toPersistenceError(
                      requestId,
                      'Failed to load writing agent session',
                      error,
                    )
                  },
                }),
              )
              .pipe(
                Effect.mapError((error) =>
                  error instanceof ZeroDatabaseNotConfiguredError
                    ? toPersistenceError(
                        requestId,
                        'Writing storage is unavailable',
                        error,
                      )
                    : error,
                ),
              ),
        )

      const saveChatSession: WritingAgentSessionServiceShape['saveChatSession'] =
        Effect.fn('WritingAgentSessionService.saveChatSession')(
          ({
            projectId,
            chatId,
            userId,
            organizationId,
            sessionJsonl,
            requestId,
          }) =>
            zeroDatabase
              .withDatabase((db) =>
                Effect.tryPromise({
                  try: async () => {
                    await assertScopedChat({
                      db,
                      projectId,
                      chatId,
                      userId,
                      organizationId,
                      requestId,
                    })

                    const existing = await db.run(
                      zql.writingChatSession
                        .where('chatId', chatId)
                        .where('projectId', projectId)
                        .one(),
                    )

                    const persistedAt = now()
                    await db.transaction(async (tx) => {
                      if (existing) {
                        await tx.mutate.writingChatSession.update({
                          chatId,
                          projectId,
                          sessionJsonl,
                          updatedAt: persistedAt,
                        })
                        return
                      }

                      await tx.mutate.writingChatSession.insert({
                        chatId,
                        projectId,
                        sessionJsonl,
                        createdAt: persistedAt,
                        updatedAt: persistedAt,
                      })
                    })
                  },
                  catch: (error) => {
                    if (
                      error instanceof WritingProjectNotFoundError ||
                      error instanceof WritingChatNotFoundError
                    ) {
                      return error
                    }
                    return toPersistenceError(
                      requestId,
                      'Failed to save writing agent session',
                      error,
                    )
                  },
                }),
              )
              .pipe(
                Effect.mapError((error) =>
                  error instanceof ZeroDatabaseNotConfiguredError
                    ? toPersistenceError(
                        requestId,
                        'Writing storage is unavailable',
                        error,
                      )
                    : error,
                ),
              ),
        )

      return {
        loadChatSession,
        saveChatSession,
      }
    }),
  )
}
