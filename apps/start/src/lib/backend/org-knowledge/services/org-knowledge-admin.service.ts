import { Effect, Layer, ServiceMap } from 'effect'
import {
  RagIndexerService,
  normalizeMarkdownForStorage,
} from '@/lib/backend/rag'
import {
  MarkdownConversionService,
} from '@/lib/backend/file/services/markdown-conversion.service'
import { readDirectTextFileContent } from '@/lib/backend/file/services/plain-text-file'
import { ORG_KNOWLEDGE_KIND } from '@/lib/shared/org-knowledge'
import { ORG_KNOWLEDGE_UPLOAD_POLICY } from '@/lib/shared/upload/upload-validation'
import {
  UploadServiceError,
  uploadService,
} from '@/lib/backend/upload/upload.service'
import { OrgKnowledgePersistenceError } from '../domain/errors'
import { OrgKnowledgeRepositoryService } from './org-knowledge-repository.service'

export type OrgKnowledgeAdminServiceShape = {
  readonly uploadKnowledgeFile: (input: {
    readonly organizationId: string
    readonly userId: string
    readonly file: File
    readonly requestId: string
  }) => Effect.Effect<
    {
      readonly attachmentId: string
    },
    OrgKnowledgePersistenceError
  >
  readonly setKnowledgeActive: (input: {
    readonly organizationId: string
    readonly attachmentId: string
    readonly active: boolean
    readonly requestId: string
  }) => Effect.Effect<void, OrgKnowledgePersistenceError>
  readonly deleteKnowledgeFile: (input: {
    readonly organizationId: string
    readonly attachmentId: string
    readonly requestId: string
  }) => Effect.Effect<void, OrgKnowledgePersistenceError>
  readonly retryKnowledgeIndex: (input: {
    readonly organizationId: string
    readonly attachmentId: string
    readonly requestId: string
  }) => Effect.Effect<void, OrgKnowledgePersistenceError>
}

/**
 * Admin-oriented orchestration for org-wide knowledge uploads and lifecycle
 * changes. Indexing goes through the shared `RagIndexerService`, the same
 * path as chat attachments and project files, and rows live on the shared
 * `attachments` table. An indexing failure never fails the upload: the row is
 * stored with `embeddingStatus: 'failed'` and can be retried from settings.
 */
export class OrgKnowledgeAdminService extends ServiceMap.Service<
  OrgKnowledgeAdminService,
  OrgKnowledgeAdminServiceShape
>()('org-knowledge/OrgKnowledgeAdminService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const markdownConversion = yield* MarkdownConversionService
      const orgKnowledgeRepository = yield* OrgKnowledgeRepositoryService
      const ragIndexer = yield* RagIndexerService

      const uploadKnowledgeFile: OrgKnowledgeAdminServiceShape['uploadKnowledgeFile'] =
        Effect.fn('OrgKnowledgeAdminService.uploadKnowledgeFile')(
          ({ organizationId, userId, file, requestId }) =>
            Effect.gen(function* () {
              const uploaded = yield* Effect.tryPromise({
                try: () =>
                  uploadService.upload({
                    userId,
                    file,
                    validationPolicy: ORG_KNOWLEDGE_UPLOAD_POLICY,
                  }),
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message:
                      error instanceof UploadServiceError
                        ? error.message
                        : 'Failed to upload organization knowledge file',
                    requestId,
                    organizationId,
                    cause: String(error),
                  }),
              })

              const attachmentId = crypto.randomUUID()
              const now = Date.now()
              /**
               * Text and markdown uploads already contain the content we want to
               * embed, so bypass conversion and index their original text.
               */
              const directTextContent = yield* Effect.tryPromise({
                try: () => readDirectTextFileContent(file),
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message:
                      error instanceof Error
                        ? error.message
                        : 'Failed to extract organization knowledge content',
                    requestId,
                    organizationId,
                    cause: String(error),
                  }),
              })
              const markdownRaw = directTextContent ?? (yield* markdownConversion
                .convertFromUrl({
                  fileUrl: uploaded.url,
                  fileName: uploaded.name,
                  requestId,
                })
                .pipe(
                  Effect.map((conversion) => conversion.markdown),
                  Effect.mapError(
                    (error) =>
                      new OrgKnowledgePersistenceError({
                        message:
                          error instanceof Error
                            ? error.message
                            : 'Failed to extract organization knowledge content',
                        requestId,
                        organizationId,
                        cause: String(error),
                      }),
                  ),
                ))
              const markdown = normalizeMarkdownForStorage(markdownRaw)
              const index = yield* ragIndexer.indexDocument({
                scope: 'org_knowledge',
                attachmentId,
                fileName: uploaded.name,
                markdown,
                ownership: {
                  userId,
                  ownerOrgId: organizationId,
                  accessScope: 'org',
                },
              })

              yield* orgKnowledgeRepository.insertKnowledgeAttachment({
                attachment: {
                  id: attachmentId,
                  userId,
                  ownerOrgId: organizationId,
                  fileKey: uploaded.key,
                  attachmentUrl: uploaded.url,
                  fileName: uploaded.name,
                  mimeType: uploaded.contentType,
                  fileSize: uploaded.size,
                  fileContent: markdown,
                  embeddingModel: index.embeddingModel,
                  embeddingTokens: index.embeddingTokens,
                  embeddingDimensions: index.embeddingDimensions,
                  embeddingChunks: index.embeddingChunks,
                  embeddingStatus: index.embeddingStatus,
                  vectorIndexedAt: index.vectorIndexedAt,
                  vectorError: index.vectorError,
                  createdAt: now,
                  updatedAt: now,
                },
                requestId,
              }).pipe(
                Effect.tapError(() =>
                  ragIndexer
                    .deleteDocuments({
                      tenant: { scope: 'org_knowledge', organizationId },
                      attachmentIds: [attachmentId],
                    })
                    .pipe(Effect.ignore),
                ),
              )

              return { attachmentId }
            }),
        )

      const setKnowledgeActive: OrgKnowledgeAdminServiceShape['setKnowledgeActive'] =
        Effect.fn('OrgKnowledgeAdminService.setKnowledgeActive')(
          ({ organizationId, attachmentId, active, requestId }) =>
            orgKnowledgeRepository.setAttachmentActive({
              organizationId,
              attachmentId,
              active,
              requestId,
            }),
        )

      const deleteKnowledgeFile: OrgKnowledgeAdminServiceShape['deleteKnowledgeFile'] =
        Effect.fn('OrgKnowledgeAdminService.deleteKnowledgeFile')(
          ({ organizationId, attachmentId, requestId }) =>
            Effect.gen(function* () {
              const attachment = yield* orgKnowledgeRepository.getAttachmentForOrg({
                organizationId,
                attachmentId,
                requestId,
              })

              if (!attachment || attachment.orgKnowledgeKind !== ORG_KNOWLEDGE_KIND) {
                return yield* Effect.fail(
                  new OrgKnowledgePersistenceError({
                    message: 'Organization knowledge attachment is not available',
                    requestId,
                    organizationId,
                    attachmentId,
                  }),
                )
              }

              yield* ragIndexer.deleteDocuments({
                tenant: { scope: 'org_knowledge', organizationId },
                attachmentIds: [attachmentId],
              }).pipe(
                Effect.catch((error) =>
                  Effect.fail(
                    new OrgKnowledgePersistenceError({
                      message: 'Failed to delete organization knowledge vectors',
                      requestId,
                      organizationId,
                      attachmentId,
                      cause: String(error),
                    }),
                  ),
                ),
              )

              yield* orgKnowledgeRepository.markAttachmentDeleted({
                organizationId,
                attachmentId,
                requestId,
              })
            }),
        )

      const retryKnowledgeIndex: OrgKnowledgeAdminServiceShape['retryKnowledgeIndex'] =
        Effect.fn('OrgKnowledgeAdminService.retryKnowledgeIndex')(
          ({ organizationId, attachmentId, requestId }) =>
            Effect.gen(function* () {
              const attachment = yield* orgKnowledgeRepository.getAttachmentForOrg({
                organizationId,
                attachmentId,
                requestId,
              })
              if (
                !attachment ||
                attachment.status !== 'uploaded' ||
                !attachment.fileContent ||
                !attachment.userId
              ) {
                return yield* Effect.fail(
                  new OrgKnowledgePersistenceError({
                    message: 'Organization knowledge attachment is not available for reindexing',
                    requestId,
                    organizationId,
                    attachmentId,
                  }),
                )
              }

              const index = yield* ragIndexer.indexDocument({
                scope: 'org_knowledge',
                attachmentId,
                fileName: attachment.fileName,
                markdown: attachment.fileContent,
                ownership: {
                  userId: attachment.userId,
                  ownerOrgId: organizationId,
                  accessScope: 'org',
                },
                replaceExisting: true,
              })

              yield* orgKnowledgeRepository.updateAttachmentIndexState({
                organizationId,
                attachmentId,
                embeddingStatus: index.embeddingStatus,
                vectorIndexedAt: index.vectorIndexedAt,
                vectorError: index.vectorError,
                requestId,
              })

              if (index.embeddingStatus === 'failed') {
                return yield* Effect.fail(
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to reindex organization knowledge vectors',
                    requestId,
                    organizationId,
                    attachmentId,
                    cause: index.vectorError,
                  }),
                )
              }
            }),
        )

      return {
        uploadKnowledgeFile,
        setKnowledgeActive,
        deleteKnowledgeFile,
        retryKnowledgeIndex,
      }
    }),
  )
}
