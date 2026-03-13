import type { UIMessage } from 'ai'
import { Effect } from 'effect'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'
import type { ChatAttachment } from '@/lib/shared/chat-contracts/attachments'
import { ORG_KNOWLEDGE_KIND } from '@/lib/shared/org-knowledge'
import { MessagePersistenceError } from '@/lib/backend/chat/domain/errors'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import type { OrgKnowledgeRepositoryService } from '@/lib/backend/org-knowledge/services/org-knowledge-repository.service'
import type { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import type { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import type {
  AttachmentRagService,
  OrgKnowledgeRagService,
} from '@/lib/backend/chat/services/rag'
import {
  buildAttachmentExcerptFallback,
  buildQueryEmbedding,
  getRetrievalLimits,
} from '@/lib/backend/chat/services/rag/attachment-content.pipeline'
import { resolveCanonicalBranch } from '@/lib/shared/chat-branching/branch-resolver'
import { requireMessagePersistenceDb } from '../../message-persistence-db'
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

type RetrievedContextChunk = {
  attachmentName: string
  mimeType: string
  content: string
}

/**
 * Formats retrieved user attachment excerpts as an inline prompt supplement.
 * These excerpts originate from files the user attached to the current thread,
 * so the model can treat them as directly user-provided evidence.
 */
function buildAttachmentContextBlock(
  label: string,
  chunks: readonly RetrievedContextChunk[],
): string {
  if (chunks.length === 0) return ''
  const sections = chunks.map(
    (chunk, index) =>
      `## ${label} ${index + 1}: ${chunk.attachmentName} (${chunk.mimeType})\n\n${chunk.content}`,
  )

  return [
    'User-provided attachment context is available below.',
    'These excerpts come from files attached by the user in this conversation, not from system or organization knowledge.',
    'Use them as supporting context for the next user request when relevant.',
    '',
    ...sections,
  ].join('\n\n')
}

/**
 * Formats retrieved organization knowledge excerpts as system-provided
 * background context. This makes the distinction explicit for the model:
 * org knowledge is not a user attachment and should only be used when it helps
 * answer the current request.
 */
function buildOrgKnowledgeContextBlock(
  label: string,
  chunks: readonly RetrievedContextChunk[],
): string {
  if (chunks.length === 0) return ''
  const sections = chunks.map(
    (chunk, index) =>
      `## ${label} ${index + 1}: ${chunk.attachmentName} (${chunk.mimeType})\n\n${chunk.content}`,
  )

  return [
    'System-provided organization knowledge is available below.',
    'These excerpts come from organization knowledge attachments configured by the system for the active organization, not from the user in this conversation.',
    'Use them only when they are relevant as supporting background context for the next user request.',
    '',
    '',
    ...sections,
  ].join('\n\n')
}

/**
 * Creates a synthetic system message that carries backend-supplied org
 * knowledge context. Keeping this separate from the user turn lets the model
 * distinguish tenant-level background knowledge from user-provided files.
 */
function buildSystemContextMessage(input: {
  readonly id: string
  readonly text: string
}): UIMessage {
  return {
    id: input.id,
    role: 'system',
    parts: [{ type: 'text', text: input.text }],
  }
}

export const makeLoadThreadMessagesOperation = (dependencies: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
  readonly attachmentRecord: AttachmentRecordService['Service']
  readonly attachmentRag: AttachmentRagService['Service']
  readonly orgKnowledgeRag: OrgKnowledgeRagService['Service']
  readonly orgKnowledgeRepository: OrgKnowledgeRepositoryService['Service']
}): MessageStoreServiceShape['loadThreadMessages'] => {
  /**
   * Loads canonical thread history and enriches the latest user turn with
   * fallback attachment context when the selected model cannot consume files natively.
   */
  const {
    zeroDatabase,
    attachmentRecord,
    attachmentRag,
    orgKnowledgeRag,
    orgKnowledgeRepository,
  } =
    dependencies

  return Effect.fn('MessageStoreService.loadThreadMessages')(
    ({ threadId, model, organizationId, orgPolicy, untilMessageId, requestId }) =>
      Effect.gen(function* () {
        const db = yield* requireMessagePersistenceDb({
          zeroDatabase,
          message: 'Failed to load messages',
          requestId,
          threadId,
        })

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
        const attachmentContentRows = yield* attachmentRecord
          .listAttachmentContentRowsByThread(threadId)
          .pipe(
            Effect.mapError(
              (error) =>
                new MessagePersistenceError({
                  message: 'Failed to load attachment content',
                  requestId,
                  threadId,
                  cause: String(error),
                }),
            ),
          )
        const attachmentContentById = new Map(
          attachmentContentRows.map((attachment) => [attachment.id, attachment]),
        )

        const { canonicalMessages: canonicalMessageRows } = resolveCanonicalBranch(
          messageRows.map((message) => ({
            messageId: message.messageId,
            role: message.role,
            parentMessageId: message.parentMessageId,
            branchIndex: message.branchIndex,
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
        let orgKnowledgeContextBlock = ''
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

            fallbackContextBlock = buildAttachmentContextBlock(
              'Source',
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
              ...[...fallbackAttachmentById.values()]
                .map((attachment) => {
                  const content = attachmentContentById.get(attachment.id)
                  if (!content) return null
                  return {
                    fileName: attachment.fileName,
                    mimeType: attachment.mimeType,
                    fileContent: content.fileContent,
                  }
                })
                .filter(
                  (
                    attachment,
                  ): attachment is {
                    fileName: string
                    mimeType: string
                    fileContent: string
                  } => !!attachment,
                ),
            ])
          }
        }

        if (
          latestUserText.trim().length > 0 &&
          organizationId &&
          orgPolicy?.orgKnowledgeEnabled
        ) {
          const retrievalLimits = getRetrievalLimits()
          const activeOrgAttachmentIds =
            yield* orgKnowledgeRepository
              .listActiveAttachmentIds({
                organizationId,
                requestId,
              })
              .pipe(
                Effect.catch((error) =>
                  Effect.logError('Failed to load active organization knowledge attachments', {
                    requestId,
                    threadId,
                    organizationId,
                    cause: error.cause ?? error.message,
                  }).pipe(Effect.as([])),
                ),
              )

          if (activeOrgAttachmentIds.length > 0) {
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
                      'Organization knowledge query embedding failed; skipping org knowledge retrieval',
                      {
                        requestId,
                        threadId,
                        organizationId,
                        cause: error.cause,
                      },
                    ).pipe(Effect.as(null))
                  : Effect.succeed(null),
              ),
            )

            const orgKnowledgeChunks = queryEmbedding
              ? yield* orgKnowledgeRag
                  .searchOrgKnowledge({
                    request: {
                      scopeType: 'org_knowledge',
                      ownerOrgId: organizationId,
                      sourceIds: activeOrgAttachmentIds,
                      queryEmbedding: queryEmbedding.embedding,
                      limit: retrievalLimits.maxChunks * 3,
                    },
                  })
                  .pipe(
                    Effect.catch((error) =>
                      Effect.logError('Organization knowledge retrieval failed; skipping org knowledge context', {
                        requestId,
                        threadId,
                        organizationId,
                        cause: String(error),
                      }).pipe(Effect.as([])),
                    ),
                  )
              : []

            if (orgKnowledgeChunks.length > 0) {
              const orgKnowledgeSourceIds = [...new Set(
                orgKnowledgeChunks.map((chunk) => chunk.sourceId)
              )]
              const orgKnowledgeRows = yield* Effect.tryPromise({
                try: () =>
                  db.run(
                    zql.attachment
                      .where('id', 'IN', orgKnowledgeSourceIds)
                      .where('ownerOrgId', organizationId)
                      .where('orgKnowledgeKind', ORG_KNOWLEDGE_KIND)
                      .where('orgKnowledgeActive', true)
                      .where('embeddingStatus', 'indexed')
                      .where('status', 'uploaded')
                      .orderBy('updatedAt', 'desc'),
                  ),
                catch: (error) =>
                  new MessagePersistenceError({
                    message: 'Failed to load organization knowledge attachment metadata',
                    requestId,
                    threadId,
                    cause: String(error),
                  }),
              })
              const orgKnowledgeById = new Map(
                orgKnowledgeRows.map((attachment) => [attachment.id, attachment]),
              )
              const selectedChunks: Array<(typeof orgKnowledgeChunks)[number]> = []
              let usedChars = 0
              for (const chunk of orgKnowledgeChunks) {
                if (selectedChunks.length >= retrievalLimits.maxChunks) break
                if (usedChars + chunk.content.length > retrievalLimits.maxChars) continue
                selectedChunks.push(chunk)
                usedChars += chunk.content.length
              }

              orgKnowledgeContextBlock = buildOrgKnowledgeContextBlock(
                'Organization source',
                selectedChunks
                  .map((chunk) => {
                    const attachment = orgKnowledgeById.get(chunk.sourceId)
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
            }
          }
        }

        const promptMessages = canonicalRows.map((message) => {
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
              ? [
                  message.content,
                  fallbackContextBlock,
                ]
                  .filter((value) => value.length > 0)
                  .join('\n\n')
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

        if (
          orgKnowledgeContextBlock.length === 0 ||
          !latestUserMessageRow ||
          !canonicalRowIdSet.has(latestUserMessageRow.messageId)
        ) {
          return promptMessages
        }

        const latestUserMessageIndex = promptMessages.findIndex(
          (message) => message.id === latestUserMessageRow.messageId,
        )
        if (latestUserMessageIndex < 0) {
          return promptMessages
        }

        const orgKnowledgeSystemMessage = buildSystemContextMessage({
          id: `system-org-knowledge-${latestUserMessageRow.messageId}`,
          text: orgKnowledgeContextBlock,
        })

        return [
          ...promptMessages.slice(0, latestUserMessageIndex),
          orgKnowledgeSystemMessage,
          ...promptMessages.slice(latestUserMessageIndex),
        ]
      }),
  )
}
