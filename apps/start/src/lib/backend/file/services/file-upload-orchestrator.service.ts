import { Effect, Layer, ServiceMap } from 'effect'
import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'
import { emitWideErrorEvent } from '@/lib/backend/chat/observability/wide-event'
import { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import { AttachmentRagService } from '@/lib/backend/chat/services/rag'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import {
  buildAttachmentChunkRows,
  normalizeMarkdownForStorage,
} from '@/lib/backend/chat/services/rag/attachment-content.pipeline'
import {
  R2UploadServiceError,
  r2UploadService,
} from '@/lib/backend/upload/upload.service'
import {
  AVATAR_UPLOAD_POLICY,
  CHAT_ATTACHMENT_UPLOAD_POLICY,
} from '@/lib/shared/upload/upload-validation'
import {
  FileConversionError,
  FilePersistenceError,
  FileUploadStorageError,
} from '../domain/errors'
import { requireFilePersistenceDb } from './file-persistence-db'
import { MarkdownConversionService } from './markdown-conversion.service'
import { readDirectTextFileContent } from './plain-text-file'

type UploadedFileResult = {
  readonly id: string
  readonly key: string
  readonly url: string
  readonly name: string
  readonly size: number
  readonly contentType: string
}

export type FileUploadOrchestratorServiceShape = {
  readonly upload: (input: {
    readonly userId: string
    readonly ownerOrgId?: string
    readonly workspaceId?: string
    readonly accessScope?: 'user' | 'workspace' | 'org'
    readonly accessGroupIds?: readonly string[]
    readonly file: File
    readonly requestId: string
    readonly route: string
    readonly processingMode?: 'attachment' | 'avatar'
  }) => Effect.Effect<
    UploadedFileResult,
    FileUploadStorageError | FileConversionError | FilePersistenceError
  >
}

export class FileUploadOrchestratorService extends ServiceMap.Service<
  FileUploadOrchestratorService,
  FileUploadOrchestratorServiceShape
>()('file-backend/FileUploadOrchestratorService') {
  /**
   * Live file upload orchestration layer (storage, conversion, persistence, vector indexing).
   */
  static readonly layer = Layer.effect(
    FileUploadOrchestratorService,
    Effect.gen(function* () {
      const attachmentRecords = yield* AttachmentRecordService
      const attachmentRag = yield* AttachmentRagService
      const zeroDatabase = yield* ZeroDatabaseService
      const markdownConversion = yield* MarkdownConversionService

      return {
        upload: Effect.fn('FileUploadOrchestratorService.upload')(
          ({
            userId,
            ownerOrgId,
            workspaceId,
            accessScope,
            accessGroupIds,
            file,
            requestId,
            route,
            processingMode,
          }) =>
            Effect.gen(function* () {
          const mode = processingMode ?? 'attachment'
          const uploaded = yield* Effect.tryPromise({
            try: () =>
              r2UploadService.upload({
                userId,
                file,
                validationPolicy:
                  mode === 'avatar'
                    ? AVATAR_UPLOAD_POLICY
                    : CHAT_ATTACHMENT_UPLOAD_POLICY,
              }),
            catch: (error) => {
              if (error instanceof R2UploadServiceError) {
                return new FileUploadStorageError({
                  message: error.message,
                  requestId,
                  statusCode: error.statusCode,
                })
              }
              return new FileUploadStorageError({
                message: 'Failed to upload file to storage',
                requestId,
                statusCode: 500,
                cause: String(error),
              })
            },
          })

          /**
           * Avatar/logo uploads should only write to object storage.
           * They intentionally skip markdown extraction, DB attachment rows, and vector indexing.
           */
          if (mode === 'avatar') {
            return {
              id: crypto.randomUUID(),
              key: uploaded.key,
              url: uploaded.url,
              name: uploaded.name,
              size: uploaded.size,
              contentType: uploaded.contentType,
            }
          }

          /**
           * Plain-text uploads are already in their final searchable form, so
           * we can skip the external markdown worker and index the file bytes
           * directly after normalization.
           */
          const directTextContent = yield* Effect.tryPromise({
            try: () => readDirectTextFileContent(file),
            catch: (error) =>
              error instanceof FileConversionError
                ? error
                : new FileConversionError({
                    message: 'Failed to extract uploaded file content',
                    requestId,
                    statusCode: 502,
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
                  error instanceof FileConversionError
                    ? error
                    : new FileConversionError({
                        message: 'Failed to extract uploaded file content',
                        requestId,
                        statusCode: 502,
                        cause: String(error),
                      }),
              ),
            ))

          const markdown = normalizeMarkdownForStorage(markdownRaw)
          const now = Date.now()
          const attachmentId = crypto.randomUUID()
          const chunkBuild = yield* Effect.tryPromise({
            try: () =>
              buildAttachmentChunkRows({
                attachmentId,
                userId,
                markdown,
                now,
              }),
            catch: (error) =>
              new FilePersistenceError({
                message: 'Failed to prepare attachment chunks',
                requestId,
                cause: String(error),
              }),
          })
          if (
            isEmbeddingFeatureEnabled &&
            chunkBuild.metrics.embeddingStatus === 'failed'
          ) {
            yield* Effect.logError(
              'Attachment embeddings failed during upload; continuing with markdown fallback',
              {
                requestId,
                route,
                userId,
                attachmentId,
              },
            )
          }

          const db = yield* requireFilePersistenceDb({
            zeroDatabase,
            message: 'File storage is unavailable',
            requestId,
          })

          yield* attachmentRecords.insertAttachmentRecord({
            id: attachmentId,
            userId,
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
            ownerOrgId,
            workspaceId,
            accessScope: accessScope ?? 'user',
            accessGroupIds: accessGroupIds ?? [],
            status: 'uploaded',
            createdAt: now,
            updatedAt: now,
          }).pipe(
            Effect.mapError(
              (error) =>
                new FilePersistenceError({
                  message: 'Failed to persist uploaded attachment',
                  requestId,
                  cause: String(error),
                }),
            ),
          )

          const hasEmbeddings = chunkBuild.chunks.some(
            (chunk) =>
              Array.isArray(chunk.embedding) && chunk.embedding.length > 0,
          )
          const shouldIndexVectors =
            isEmbeddingFeatureEnabled
            && chunkBuild.metrics.embeddingStatus === 'indexed'
            && hasEmbeddings

          if (shouldIndexVectors) {
            yield* attachmentRag
              .indexAttachmentChunks({
                chunks: chunkBuild.chunks.map((chunk) => ({
                  ...chunk,
                  embeddingModel: chunkBuild.metrics.embeddingModel,
                  ownerOrgId,
                  workspaceId,
                  accessScope: accessScope ?? 'user',
                  accessGroupIds: accessGroupIds ?? [],
                })),
              })
              .pipe(
                Effect.tap(() =>
                  Effect.tryPromise({
                    try: () =>
                      db.transaction(async (tx) => {
                        await tx.mutate.attachment.update({
                          id: attachmentId,
                          vectorIndexedAt: Date.now(),
                          vectorError: undefined,
                          updatedAt: Date.now(),
                        })
                      }),
                    catch: () => undefined,
                  }).pipe(Effect.catch(() => Effect.void)),
                ),
                Effect.catch((error) =>
                  emitWideErrorEvent({
                    eventName: 'file.upload.vector_index.failed',
                    route,
                    requestId,
                    userId,
                    errorTag: 'FileVectorIndexError',
                    message: 'Failed to index file chunks in vector store',
                    cause: String(error),
                  }).pipe(
                    Effect.flatMap(() =>
                      Effect.tryPromise({
                        try: () =>
                          db.transaction(async (tx) => {
                            await tx.mutate.attachment.update({
                              id: attachmentId,
                              embeddingStatus: 'failed',
                              vectorError: String(error),
                              updatedAt: Date.now(),
                            })
                          }),
                        catch: () => undefined,
                      }).pipe(Effect.catch(() => Effect.void)),
                    ),
                    Effect.asVoid,
                  ),
                ),
              )
          }

              return {
                id: attachmentId,
                key: uploaded.key,
                url: uploaded.url,
                name: uploaded.name,
                size: uploaded.size,
                contentType: uploaded.contentType,
              }
            }),
        ),
      }
    }),
  )
}
