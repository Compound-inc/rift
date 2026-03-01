import type { UIMessage } from 'ai'
import { Effect } from 'effect'
import { getCatalogModel } from '@/lib/ai-catalog'
import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'
import type { ChatAttachment } from '@/lib/chat-contracts/attachments'
import { MessagePersistenceError } from '@/lib/chat-backend/domain/errors'
import { zql } from '@/lib/chat-backend/infra/zero/db'
import type { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'
import type { AttachmentRagService } from '@/lib/chat-backend/services/rag'
import {
  buildAttachmentExcerptFallback,
  buildQueryEmbedding,
  getRetrievalLimits,
} from '@/lib/chat-backend/services/rag/attachment-content.pipeline'
import { resolveCanonicalBranch } from '@/lib/chat-branching/branch-resolver'
import { normalizeThreadActiveChildMap } from '../helpers'
import type { MessageStoreServiceShape } from '../../message-store.service'

type QueryEmbeddingFallbackError = {
  readonly _tag: 'QueryEmbeddingFallbackError'
  readonly cause: string
}

type VectorRetrievalFallbackError = {
  readonly _tag: 'VectorRetrievalFallbackError'
  readonly cause: string
}

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

export const makeLoadThreadMessagesOperation = (dependencies: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
  readonly attachmentRag: AttachmentRagService['Service']
}): MessageStoreServiceShape['loadThreadMessages'] => {
  /**
   * Loads canonical thread history and enriches the latest user turn with
   * fallback attachment context when the selected model cannot consume files natively.
   */
  const { zeroDatabase, attachmentRag } = dependencies

  return Effect.fn('MessageStoreService.loadThreadMessages')(
    ({ threadId, model, untilMessageId, requestId }) =>
      Effect.gen(function* () {
        const db = yield* zeroDatabase.getOrFail.pipe(
          Effect.mapError(
            () =>
              new MessagePersistenceError({
                message: 'Failed to load messages',
                requestId,
                threadId,
                cause: 'ZERO_UPSTREAM_DB is not configured',
              }),
          ),
        )

        const messageRows = yield* Effect.tryPromise({
          try: () =>
            db.run(
              zql.message.where('threadId', threadId).orderBy('created_at', 'asc'),
            ),
          catch: (error) =>
            new MessagePersistenceError({
              message: 'Failed to load messages',
              requestId,
              threadId,
              cause: String(error),
            }),
        })

        const threadRow = yield* Effect.tryPromise({
          try: () => db.run(zql.thread.where('threadId', threadId).one()),
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
            db.run(zql.attachment.where('threadId', threadId).orderBy('createdAt', 'asc')),
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

        const { canonicalMessages: canonicalMessageRows } = resolveCanonicalBranch(
          messageRows.map((message) => ({
            messageId: message.messageId,
            role: message.role,
            parentMessageId: message.parentMessageId ?? undefined,
            branchIndex: message.branchIndex ?? 1,
            createdAt: message.created_at,
          })),
          normalizeThreadActiveChildMap(threadRow?.activeChildByParent),
        )

        const canonicalMessageIdSet = new Set(
          canonicalMessageRows.map((message) => message.messageId),
        )
        const messageById = new Map(
          messageRows.map((message) => [message.messageId, message]),
        )
        const canonicalOrderedRows = canonicalMessageRows
          .map((message) => messageById.get(message.messageId))
          .filter((message): message is NonNullable<typeof message> => !!message)

        const canonicalRows =
          untilMessageId && untilMessageId.trim().length > 0
            ? (() => {
                const endIndex = canonicalOrderedRows.findIndex(
                  (row) => row.messageId === untilMessageId,
                )
                return endIndex >= 0
                  ? canonicalOrderedRows.slice(0, endIndex + 1)
                  : canonicalOrderedRows
              })()
            : canonicalOrderedRows

        const canonicalRowIdSet = new Set(canonicalRows.map((row) => row.messageId))
        const modelCapabilities = getCatalogModel(model)?.capabilities

        const latestUserMessageRow = [...canonicalRows]
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
        if (latestUserText.trim().length > 0 && fallbackAttachmentById.size > 0) {
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
                      ? Effect.logError('Vector retrieval failed, using fallback excerpts', {
                          requestId,
                          threadId,
                          cause: error.cause,
                        }).pipe(Effect.as([]))
                      : Effect.succeed([]),
                  ),
                )
            : []

          if (rankedChunks.length > 0) {
            const selectedChunks: Array<(typeof rankedChunks)[number]> = []
            let usedChars = 0
            for (const chunk of rankedChunks) {
              if (selectedChunks.length >= retrievalLimits.maxChunks) break
              if (usedChars + chunk.content.length > retrievalLimits.maxChars) continue
              selectedChunks.push(chunk)
              usedChars += chunk.content.length
            }

            fallbackContextBlock = buildRetrievedChunksContextBlock(
              selectedChunks
                .map((chunk) => {
                  const attachment = fallbackAttachmentById.get(chunk.sourceId)
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

        return canonicalRows.map((message) => {
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
            canonicalMessageIdSet.has(message.messageId) &&
            canonicalRowIdSet.has(message.messageId) &&
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
              ...(message.role === 'assistant' ? { model: message.model } : {}),
              ...(attachmentMetadata.length > 0
                ? { attachments: attachmentMetadata }
                : {}),
            },
          }
        })
      }),
  )
}
