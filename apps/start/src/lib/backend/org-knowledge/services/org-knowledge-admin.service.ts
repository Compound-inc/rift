import { Effect, Layer, ServiceMap } from 'effect'
import {
  buildAttachmentChunkRows,
  normalizeMarkdownForStorage,
} from '@/lib/backend/chat/services/rag/attachment-content.pipeline'
import { OrgKnowledgeRagService } from '@/lib/backend/chat/services/rag'
import {
  MarkdownConversionService,
} from '@/lib/backend/file/services/markdown-conversion.service'
import {
  ORG_KNOWLEDGE_KIND,
  summarizeOrgKnowledgeIndexError,
} from '@/lib/shared/org-knowledge'
import { ORG_KNOWLEDGE_UPLOAD_POLICY } from '@/lib/shared/upload/upload-validation'
import {
  R2UploadServiceError,
  r2UploadService,
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
 * changes. This reuses the existing markdown conversion and embedding pipeline
 * while persisting rows onto the shared `attachments` table.
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
      const orgKnowledgeRag = yield* OrgKnowledgeRagService

      const uploadKnowledgeFile: OrgKnowledgeAdminServiceShape['uploadKnowledgeFile'] =
        Effect.fn('OrgKnowledgeAdminService.uploadKnowledgeFile')(
          ({ organizationId, userId, file, requestId }) =>
            Effect.gen(function* () {
              const uploaded = yield* Effect.tryPromise({
                try: () =>
                  r2UploadService.upload({
                    userId,
                    file,
                    validationPolicy: ORG_KNOWLEDGE_UPLOAD_POLICY,
                  }),
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message:
                      error instanceof R2UploadServiceError
                        ? error.message
                        : 'Failed to upload organization knowledge file',
                    requestId,
                    organizationId,
                    cause: String(error),
                  }),
              })

              const conversion = yield* markdownConversion
                .convertFromUrl({
                  fileUrl: uploaded.url,
                  fileName: uploaded.name,
                  requestId,
                })
                .pipe(
                  Effect.mapError(
                    (error) =>
                      new OrgKnowledgePersistenceError({
                        message: error.message,
                        requestId,
                        organizationId,
                        cause: error.cause,
                      }),
                  ),
                )

              const attachmentId = crypto.randomUUID()
              const now = Date.now()
              const markdown = normalizeMarkdownForStorage(conversion.markdown)
              const chunkBuild = yield* Effect.tryPromise({
                try: () =>
                  buildAttachmentChunkRows({
                    attachmentId,
                    userId,
                    markdown,
                    now,
                  }),
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to prepare organization knowledge chunks',
                    requestId,
                    organizationId,
                    attachmentId,
                    cause: String(error),
                  }),
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
                  embeddingModel: chunkBuild.metrics.embeddingModel,
                  embeddingTokens: chunkBuild.metrics.embeddingTokens,
                  embeddingDimensions: chunkBuild.metrics.embeddingDimensions,
                  embeddingChunks: chunkBuild.metrics.embeddingChunks,
                  embeddingStatus: chunkBuild.metrics.embeddingStatus,
                  createdAt: now,
                  updatedAt: now,
                },
                requestId,
              })

              yield* orgKnowledgeRag
                .indexOrgKnowledgeChunks({
                  chunks: chunkBuild.chunks.map((chunk) => ({
                    ...chunk,
                    scopeType: 'org_knowledge' as const,
                    sourceId: chunk.attachmentId,
                    ownerOrgId: organizationId,
                    accessScope: 'org' as const,
                    embedding: chunk.embedding ?? [],
                    embeddingModel: chunkBuild.metrics.embeddingModel,
                  })),
                })
                .pipe(
                  Effect.flatMap(() =>
                    orgKnowledgeRepository.updateAttachmentIndexState({
                      organizationId,
                      attachmentId,
                      embeddingStatus: chunkBuild.metrics.embeddingStatus,
                      vectorIndexedAt:
                        chunkBuild.metrics.embeddingStatus === 'indexed'
                          ? Date.now()
                          : undefined,
                      requestId,
                    }),
                  ),
                  Effect.catch((error) =>
                    orgKnowledgeRepository
                      .updateAttachmentIndexState({
                        organizationId,
                        attachmentId,
                        embeddingStatus: 'failed',
                        vectorError: summarizeOrgKnowledgeIndexError(
                          error instanceof Error ? error.message : String(error),
                        ),
                        requestId,
                      })
                      .pipe(
                        Effect.flatMap(() =>
                          Effect.fail(
                            new OrgKnowledgePersistenceError({
                              message: 'Failed to index organization knowledge vectors',
                              requestId,
                              organizationId,
                              attachmentId,
                              cause: String(error),
                            }),
                          ),
                        ),
                      ),
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

              yield* orgKnowledgeRag.deleteOrgKnowledgeChunks({
                organizationId,
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

              const chunkBuild = yield* Effect.tryPromise({
                try: () =>
                  buildAttachmentChunkRows({
                    attachmentId,
                    userId: attachment.userId,
                    markdown: attachment.fileContent,
                    now: Date.now(),
                  }),
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to rebuild organization knowledge chunks',
                    requestId,
                    organizationId,
                    attachmentId,
                    cause: String(error),
                  }),
              })

              yield* orgKnowledgeRag.indexOrgKnowledgeChunks({
                chunks: chunkBuild.chunks.map((chunk) => ({
                  ...chunk,
                  scopeType: 'org_knowledge' as const,
                  sourceId: chunk.attachmentId,
                  ownerOrgId: organizationId,
                  accessScope: 'org' as const,
                  embedding: chunk.embedding ?? [],
                  embeddingModel: chunkBuild.metrics.embeddingModel,
                })),
              }).pipe(
                Effect.catch((error) =>
                  orgKnowledgeRepository
                    .updateAttachmentIndexState({
                      organizationId,
                      attachmentId,
                      embeddingStatus: 'failed',
                      vectorError: summarizeOrgKnowledgeIndexError(
                        error instanceof Error ? error.message : String(error),
                      ),
                      requestId,
                    })
                    .pipe(
                      Effect.flatMap(() =>
                        Effect.fail(
                          new OrgKnowledgePersistenceError({
                            message: 'Failed to reindex organization knowledge vectors',
                            requestId,
                            organizationId,
                            attachmentId,
                            cause: String(error),
                          }),
                        ),
                      ),
                    ),
                ),
              )

              yield* orgKnowledgeRepository.updateAttachmentIndexState({
                organizationId,
                attachmentId,
                embeddingStatus: chunkBuild.metrics.embeddingStatus,
                vectorIndexedAt:
                  chunkBuild.metrics.embeddingStatus === 'indexed'
                    ? Date.now()
                    : undefined,
                vectorError: undefined,
                requestId,
              })
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
