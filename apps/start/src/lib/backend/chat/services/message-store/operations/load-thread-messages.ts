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
import type { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import type { RagContextService } from '@/lib/backend/rag'
import {
  expandUserMessageText,
  loadSkillBodiesForContext,
} from '@/lib/backend/skills/skill-resolver'
import { resolveCanonicalBranch } from '@/lib/shared/chat-branching/branch-resolver'
import { DEFAULT_THREAD_TITLE } from '@/lib/shared/chat/thread-bootstrap'
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
  // PDFs and generic files always go through the RAG context service even
  // when the model advertises native PDF support: the extracted text is read
  // in full when it fits and retrieved when it does not, which is cheaper and
  // behaves the same for every model.
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

/**
 * Prepend a context block to a message's text, keeping the user's words last
 * (documents first, question last reads best for long-context models).
 */
function withContextPrefix(block: string, text: string): string {
  return block.length > 0 ? `${block}\n\n${text}` : text
}

export const makeLoadThreadMessagesOperation = (dependencies: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
  readonly ragContext: RagContextService['Service']
}): MessageStoreServiceShape['loadThreadMessages'] => {
  /**
   * Loads canonical thread history and, when present, appends the pending user
   * turn before retrieval. This lets the first model response see context from
   * freshly uploaded attachments before those attachments are linked in storage.
   */
  const { zeroDatabase, ragContext } = dependencies

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
      contextWindowTokens,
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
        const modelCatalogEntry = getCatalogModel(model)
        const modelCapabilities = modelCatalogEntry?.capabilities

        const userRows = canonicalRows.filter((row) => row.role === 'user')
        const firstUserMessageRow = userRows.at(0)
        const latestUserMessageRow = userRows.at(-1)
        const previousUserMessageRow = userRows.at(-2)
        const activeProjectId =
          typeof threadRow?.projectId === 'string' && threadRow.projectId.trim()
            ? threadRow.projectId
            : undefined
        // The placeholder title of a new thread carries no meaning and only
        // adds noise to the retrieval query.
        const threadTitle =
          typeof threadRow?.title === 'string' &&
          threadRow.title.trim().length > 0 &&
          threadRow.title !== DEFAULT_THREAD_TITLE
            ? threadRow.title.trim()
            : undefined

        // Skill body lookup runs before the retrieval query so
        // `/skillname` tokens in the latest user message expand into
        // their full body and feed the RAG query (ADR-0005 skills,
        // ADR-0006 RAG). The map is reused by the
        // per-message expansion below.
        //
        // Short-circuit: if no user message in the canonical history
        // contains a forward slash, there is nothing to expand and we
        // can skip the lookup entirely. The chat composer is
        // overwhelmingly slash-free, so this saves two queries on every
        // normal turn.
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

        const latestUserText = expandUserMessageText({
          text: latestUserMessageRow?.content ?? '',
          bodyByName: skillBodyByName,
        })

        // The custom instruction lives on the Project row. It enriches the
        // retrieval query (see `composeRetrievalQuery`) so a turn whose
        // user text is short or empty (e.g. `"."`) still produces
        // meaningful retrieval. Loaded best-effort: if the
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

        // Per-message-and-thread attachment candidates: attachments linked to
        // a canonical message (by `attachments.message_id`, or listed in a
        // canonical message's `attachmentsIds` — an edited message reuses
        // the original's files) OR pending in this turn, and only those the
        // active model cannot ingest natively.
        const canonicalAttachmentIds = new Set(
          canonicalRows.flatMap((row) =>
            Array.isArray(row.attachmentsIds)
              ? (row.attachmentsIds as readonly unknown[]).filter(
                  (id): id is string => typeof id === 'string',
                )
              : [],
          ),
        )
        const fallbackAttachmentById = new Map(
          attachmentRows
            .filter(
              (attachment) =>
                (typeof attachment.messageId === 'string' &&
                  canonicalRowIdSet.has(attachment.messageId)) ||
                canonicalAttachmentIds.has(attachment.id) ||
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

        // One call builds the document context for every knowledge scope
        // (conversation files, project files, org knowledge) with the same
        // rules; see `RagContextService` and ADR-0006.
        const turnContext = yield* ragContext.buildTurnContext({
          requestId,
          threadId,
          userId: latestUserMessageRow?.userId || userId || undefined,
          attachmentIds: [...fallbackAttachmentById.keys()],
          projectId: activeProjectId,
          organizationId:
            organizationId && orgPolicy?.orgKnowledgeEnabled
              ? organizationId
              : undefined,
          query: {
            latestUserText,
            previousUserText: previousUserMessageRow
              ? expandUserMessageText({
                  text: previousUserMessageRow.content,
                  bodyByName: skillBodyByName,
                })
              : undefined,
            threadTitle,
            customInstruction: projectCustomInstruction,
            fileNames: [
              ...new Set(
                [...fallbackAttachmentById.values()].map((row) => row.fileName),
              ),
            ],
          },
          contextWindowTokens:
            contextWindowTokens ?? modelCatalogEntry?.contextWindow,
        })

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

          // Full-text documents ride on the first user message so the prompt
          // prefix is identical from turn to turn (provider prompt caching);
          // question-specific excerpts ride on the latest user message.
          let modelText = expandedText
          if (message.messageId === latestUserMessageRow?.messageId) {
            modelText = withContextPrefix(turnContext.turnBlock, modelText)
          }
          if (message.messageId === firstUserMessageRow?.messageId) {
            modelText = withContextPrefix(turnContext.libraryBlock, modelText)
          }

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
