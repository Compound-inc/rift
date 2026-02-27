import type { UIMessage } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import { getCatalogModel } from '@/lib/ai-catalog'
import type { AiReasoningEffort } from '@/lib/ai-catalog/types'
import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'
import type {
  ChatAttachment,
  ChatAttachmentInput,
} from '@/lib/chat-contracts/attachments'
import { MessagePersistenceError } from '../domain/errors'
import type { IncomingUserMessage } from '../domain/schemas'
import { getUserMessageText } from '../domain/schemas'
import { getMemoryState } from '../infra/memory/state'
import { getZeroDatabase, zql } from '../infra/zero/db'
import { AttachmentRagService } from './rag'
import {
  buildQueryEmbedding,
  buildAttachmentExcerptFallback,
  getRetrievalLimits,
} from './rag/attachment-content.pipeline'

/**
 * Message persistence adapter backed by Zero + upstream Postgres.
 * Responsible for loading thread history and persisting user/assistant turns.
 */
export type MessageStoreServiceShape = {
  readonly loadThreadMessages: (input: {
    readonly threadId: string
    readonly model: string
    readonly requestId: string
  }) => Effect.Effect<UIMessage[], MessagePersistenceError>
  readonly appendUserMessage: (input: {
    readonly threadDbId: string
    readonly threadId: string
    readonly message: IncomingUserMessage
    readonly attachments?: readonly ChatAttachmentInput[]
    readonly userId: string
    readonly model: string
    readonly reasoningEffort?: AiReasoningEffort
    readonly modelParams?: {
      readonly reasoningEffort?: AiReasoningEffort
    }
    readonly requestId: string
  }) => Effect.Effect<UIMessage, MessagePersistenceError>
  readonly finalizeAssistantMessage: (input: {
    readonly threadDbId: string
    readonly threadModel: string
    readonly threadId: string
    readonly userId: string
    readonly assistantMessageId: string
    readonly ok: boolean
    readonly finalContent: string
    readonly reasoning?: string
    readonly errorMessage?: string
    readonly modelParams?: {
      readonly reasoningEffort?: AiReasoningEffort
    }
    readonly requestId: string
  }) => Effect.Effect<void, MessagePersistenceError>
}

export class MessageStoreService extends ServiceMap.Service<
  MessageStoreService,
  MessageStoreServiceShape
>()('chat-backend/MessageStoreService') {}

type QueryEmbeddingFallbackError = {
  readonly _tag: 'QueryEmbeddingFallbackError'
  readonly cause: string
}

type VectorRetrievalFallbackError = {
  readonly _tag: 'VectorRetrievalFallbackError'
  readonly cause: string
}

/** Converts validated inbound payload into UIMessage shape expected by AI SDK. */
const toUserMessage = (
  message: IncomingUserMessage,
  attachments: readonly ChatAttachment[] = [],
): UIMessage => ({
  id: message.id,
  role: 'user',
  parts: [{ type: 'text', text: getUserMessageText(message) }],
  metadata: attachments.length > 0 ? { attachments } : undefined,
})

function isImageMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/')
}

function isPdfMimeType(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase()
  return normalized === 'application/pdf' || normalized === 'application/x-pdf'
}

function supportsNativeAttachment(input: {
  readonly mimeType: string
  readonly capabilities: {
    readonly supportsImageInput: boolean
    readonly supportsPdfInput: boolean
    readonly supportsFileInput: boolean
  }
}): boolean {
  const { mimeType, capabilities } = input
  if (isImageMimeType(mimeType)) return capabilities.supportsImageInput
  if (isPdfMimeType(mimeType)) return capabilities.supportsPdfInput
  // Generic file support is intentionally ignored here:
  // non-image/PDF files should always use markdown fallback context.
  return false
}

function buildRetrievedChunksContextBlock(
  chunks: readonly {
    attachmentName: string
    mimeType: string
    content: string
  }[],
): string {
  if (chunks.length === 0) return ''
  const sections = chunks.map(
    (chunk, index) =>
      `## Source ${index + 1}: ${chunk.attachmentName} (${chunk.mimeType})\n\n${chunk.content}`,
  )
  return [
    'Use the following extracted file excerpts as supporting context for the next user request.',
    'If the user question is unrelated, ignore this context.',
    '',
    ...sections,
  ].join('\n\n')
}

/** Production message store implementation. */
export const MessageStoreZero = Layer.effect(
  MessageStoreService,
  Effect.gen(function* () {
    const attachmentRag = yield* AttachmentRagService

    return {
      loadThreadMessages: ({ threadId, model, requestId }) =>
        Effect.gen(function* () {
          const db = getZeroDatabase()
          if (!db) {
            return yield* Effect.fail(
              new MessagePersistenceError({
                message: 'Failed to load messages',
                requestId,
                threadId,
                cause: 'ZERO_UPSTREAM_DB is not configured',
              }),
            )
          }

          const messageRows = yield* Effect.tryPromise({
            try: () =>
              db.run(
                zql.message
                  .where('threadId', threadId)
                  .orderBy('created_at', 'asc'),
              ),
            catch: (error) =>
              new MessagePersistenceError({
                message: 'Failed to load messages',
                requestId,
                threadId,
                cause: String(error),
              }),
          })
          const attachmentRows = yield* Effect.tryPromise({
            try: () =>
              db.run(
                zql.attachment
                  .where('threadId', threadId)
                  .orderBy('createdAt', 'asc'),
              ),
            catch: (error) =>
              new MessagePersistenceError({
                message: 'Failed to load messages',
                requestId,
                threadId,
                cause: String(error),
              }),
          })

          const attachmentsById = new Map(
            attachmentRows.map((attachment) => [attachment.id, attachment]),
          )
          const modelCapabilities = getCatalogModel(model)?.capabilities
          const latestUserMessageRow = [...messageRows]
            .reverse()
            .find((row) => row.role === 'user')
          const latestUserText = latestUserMessageRow?.content ?? ''
          const fallbackAttachmentById = new Map(
            attachmentRows
              .filter((attachment) =>
                modelCapabilities
                  ? !supportsNativeAttachment({
                      mimeType: attachment.mimeType,
                      capabilities: modelCapabilities,
                    })
                  : true,
              )
              .map((attachment) => [attachment.id, attachment]),
          )

          let fallbackContextBlock = ''
          if (
            latestUserText.trim().length > 0 &&
            fallbackAttachmentById.size > 0
          ) {
            const retrievalLimits = getRetrievalLimits()
            const queryEmbedding = yield* Effect.tryPromise({
              try: () => buildQueryEmbedding(latestUserText),
              catch: (error): QueryEmbeddingFallbackError => ({
                _tag: 'QueryEmbeddingFallbackError',
                cause: String(error),
              }),
            }).pipe(
              Effect.catchTag('QueryEmbeddingFallbackError', (error) =>
                isEmbeddingFeatureEnabled()
                  ? Effect.logError(
                      'Embedding query generation failed, using fallback excerpts',
                      {
                        requestId,
                        threadId,
                        cause: error.cause,
                      },
                    ).pipe(Effect.as(null))
                  : Effect.succeed(null),
              ),
            )
            const rankedChunks = queryEmbedding
              ? yield* attachmentRag
                  .searchThreadAttachments({
                    request: {
                      scopeType: 'attachment',
                      threadId,
                      userId: latestUserMessageRow?.userId ?? '',
                      sourceIds: [...fallbackAttachmentById.keys()],
                      queryEmbedding: queryEmbedding.embedding,
                      limit: retrievalLimits.maxChunks * 3,
                    },
                  })
                  .pipe(
                    Effect.mapError(
                      (error): VectorRetrievalFallbackError => ({
                        _tag: 'VectorRetrievalFallbackError',
                        cause: String(error),
                      }),
                    ),
                    Effect.catchTag('VectorRetrievalFallbackError', (error) =>
                      isEmbeddingFeatureEnabled()
                        ? Effect.logError(
                            'Vector retrieval failed, using fallback excerpts',
                            {
                              requestId,
                              threadId,
                              cause: error.cause,
                            },
                          ).pipe(Effect.as([]))
                        : Effect.succeed([]),
                    ),
                  )
              : []

            if (rankedChunks.length > 0) {
              const selectedChunks: Array<(typeof rankedChunks)[number]> = []
              let usedChars = 0
              for (const chunk of rankedChunks) {
                if (selectedChunks.length >= retrievalLimits.maxChunks) break
                if (usedChars + chunk.content.length > retrievalLimits.maxChars)
                  continue
                selectedChunks.push(chunk)
                usedChars += chunk.content.length
              }

              fallbackContextBlock = buildRetrievedChunksContextBlock(
                selectedChunks
                  .map((chunk) => {
                    const attachment = fallbackAttachmentById.get(
                      chunk.sourceId,
                    )
                    if (!attachment) return null
                    return {
                      attachmentName: attachment.fileName,
                      mimeType: attachment.mimeType,
                      content: chunk.content,
                    }
                  })
                  .filter(
                    (
                      chunk,
                    ): chunk is {
                      attachmentName: string
                      mimeType: string
                      content: string
                    } => !!chunk,
                  ),
              )
            } else {
              fallbackContextBlock = buildAttachmentExcerptFallback([
                ...fallbackAttachmentById.values(),
              ])
            }
          }

          return messageRows.map((message) => {
            const attachmentIds = Array.isArray(message.attachmentsIds)
              ? message.attachmentsIds
              : []
            const linkedAttachments = attachmentIds
              .map((id) => attachmentsById.get(id))
              .filter((attachment) => !!attachment)
            const attachmentMetadata: ChatAttachment[] = linkedAttachments.map(
              (attachment) => ({
                id: attachment.id,
                key: attachment.fileKey,
                url: attachment.attachmentUrl,
                name: attachment.fileName,
                size: attachment.fileSize,
                contentType: attachment.mimeType,
              }),
            )
            const nativeAttachments =
              message.role === 'user'
                ? linkedAttachments.filter((attachment) =>
                    modelCapabilities
                      ? supportsNativeAttachment({
                          mimeType: attachment.mimeType,
                          capabilities: modelCapabilities,
                        })
                      : false,
                  )
                : []
            const modelText =
              message.role === 'user' &&
              latestUserMessageRow?.messageId === message.messageId &&
              fallbackContextBlock.length > 0
                ? `${message.content}\n\n${fallbackContextBlock}`
                : message.content
            const messageParts: UIMessage['parts'] = [
              { type: 'text', text: modelText },
              ...nativeAttachments.map((attachment) => ({
                type: 'file' as const,
                mediaType: attachment.mimeType,
                filename: attachment.fileName,
                url: attachment.attachmentUrl,
              })),
            ]

            return {
              id: message.messageId,
              role: message.role,
              parts: messageParts,
              metadata: {
                ...(message.role === 'assistant'
                  ? { model: message.model }
                  : {}),
                ...(attachmentMetadata.length > 0
                  ? { attachments: attachmentMetadata }
                  : {}),
              },
            }
          })
        }),
      appendUserMessage: ({
        threadDbId,
        threadId,
        message,
        attachments,
        userId,
        model,
        reasoningEffort,
        modelParams,
        requestId,
      }) =>
        Effect.gen(function* () {
          const db = getZeroDatabase()
          if (!db) {
            return yield* Effect.fail(
              new MessagePersistenceError({
                message: 'Failed to append user message',
                requestId,
                threadId,
                cause: 'ZERO_UPSTREAM_DB is not configured',
              }),
            )
          }

          const now = Date.now()
          const linkedAttachmentsForReturn: ChatAttachment[] = []
          const vectorLinks: Array<{
            attachmentId: string
            userId: string
            threadId: string
            messageId: string
            updatedAt: number
          }> = []

          yield* Effect.tryPromise({
            try: () =>
              db.transaction(async (tx) => {
                try {
                  const existing = await tx.run(
                    zql.message
                      .where('id', message.id)
                      .where('userId', userId)
                      .one(),
                  )
                  if (existing) return

                  const attachmentIds = (attachments ?? [])
                    .map((attachment) => attachment.id)
                    .filter((id) => id.trim().length > 0)
                  const linkedAttachments: ChatAttachment[] = []
                  for (const attachmentId of attachmentIds) {
                    const existingAttachment = await tx.run(
                      zql.attachment
                        .where('id', attachmentId)
                        .where('userId', userId)
                        .one(),
                    )
                    if (!existingAttachment) continue

                    linkedAttachments.push({
                      id: existingAttachment.id,
                      key: existingAttachment.fileKey,
                      url: existingAttachment.attachmentUrl,
                      name: existingAttachment.fileName,
                      size: existingAttachment.fileSize,
                      contentType: existingAttachment.mimeType,
                    })

                    await tx.mutate.attachment.update({
                      id: existingAttachment.id,
                      messageId: message.id,
                      threadId,
                      updatedAt: now,
                    })
                    vectorLinks.push({
                      attachmentId: existingAttachment.id,
                      userId,
                      threadId,
                      messageId: message.id,
                      updatedAt: now,
                    })
                  }
                  linkedAttachmentsForReturn.push(...linkedAttachments)

                  await tx.mutate.message.insert({
                    // Deterministic key makes retries naturally idempotent.
                    id: message.id,
                    messageId: message.id,
                    threadId,
                    userId,
                    content: getUserMessageText(message),
                    status: 'done',
                    role: 'user',
                    created_at: now,
                    updated_at: now,
                    model,
                    modelParams,
                    sources: linkedAttachments.map((attachment) => ({
                      sourceId: attachment.id,
                      url: attachment.url,
                      title: attachment.name,
                    })),
                    attachmentsIds: linkedAttachments.map(
                      (attachment) => attachment.id,
                    ),
                  })
                } catch {
                  // Duplicate insert on retry; row already exists.
                  return
                }

                await tx.mutate.thread.update({
                  id: threadDbId,
                  model,
                  reasoningEffort,
                  generationStatus: 'generation',
                  updatedAt: now,
                  lastMessageAt: now,
                })
              }),
            catch: (error) =>
              new MessagePersistenceError({
                message: 'Failed to append user message',
                requestId,
                threadId,
                cause: String(error),
              }),
          })

          for (const link of vectorLinks) {
            yield* attachmentRag
              .linkAttachmentToThread(link)
              .pipe(Effect.catch(() => Effect.void))
          }

          return toUserMessage(message, linkedAttachmentsForReturn)
        }),
      finalizeAssistantMessage: ({
        threadDbId,
        threadModel,
        threadId,
        userId,
        assistantMessageId,
        ok,
        finalContent,
        reasoning,
        errorMessage,
        modelParams,
        requestId,
      }) =>
        Effect.tryPromise({
          try: async () => {
            const db = getZeroDatabase()
            if (!db) {
              throw new Error('ZERO_UPSTREAM_DB is not configured')
            }

            const now = Date.now()
            await db.transaction(async (tx) => {
              const existing = await tx.run(
                zql.message
                  .where('id', assistantMessageId)
                  .where('userId', userId)
                  .one(),
              )

              if (existing) {
                // Update path is idempotent: retries finalize the same assistant row.
                const update: {
                  id: string
                  content: string
                  reasoning?: string
                  status: 'done' | 'error'
                  updated_at: number
                  modelParams?: { readonly reasoningEffort?: AiReasoningEffort }
                  serverError?: { type: string; message: string }
                } = {
                  id: existing.id,
                  content: finalContent,
                  reasoning,
                  status: ok ? 'done' : 'error',
                  updated_at: now,
                  modelParams,
                }

                if (!ok) {
                  update.serverError = {
                    type: 'stream_error',
                    message: errorMessage ?? 'Assistant stream failed',
                  }
                }

                await tx.mutate.message.update(update)
              } else {
                // Insert path handles first successful finalize for this assistant message.
                const insert: {
                  id: string
                  messageId: string
                  threadId: string
                  userId: string
                  content: string
                  reasoning?: string
                  status: 'done' | 'error'
                  role: 'assistant'
                  created_at: number
                  updated_at: number
                  model: string
                  modelParams?: { readonly reasoningEffort?: AiReasoningEffort }
                  attachmentsIds: readonly string[]
                  serverError?: { type: string; message: string }
                } = {
                  id: assistantMessageId,
                  messageId: assistantMessageId,
                  threadId,
                  userId,
                  content: finalContent,
                  reasoning,
                  status: ok ? 'done' : 'error',
                  role: 'assistant',
                  created_at: now,
                  updated_at: now,
                  model: threadModel,
                  modelParams,
                  attachmentsIds: [],
                }
                if (!ok) {
                  insert.serverError = {
                    type: 'stream_error',
                    message: errorMessage ?? 'Assistant stream failed',
                  }
                }
                await tx.mutate.message.insert(insert)
              }

              await tx.mutate.thread.update({
                id: threadDbId,
                generationStatus: ok ? 'completed' : 'failed',
                updatedAt: now,
                lastMessageAt: now,
              })
            })
          },
          catch: (error) =>
            new MessagePersistenceError({
              message: 'Failed to finalize assistant message',
              requestId,
              threadId,
              cause: String(error),
            }),
        }),
    }
  }),
)

/** Test-only adapter retained for deterministic unit tests. */
export const MessageStoreMemory = Layer.succeed(MessageStoreService, {
  loadThreadMessages: ({ threadId, model: _model, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      return existing.slice()
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to load messages',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),
  appendUserMessage: ({ threadId, message, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      const uiMessage = toUserMessage(message, [])
      existing.push(uiMessage)
      return uiMessage
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to append user message',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),
  finalizeAssistantMessage: ({
    threadId,
    assistantMessageId,
    finalContent,
    reasoning,
    requestId,
  }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      const target = existing.find(
        (message) => message.id === assistantMessageId,
      )
      if (!target) {
        const parts: UIMessage['parts'] = []
        if (reasoning && reasoning.trim().length > 0) {
          parts.push({ type: 'reasoning', text: reasoning, state: 'done' })
        }
        parts.push({ type: 'text', text: finalContent })
        existing.push({
          id: assistantMessageId,
          role: 'assistant',
          parts,
        })
        return
      }
      const parts: UIMessage['parts'] = []
      if (reasoning && reasoning.trim().length > 0) {
        parts.push({ type: 'reasoning', text: reasoning, state: 'done' })
      }
      parts.push({ type: 'text', text: finalContent })
      target.parts = parts
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to finalize assistant message',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),
})
