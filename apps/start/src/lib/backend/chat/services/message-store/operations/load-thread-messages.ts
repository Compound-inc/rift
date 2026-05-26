import type { UIMessage } from 'ai'
import { Effect } from 'effect'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
import type {
  ChatAttachment,
  ChatAttachmentInput,
} from '@/lib/shared/chat-contracts/attachments'
import { MessagePersistenceError } from '@/lib/backend/chat/domain/errors'
import { getUserMessageText } from '@/lib/backend/chat/domain/schemas'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import type { OrgKnowledgeRepositoryService } from '@/lib/backend/org-knowledge/services/org-knowledge-repository.service'
import type { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import type { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import type {
  AttachmentRagService,
  OrgKnowledgeRagService,
  ProjectSourceRagService,
} from '@/lib/backend/chat/services/rag'
import { getRetrievalLimits } from '@/lib/backend/chat/services/rag/attachment-content.pipeline'
import { buildRetrievalQuery } from '@/lib/backend/chat/services/rag/context-block.pipeline'
import {
  retrieveAttachmentContextBlock,
  retrieveOrgKnowledgeContextBlock,
  retrieveProjectSourceContextBlock,
} from '@/lib/backend/chat/services/rag/scope-retrieval'
import {
  expandUserMessageText,
  loadSkillBodiesForContext,
} from '@/lib/backend/skills/skill-resolver'
import { resolveCanonicalBranch } from '@/lib/shared/chat-branching/branch-resolver'
import { requireMessagePersistenceDb } from '../../message-persistence-db'
import { normalizeThreadActiveChildMap } from '../helpers'
import type { MessageStoreServiceShape } from '../../message-store.service'

function isImageMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/')
}

function supportsNativeAttachment(input: {
  readonly mimeType: string
  readonly capabilities: {
    readonly supportsImageInput: boolean
  }
}): boolean {
  const { mimeType, capabilities } = input
  if (isImageMimeType(mimeType)) return capabilities.supportsImageInput
  // PDFs and generic files are intentionally routed through the RAG /
  // markdown fallback path even when the model advertises native PDF
  // support, because retrieving relevant excerpts is significantly more
  // token-efficient than uploading the full document on every turn.
  return false
}

type AttachmentPromptRow = {
  readonly id: string
  readonly messageId?: string | null
  readonly threadId?: string | null
  readonly userId: string
  readonly fileKey: string
  readonly attachmentUrl: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly status?: 'deleted' | 'uploaded'
  readonly createdAt?: number
  readonly updatedAt?: number
}

type MessagePromptRow = {
  readonly messageId: string
  readonly role: UIMessage['role']
  readonly parentMessageId?: string | null
  readonly branchIndex: number
  readonly created_at: number
  readonly content: string
  readonly userId: string
  readonly attachmentsIds?: unknown
  readonly model?: string
}

function uniqueAttachmentIds(
  attachments: readonly ChatAttachmentInput[] | undefined,
): readonly string[] {
  return [
    ...new Set(
      (attachments ?? [])
        .map((attachment) => attachment.id.trim())
        .filter((id) => id.length > 0),
    ),
  ]
}

export const makeLoadThreadMessagesOperation = (dependencies: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
  readonly attachmentRecord: AttachmentRecordService['Service']
  readonly attachmentRag: AttachmentRagService['Service']
  readonly orgKnowledgeRag: OrgKnowledgeRagService['Service']
  readonly projectSourceRag: ProjectSourceRagService['Service']
  readonly orgKnowledgeRepository: OrgKnowledgeRepositoryService['Service']
}): MessageStoreServiceShape['loadThreadMessages'] => {
  /**
   * Loads canonical thread history and, when present, appends the pending user
   * turn before retrieval. This lets the first model response see context from
   * freshly uploaded attachments before those attachments are linked in storage.
   */
  const {
    zeroDatabase,
    attachmentRecord,
    attachmentRag,
    orgKnowledgeRag,
    projectSourceRag,
    orgKnowledgeRepository,
  } = dependencies

  return Effect.fn('MessageStoreService.loadThreadMessages')(
    ({
      threadId,
      model,
      userId,
      organizationId,
      orgPolicy,
      untilMessageId,
      pendingUserMessage,
      pendingAttachments,
      requestId,
    }) =>
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
              userId
                ? zql.message
                    .where('threadId', threadId)
                    .where('userId', userId)
                    .orderBy('created_at', 'asc')
                : zql.message
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

        const threadAttachmentRows = yield* Effect.tryPromise({
          try: () =>
            db.run(
              userId
                ? zql.attachment
                    .where('threadId', threadId)
                    .where('userId', userId)
                    .orderBy('createdAt', 'asc')
                : zql.attachment
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

        const pendingAttachmentIds = uniqueAttachmentIds(pendingAttachments)
        const pendingAttachmentRows =
          userId && pendingAttachmentIds.length > 0
            ? yield* Effect.tryPromise({
                try: () =>
                  db.run(
                    zql.attachment
                      .where('id', 'IN', [...pendingAttachmentIds])
                      .where('userId', userId)
                      .orderBy('createdAt', 'asc'),
                  ),
                catch: (error) =>
                  new MessagePersistenceError({
                    message: 'Failed to load pending attachments',
                    requestId,
                    threadId,
                    cause: String(error),
                  }),
              })
            : []

        const attachmentRows: readonly AttachmentPromptRow[] = [
          ...(threadAttachmentRows as readonly AttachmentPromptRow[]),
          ...(pendingAttachmentRows as readonly AttachmentPromptRow[]),
        ].filter(
          (attachment) =>
            attachment.status !== 'deleted' &&
            (!userId || attachment.userId === userId),
        )

        const attachmentsById = new Map(
          attachmentRows.map((attachment) => [attachment.id, attachment]),
        )
        const threadAttachmentContentRows = yield* attachmentRecord
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
        const pendingAttachmentContentRows =
          userId && pendingAttachmentIds.length > 0
            ? yield* attachmentRecord
                .listAttachmentContentRowsByIdsForUser({
                  userId,
                  attachmentIds: pendingAttachmentIds,
                })
                .pipe(
                  Effect.mapError(
                    (error) =>
                      new MessagePersistenceError({
                        message: 'Failed to load pending attachment content',
                        requestId,
                        threadId,
                        cause: String(error),
                      }),
                  ),
                )
            : []
        const attachmentContentById = new Map(
          [...threadAttachmentContentRows, ...pendingAttachmentContentRows].map(
            (attachment) => [attachment.id, attachment],
          ),
        )

        const persistedMessageRows = (
          messageRows as readonly MessagePromptRow[]
        ).filter((message) => !userId || message.userId === userId)
        const { canonicalMessages: canonicalMessageRows } =
          resolveCanonicalBranch(
            persistedMessageRows.map((message) => ({
              messageId: message.messageId,
              role: message.role,
              parentMessageId: message.parentMessageId,
              branchIndex: message.branchIndex,
              createdAt: message.created_at,
            })),
            normalizeThreadActiveChildMap(threadRow?.activeChildByParent),
          )

        const messageById = new Map(
          persistedMessageRows.map((message) => [message.messageId, message]),
        )
        const canonicalOrderedRows = canonicalMessageRows
          .map((message) => messageById.get(message.messageId))
          .filter(
            (message): message is NonNullable<typeof message> => !!message,
          )

        const persistedCanonicalRows =
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

        const pendingMessageRow: MessagePromptRow | undefined =
          pendingUserMessage
            ? {
                messageId: pendingUserMessage.id,
                role: 'user',
                parentMessageId:
                  persistedCanonicalRows.at(-1)?.messageId ?? null,
                branchIndex: 1,
                created_at: Date.now(),
                content: getUserMessageText(pendingUserMessage),
                userId: userId ?? '',
                attachmentsIds: pendingAttachmentIds,
                model,
              }
            : undefined

        const canonicalRows = pendingMessageRow
          ? [...persistedCanonicalRows, pendingMessageRow]
          : persistedCanonicalRows

        const canonicalRowIdSet = new Set(
          canonicalRows.map((row) => row.messageId),
        )
        const modelCapabilities = getCatalogModel(model)?.capabilities

        const latestUserMessageRow = [...canonicalRows]
          .reverse()
          .find((row) => row.role === 'user')
        const latestUserText = latestUserMessageRow?.content ?? ''
        const activeProjectId =
          typeof threadRow?.projectId === 'string' && threadRow.projectId.trim()
            ? threadRow.projectId
            : undefined
        const threadTitle =
          typeof threadRow?.title === 'string' &&
          threadRow.title.trim().length > 0
            ? threadRow.title.trim()
            : undefined

        // The custom instruction lives on the Project row. We need it
        // for intent-enrichment of the query embedding (see
        // `composeIntentEnrichedQuery` in context-block.pipeline) so a
        // turn whose user text is short or empty (e.g. `"."`) still
        // produces meaningful retrieval. Loaded best-effort: if the
        // lookup fails the embedding falls back to whatever signal
        // remains in the user text + file names.
        const projectCustomInstruction = activeProjectId
          ? yield* Effect.tryPromise({
              try: () => db.run(zql.project.where('id', activeProjectId).one()),
              catch: (error) =>
                new MessagePersistenceError({
                  message: 'Failed to load project for intent enrichment',
                  requestId,
                  threadId,
                  cause: String(error),
                }),
            }).pipe(
              Effect.map((projectRow) => {
                const raw = projectRow?.customInstruction
                if (typeof raw !== 'string') return undefined
                const trimmed = raw.trim()
                return trimmed.length > 0 ? trimmed : undefined
              }),
              Effect.catch((error) =>
                Effect.logError('Project lookup for intent enrichment failed', {
                  requestId,
                  threadId,
                  projectId: activeProjectId,
                  cause: error.cause ?? error.message,
                }).pipe(Effect.as<string | undefined>(undefined)),
              ),
            )
          : undefined

        // Per-message-and-thread attachment candidates: only attachments
        // that are linked to a canonical message OR pending in this turn,
        // and only those the active model cannot ingest natively.
        const fallbackAttachmentById = new Map(
          attachmentRows
            .filter(
              (attachment) =>
                (typeof attachment.messageId === 'string' &&
                  canonicalRowIdSet.has(attachment.messageId)) ||
                pendingAttachmentIds.includes(attachment.id),
            )
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

        // The retrieval query bundle is computed once and shared
        // across all the scoped retrievals below. ADR-0002 requires
        // the union of the active sources, so paying for the
        // embedding once and reusing it across `retrieveContextBlock`
        // calls is significantly cheaper than the historical per-
        // source duplication.
        //
        // Intent hints (custom instruction, file names, thread title)
        // are appended so a `"."`-style short message still produces
        // a meaningful query string. See `composeIntentEnrichedQuery`
        // in `context-block.pipeline.ts` for the precise composition
        // rule.
        const intentFileNames = [
          ...new Set(
            [...fallbackAttachmentById.values()].map((row) => row.fileName),
          ),
        ]
        const query = yield* buildRetrievalQuery({
          latestUserText,
          requestId,
          threadId,
          intentHints: {
            customInstruction: projectCustomInstruction,
            fileNames: intentFileNames,
            threadTitle,
          },
        })

        // Adaptive retrieval candidate limit — the upper-bound search
        // request size is set against the per-thread-attachment source
        // count because that's the source group most affected by
        // bursty multi-file uploads (e.g. comparing many CVs in one
        // turn). The other sources still benefit from the resulting
        // larger candidate pool.
        const retrievalLimits = getRetrievalLimits({
          sourceCount: fallbackAttachmentById.size,
        })
        const retrievalCandidateLimit = retrievalLimits.maxChunks * 3
        const commonScopeInput = {
          query,
          requestId,
          threadId,
          retrievalCandidateLimit,
        } as const

        // Source 1: per-thread / per-message attachments (user-provided).
        const fallbackContextBlock = yield* retrieveAttachmentContextBlock({
          ...commonScopeInput,
          attachmentRag,
          userId: latestUserMessageRow?.userId || userId || '',
          fallbackAttachmentRows: fallbackAttachmentById,
          attachmentContentById,
        })

        // Source 2: organization knowledge.
        //
        // Org knowledge has no fallback excerpt path, so it can only
        // contribute when we managed to build a query embedding
        // (which succeeds whenever the literal user text or any
        // intent hint produces a non-empty enriched query — e.g. a
        // project's custom instruction is enough on its own).
        let orgKnowledgeContextBlock = ''
        if (
          organizationId &&
          orgPolicy?.orgKnowledgeEnabled &&
          query.embedding
        ) {
          orgKnowledgeContextBlock = yield* retrieveOrgKnowledgeContextBlock({
            ...commonScopeInput,
            orgKnowledgeRag,
            orgKnowledgeRepository,
            db,
            organizationId,
          })
        }

        // Source 3: project sources.
        //
        // Project sources have a fallback excerpt path that runs even
        // when the query embedding is null, so the only gate here is
        // having an active project. The fallback path emits a
        // per-source excerpt of every project source so the model
        // still sees the curated context (e.g. company description,
        // ranking criteria) on a `"."` user turn inside the project.
        let projectSourceContextBlock = ''
        if (activeProjectId) {
          projectSourceContextBlock = yield* retrieveProjectSourceContextBlock({
            ...commonScopeInput,
            projectSourceRag,
            attachmentRecord,
            db,
            projectId: activeProjectId,
          })
        }

        // Skill body lookup for the resolution context. Loaded once per
        // request and reused across every user message in `canonicalRows`
        // so we issue at most two extra queries (skills, overrides) per
        // turn regardless of history length. See ADR-0005.
        //
        // Short-circuit: if no user message in the canonical history
        // contains a forward slash, there is nothing to expand and we can
        // skip the lookup entirely. The chat composer is overwhelmingly
        // slash-free, so this saves two queries on every normal turn.
        const anyUserMessageContainsSlash = canonicalRows.some(
          (row) => row.role === 'user' && row.content.includes('/'),
        )
        const skillBodyByName = anyUserMessageContainsSlash
          ? yield* loadSkillBodiesForContext({
              db,
              userId,
              projectId: activeProjectId,
              organizationId,
              threadId,
              requestId,
            })
          : (new Map<string, string>() as ReadonlyMap<string, string>)

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

          const expandedText =
            message.role === 'user'
              ? expandUserMessageText({
                  text: message.content,
                  bodyByName: skillBodyByName,
                })
              : message.content

          const modelText =
            message.role === 'user' &&
            latestUserMessageRow?.messageId === message.messageId &&
            canonicalRowIdSet.has(message.messageId) &&
            (orgKnowledgeContextBlock.length > 0 ||
              projectSourceContextBlock.length > 0 ||
              fallbackContextBlock.length > 0)
              ? [
                  orgKnowledgeContextBlock,
                  projectSourceContextBlock,
                  expandedText,
                  fallbackContextBlock,
                ]
                  .filter((value) => value.length > 0)
                  .join('\n\n')
              : expandedText

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
