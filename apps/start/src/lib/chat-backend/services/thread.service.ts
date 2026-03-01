import { Effect, Layer, ServiceMap } from 'effect'
import { generateText } from 'ai'
import { CHAT_DEFAULT_MODEL_ID } from '@/lib/ai-catalog'
import type { AiReasoningEffort } from '@/lib/ai-catalog/types'
import {
  MessagePersistenceError,
  ThreadForbiddenError,
  ThreadNotFoundError,
} from '../domain/errors'
import { getMemoryState } from '../infra/memory/state'
import { zql } from '../infra/zero/db'
import { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'

/**
 * Thread lifecycle and authorization checks.
 * This implementation persists directly to Zero's upstream Postgres database.
 */
export type ThreadServiceShape = {
  readonly createThread: (input: {
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly threadId: string; readonly createdAt: number },
    MessagePersistenceError
  >
  readonly assertThreadAccess: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
    readonly createIfMissing?: boolean
  }) => Effect.Effect<
    {
      readonly dbId: string
      readonly threadId: string
      readonly userId: string
      readonly model: string
      readonly reasoningEffort?: AiReasoningEffort
      readonly generationStatus:
        | 'pending'
        | 'generation'
        | 'completed'
        | 'failed'
      readonly branchVersion: number
    },
    ThreadNotFoundError | ThreadForbiddenError | MessagePersistenceError
  >
  readonly autoGenerateTitle: (input: {
    readonly userId: string
    readonly threadId: string
    readonly userMessage: string
    readonly requestId: string
  }) => Effect.Effect<void, MessagePersistenceError>
  readonly markThreadGenerationFailed: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
  }) => Effect.Effect<void, MessagePersistenceError>
}

export class ThreadService extends ServiceMap.Service<
  ThreadService,
  ThreadServiceShape
>()('chat-backend/ThreadService') {
  /** Zero-backed thread service. */
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService

      const loadDb = Effect.fn('ThreadService.loadDb')(function* ({
        requestId,
        threadId,
      }: {
        readonly requestId: string
        readonly threadId: string
      }) {
        return yield* zeroDatabase.getOrFail.pipe(
          Effect.mapError(
            () =>
              new MessagePersistenceError({
                message: 'Thread storage is unavailable',
                requestId,
                threadId,
                cause: 'ZERO_UPSTREAM_DB is not configured',
              }),
          ),
        )
      })

      const createThread = Effect.fn('ThreadService.createThread')(
        ({
          userId,
          requestId,
        }: {
          readonly userId: string
          readonly requestId: string
        }) =>
          Effect.gen(function* () {
            const db = yield* loadDb({ requestId, threadId: 'new-thread' })
            const now = Date.now()
            const threadId = crypto.randomUUID()

            // Use a UUID primary key for the SQL row and a public threadId for routing.
            yield* Effect.tryPromise({
              try: async () => {
                await db.transaction(async (tx) => {
                  await tx.mutate.thread.insert({
                    id: crypto.randomUUID(),
                    threadId,
                    title: 'Nuevo Chat',
                    createdAt: now,
                    updatedAt: now,
                    lastMessageAt: now,
                    generationStatus: 'pending',
                    visibility: 'visible',
                    userSetTitle: false,
                    userId,
                    model: DEFAULT_THREAD_MODEL,
                    reasoningEffort: undefined,
                    pinned: false,
                    allowAttachments: true,
                    activeChildByParent: {},
                    branchVersion: 1,
                  })
                })
              },
              catch: (error) =>
                new MessagePersistenceError({
                  message: 'Failed to create thread',
                  requestId,
                  threadId: 'new-thread',
                  cause: String(error),
                }),
            })

            return { threadId, createdAt: now }
          }),
      )

      const assertThreadAccess = Effect.fn('ThreadService.assertThreadAccess')(
        ({
          userId,
          threadId,
          requestId,
          createIfMissing,
        }: {
          readonly userId: string
          readonly threadId: string
          readonly requestId: string
          readonly createIfMissing?: boolean
        }) =>
          Effect.gen(function* () {
            const db = yield* loadDb({ requestId, threadId })

            const thread = yield* Effect.tryPromise({
              try: async () => {
                const now = Date.now()
                let current = await db.run(
                  zql.thread.where('threadId', threadId).one(),
                )
                if (!current) {
                  if (!createIfMissing) {
                    throw new ThreadNotFoundError({
                      message: 'Thread not found',
                      requestId,
                      threadId,
                    })
                  }

                  try {
                    await db.transaction(async (tx) => {
                      // Uses deterministic IDs so first-message bootstrap can be retried safely.
                      await tx.mutate.thread.insert({
                        id: threadId,
                        threadId,
                        title: 'Nuevo Chat',
                        createdAt: now,
                        updatedAt: now,
                        lastMessageAt: now,
                        generationStatus: 'pending',
                        visibility: 'visible',
                        userSetTitle: false,
                        userId,
                        model: DEFAULT_THREAD_MODEL,
                        reasoningEffort: undefined,
                        pinned: false,
                        allowAttachments: true,
                        activeChildByParent: {},
                        branchVersion: 1,
                      })
                    })
                  } catch {
                    // Another writer may have created this thread concurrently.
                  }

                  current = await db.run(
                    zql.thread.where('threadId', threadId).one(),
                  )
                  if (!current) {
                    throw new Error('Thread was not created')
                  }
                }

                return current
              },
              catch: (error) => {
                if (error instanceof ThreadNotFoundError) {
                  return error
                }
                return new MessagePersistenceError({
                  message: 'Failed to validate thread access',
                  requestId,
                  threadId,
                  cause: String(error),
                })
              },
            })

            if (thread.userId !== userId) {
              return yield* Effect.fail(
                new ThreadForbiddenError({
                  message: 'Thread is not owned by user',
                  requestId,
                  threadId,
                  userId,
                }),
              )
            }

            return {
              dbId: thread.id,
              threadId: thread.threadId,
              userId: thread.userId,
              model: thread.model,
              reasoningEffort: thread.reasoningEffort ?? undefined,
              generationStatus: thread.generationStatus,
              branchVersion: thread.branchVersion,
            }
          }),
      )

      const autoGenerateTitle = Effect.fn('ThreadService.autoGenerateTitle')(
        ({
          userId,
          threadId,
          userMessage,
          requestId,
        }: {
          readonly userId: string
          readonly threadId: string
          readonly userMessage: string
          readonly requestId: string
        }) =>
          Effect.gen(function* () {
            const db = yield* loadDb({ requestId, threadId })
            const trimmedMessage = trimUserMessage(userMessage)
            if (!trimmedMessage) return

            const thread = yield* Effect.tryPromise({
              try: () => db.run(zql.thread.where('threadId', threadId).one()),
              catch: (error) =>
                new MessagePersistenceError({
                  message: 'Failed to auto-generate thread title',
                  requestId,
                  threadId,
                  cause: String(error),
                }),
            })
            if (!thread) return
            if (thread.userId !== userId) return
            if (thread.userSetTitle) return
            if (thread.title !== DEFAULT_THREAD_TITLE) return

            const generation = yield* Effect.tryPromise({
              try: async () => {
                const { openai } = await import('@ai-sdk/openai')
                const titleModel = DEFAULT_THREAD_MODEL.startsWith('openai/')
                  ? DEFAULT_THREAD_MODEL.slice('openai/'.length)
                  : DEFAULT_THREAD_MODEL
                return generateText({
                  model: openai(titleModel),
                  prompt: `You are an expert title generator. You are given a message and you need to generate a short title based on it.
- you will generate a short 3-4 words title based on the first message a user begins a conversation with
- the title should creative and unique
- do not write anything other than the title
- do not use quotes or colons
- do not use any other text other than the title
- the title should be in same language as the user message
User message: ${trimmedMessage}`,
                  temperature: 0.5,
                  maxOutputTokens: 50,
                })
              },
              catch: (error) =>
                new MessagePersistenceError({
                  message: 'Failed to auto-generate thread title',
                  requestId,
                  threadId,
                  cause: String(error),
                }),
            })

            const cleanTitle = cleanGeneratedTitle(generation.text)
            const finalTitle = cleanTitle || DEFAULT_THREAD_TITLE
            if (finalTitle === DEFAULT_THREAD_TITLE) return

            yield* Effect.tryPromise({
              try: async () => {
                await db.transaction(async (tx) => {
                  await tx.mutate.thread.update({
                    id: thread.id,
                    title: finalTitle,
                    updatedAt: Date.now(),
                  })
                })
              },
              catch: (error) =>
                new MessagePersistenceError({
                  message: 'Failed to auto-generate thread title',
                  requestId,
                  threadId,
                  cause: String(error),
                }),
            })
          }),
      )

      const markThreadGenerationFailed = Effect.fn(
        'ThreadService.markThreadGenerationFailed',
      )(
        ({
          userId,
          threadId,
          requestId,
        }: {
          readonly userId: string
          readonly threadId: string
          readonly requestId: string
        }) =>
          Effect.gen(function* () {
            const db = yield* loadDb({ requestId, threadId })
            const thread = yield* Effect.tryPromise({
              try: () => db.run(zql.thread.where('threadId', threadId).one()),
              catch: (error) =>
                new MessagePersistenceError({
                  message: 'Failed to mark thread as failed',
                  requestId,
                  threadId,
                  cause: String(error),
                }),
            })
            if (!thread) return
            if (thread.userId !== userId) return

            if (
              thread.generationStatus !== 'pending' &&
              thread.generationStatus !== 'generation'
            ) {
              return
            }

            const now = Date.now()
            yield* Effect.tryPromise({
              try: async () => {
                await db.transaction(async (tx) => {
                  await tx.mutate.thread.update({
                    id: thread.id,
                    generationStatus: 'failed',
                    updatedAt: now,
                    lastMessageAt: now,
                  })
                })
              },
              catch: (error) =>
                new MessagePersistenceError({
                  message: 'Failed to mark thread as failed',
                  requestId,
                  threadId,
                  cause: String(error),
                }),
            })
          }),
      )

      return {
        createThread,
        assertThreadAccess,
        autoGenerateTitle,
        markThreadGenerationFailed,
      }
    }),
  )

  // Test-only adapter retained for deterministic unit tests.
  static readonly layerMemory = Layer.succeed(this, {
    createThread: Effect.fn('ThreadService.createThreadMemory')(
      ({ userId }: { readonly userId: string }) =>
        Effect.sync(() => {
          const now = Date.now()
          const threadId = crypto.randomUUID()
          getMemoryState().threads.set(threadId, {
            threadId,
            userId,
            createdAt: now,
            updatedAt: now,
          })
          getMemoryState().messages.set(threadId, [])
          return { threadId, createdAt: now }
        }),
    ),
    assertThreadAccess: Effect.fn('ThreadService.assertThreadAccessMemory')(
      function* ({
        userId,
        threadId,
        requestId,
        createIfMissing,
      }: {
        readonly userId: string
        readonly threadId: string
        readonly requestId: string
        readonly createIfMissing?: boolean
      }) {
        let thread = getMemoryState().threads.get(threadId)
        if (!thread) {
          if (!createIfMissing) {
            return yield* Effect.fail(
              new ThreadNotFoundError({
                message: 'Thread not found',
                requestId,
                threadId,
              }),
            )
          }
          const now = Date.now()
          const created = {
            threadId,
            userId,
            createdAt: now,
            updatedAt: now,
          }
          getMemoryState().threads.set(threadId, created)
          getMemoryState().messages.set(threadId, [])
          thread = created
        }
        if (thread.userId !== userId) {
          return yield* Effect.fail(
            new ThreadForbiddenError({
              message: 'Thread is not owned by user',
              requestId,
              threadId,
              userId,
            }),
          )
        }
        return {
          dbId: thread.threadId,
          threadId: thread.threadId,
          userId: thread.userId,
          model: DEFAULT_THREAD_MODEL,
          reasoningEffort: undefined,
          generationStatus: 'completed' as const,
          branchVersion: 1,
        }
      },
    ),
    autoGenerateTitle: Effect.fn('ThreadService.autoGenerateTitleMemory')(
      () => Effect.void,
    ),
    markThreadGenerationFailed: Effect.fn(
      'ThreadService.markThreadGenerationFailedMemory',
    )(() => Effect.void),
  })
}

/** Fixed thread model stored for traceability; runtime selection is enforced elsewhere. */
const DEFAULT_THREAD_MODEL = CHAT_DEFAULT_MODEL_ID
const DEFAULT_THREAD_TITLE = 'Nuevo Chat'
const MAX_USER_MESSAGE_LENGTH = 200
const MAX_TITLE_WORDS = 8
const MAX_TITLE_LENGTH = 50

/** Limits prompt size sent to title generation without losing first-message intent. */
function trimUserMessage(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length <= MAX_USER_MESSAGE_LENGTH) {
    return trimmed
  }
  return `${trimmed.slice(0, MAX_USER_MESSAGE_LENGTH)}...`
}

/** Sanitizes generated titles to short plain text for consistent sidebar rendering. */
function cleanGeneratedTitle(text: string): string {
  return text
    .replace(/[#*_`"'~-]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, MAX_TITLE_WORDS)
    .join(' ')
    .slice(0, MAX_TITLE_LENGTH)
}
