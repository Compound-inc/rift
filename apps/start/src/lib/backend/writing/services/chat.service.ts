import { Effect, Layer, ServiceMap } from 'effect'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import { ZeroDatabaseNotConfiguredError, ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { WRITING_DEFAULT_MODEL_ID } from '@/lib/shared/writing/constants'
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

export type WritingChatServiceShape = {
  readonly createProjectChat: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly title?: string
    readonly modelId?: string
    readonly requestId: string
  }) => Effect.Effect<{ readonly chatId: string }, WritingProjectNotFoundError | WritingPersistenceError>
  readonly appendMessage: (input: {
    readonly projectId: string
    readonly chatId: string
    readonly userId: string
    readonly organizationId?: string
    readonly role: 'user' | 'assistant' | 'system'
    readonly content: string
    readonly status?: 'pending' | 'done' | 'error'
    readonly metadataJson?: Record<string, unknown>
    readonly changeSetId?: string
    readonly requestId: string
  }) => Effect.Effect<{ readonly messageId: string }, WritingProjectNotFoundError | WritingChatNotFoundError | WritingPersistenceError>
  readonly updateAssistantChangeSet: (input: {
    readonly projectId: string
    readonly chatId: string
    readonly messageId: string
    readonly changeSetId?: string
    readonly requestId: string
  }) => Effect.Effect<void, WritingChatNotFoundError | WritingPersistenceError>
}

export class WritingChatService extends ServiceMap.Service<
  WritingChatService,
  WritingChatServiceShape
>()('writing-backend/WritingChatService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService

      const createProjectChat: WritingChatServiceShape['createProjectChat'] = Effect.fn(
        'WritingChatService.createProjectChat',
      )(({ projectId, userId, organizationId, title, modelId, requestId }) =>
        zeroDatabase
          .withDatabase((db) =>
            Effect.tryPromise({
              try: async () => {
                const project = await getScopedProject({
                  db,
                  projectId,
                  userId,
                  organizationId,
                })
                if (!project) {
                  throw new WritingProjectNotFoundError({
                    message: 'Writing project not found',
                    requestId,
                    projectId,
                  })
                }

                const createdAt = now()
                const chatId = crypto.randomUUID()
                await db.transaction(async (tx) => {
                  await tx.mutate.writingProjectChat.insert({
                    id: chatId,
                    projectId,
                    ownerUserId: userId,
                    title: title?.trim() || 'New chat',
                    modelId: modelId?.trim() || WRITING_DEFAULT_MODEL_ID,
                    status: 'active',
                    createdAt,
                    updatedAt: createdAt,
                    lastMessageAt: createdAt,
                  })

                  await tx.mutate.writingProject.update({
                    id: projectId,
                    updatedAt: createdAt,
                  })
                })

                return { chatId }
              },
              catch: (error) =>
                error instanceof WritingProjectNotFoundError
                  ? error
                  : toPersistenceError(requestId, 'Failed to create writing chat', error),
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof ZeroDatabaseNotConfiguredError
                ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                : error,
            ),
          ),
      )

      const appendMessage: WritingChatServiceShape['appendMessage'] = Effect.fn(
        'WritingChatService.appendMessage',
      )(
        ({
          projectId,
          chatId,
          userId,
          organizationId,
          role,
          content,
          status,
          metadataJson,
          changeSetId,
          requestId,
        }) =>
          zeroDatabase
            .withDatabase((db) =>
              Effect.tryPromise({
                try: async () => {
                  const project = await getScopedProject({
                    db,
                    projectId,
                    userId,
                    organizationId,
                  })
                  if (!project) {
                    throw new WritingProjectNotFoundError({
                      message: 'Writing project not found',
                      requestId,
                      projectId,
                    })
                  }

                  const chat = await getProjectChat({
                    db,
                    chatId,
                    projectId,
                  })
                  if (!chat) {
                    throw new WritingChatNotFoundError({
                      message: 'Writing chat not found',
                      requestId,
                      chatId,
                    })
                  }

                  const createdAt = now()
                  const messageId = crypto.randomUUID()
                  await db.transaction(async (tx) => {
                    await tx.mutate.writingChatMessage.insert({
                      id: messageId,
                      chatId,
                      projectId,
                      role,
                      content,
                      status: status ?? 'done',
                      metadataJson: (metadataJson ?? {}) as any,
                      changeSetId,
                      createdAt,
                      updatedAt: createdAt,
                    })

                    await tx.mutate.writingProjectChat.update({
                      id: chatId,
                      updatedAt: createdAt,
                      lastMessageAt: createdAt,
                    })

                    await tx.mutate.writingProject.update({
                      id: projectId,
                      updatedAt: createdAt,
                    })
                  })

                  return { messageId }
                },
                catch: (error) => {
                  if (
                    error instanceof WritingProjectNotFoundError ||
                    error instanceof WritingChatNotFoundError
                  ) {
                    return error
                  }
                  return toPersistenceError(requestId, 'Failed to append writing message', error)
                },
              }),
            )
            .pipe(
              Effect.mapError((error) =>
                error instanceof ZeroDatabaseNotConfiguredError
                  ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                  : error,
              ),
            ),
      )

      const updateAssistantChangeSet: WritingChatServiceShape['updateAssistantChangeSet'] =
        Effect.fn('WritingChatService.updateAssistantChangeSet')(
          ({ projectId, chatId, messageId, changeSetId, requestId }) =>
            zeroDatabase
              .withDatabase((db) =>
                Effect.tryPromise({
                  try: async () => {
                    const chat = await getProjectChat({
                      db,
                      chatId,
                      projectId,
                    })
                    if (!chat) {
                      throw new WritingChatNotFoundError({
                        message: 'Writing chat not found',
                        requestId,
                        chatId,
                      })
                    }

                    const message = await db.run(
                      zql.writingChatMessage
                        .where('id', messageId)
                        .where('chatId', chatId)
                        .one(),
                    )
                    if (!message) {
                      throw new WritingChatNotFoundError({
                        message: 'Writing message not found',
                        requestId,
                        chatId,
                      })
                    }

                    await db.transaction(async (tx) => {
                      await tx.mutate.writingChatMessage.update({
                        id: messageId,
                        changeSetId,
                        updatedAt: now(),
                      })
                    })
                  },
                  catch: (error) =>
                    error instanceof WritingChatNotFoundError
                      ? error
                      : toPersistenceError(
                          requestId,
                          'Failed to attach the assistant change set',
                          error,
                        ),
                }),
              )
              .pipe(
                Effect.mapError((error) =>
                  error instanceof ZeroDatabaseNotConfiguredError
                    ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                    : error,
                ),
              ),
        )

      return {
        createProjectChat,
        appendMessage,
        updateAssistantChangeSet,
      }
    }),
  )
}
