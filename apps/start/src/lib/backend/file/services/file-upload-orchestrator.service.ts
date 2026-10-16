import { Effect, Layer, ServiceMap } from 'effect'
import { emitWideErrorEvent } from '@/lib/backend/chat/observability/wide-event'
import { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import {
  RagIndexerService,
  normalizeMarkdownForStorage,
} from '@/lib/backend/rag'
import {
  UploadServiceError,
  uploadService,
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
      const ragIndexer = yield* RagIndexerService
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
              uploadService.upload({
                userId,
                file,
                validationPolicy:
                  mode === 'avatar'
                    ? AVATAR_UPLOAD_POLICY
                    : CHAT_ATTACHMENT_UPLOAD_POLICY,
              }),
            catch: (error) => {
              if (error instanceof UploadServiceError) {
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
          const ownership = {
            userId,
            ownerOrgId,
            workspaceId,
            accessScope: accessScope ?? 'user',
            accessGroupIds: accessGroupIds ?? [],
          } as const

          // Indexing never fails the upload: a file without vectors is still
          // read in full (or from its beginning) by the RAG context service.
          const index = yield* ragIndexer.indexDocument({
            scope: 'attachment',
            attachmentId,
            fileName: uploaded.name,
            markdown,
            ownership,
          })
          if (index.embeddingStatus === 'failed') {
            yield* emitWideErrorEvent({
              eventName: 'file.upload.vector_index.failed',
              route,
              requestId,
              userId,
              errorTag: 'FileVectorIndexError',
              message: 'Failed to index file chunks in vector store',
              cause: index.vectorError,
            })
          }

          yield* attachmentRecords.insertAttachmentRecord({
            id: attachmentId,
            userId,
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
            ownerOrgId: ownership.ownerOrgId,
            workspaceId: ownership.workspaceId,
            accessScope: ownership.accessScope,
            accessGroupIds: ownership.accessGroupIds,
            status: 'uploaded',
            createdAt: now,
            updatedAt: now,
          }).pipe(
            Effect.tapError(() =>
              // Do not leave vectors behind for a row that was never written.
              ragIndexer
                .deleteDocuments({
                  tenant: { scope: 'attachment', userId },
                  attachmentIds: [attachmentId],
                })
                .pipe(Effect.ignore),
            ),
            Effect.mapError(
              (error) =>
                new FilePersistenceError({
                  message: 'Failed to persist uploaded attachment',
                  requestId,
                  cause: String(error),
                }),
            ),
          )

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
