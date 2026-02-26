import { Effect, Layer, ServiceMap } from 'effect'
import { emitWideErrorEvent } from '@/lib/chat-backend/observability/wide-event'
import { getZeroDatabase } from '@/lib/chat-backend/infra/zero/db'
import { AttachmentRagService } from '@/lib/chat-backend/services/rag'
import {
  buildAttachmentChunkRows,
  normalizeMarkdownForStorage,
} from '@/lib/chat-backend/services/rag/attachment-content.pipeline'
import { R2UploadServiceError, r2UploadService } from '@/lib/upload/upload.service'
import {
  FileConversionError,
  FilePersistenceError,
  FileUploadStorageError,
} from '../domain/errors'

type UploadedFileResult = {
  readonly id: string
  readonly key: string
  readonly url: string
  readonly name: string
  readonly size: number
  readonly contentType: string
}

function readRequiredEnv(name: string): string | null {
  const raw = process.env[name]
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveWorkerConvertUrl(workerUrl: string): string {
  const normalized = workerUrl.trim()
  if (normalized.endsWith('/convert')) return normalized
  return `${normalized.replace(/\/$/, '')}/convert`
}

async function convertToMarkdown(input: {
  fileUrl: string
  fileName: string
  requestId: string
}): Promise<string> {
  const workerUrl = readRequiredEnv('CF_MARKDOWN_WORKER_URL')
  const workerToken = readRequiredEnv('CF_MARKDOWN_WORKER_TOKEN')
  if (!workerUrl || !workerToken) {
    throw new FileConversionError({
      message:
        'Markdown conversion is not configured. Missing CF_MARKDOWN_WORKER_URL or CF_MARKDOWN_WORKER_TOKEN.',
      requestId: input.requestId,
      statusCode: 500,
    })
  }

  const timeoutMs = Number.parseInt(
    process.env.CF_MARKDOWN_WORKER_TIMEOUT_MS ?? '',
    10,
  )
  const effectiveTimeoutMs = Number.isFinite(timeoutMs)
    ? Math.max(1_000, timeoutMs)
    : 20_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs)

  let convertResponse: Response
  try {
    convertResponse = await fetch(resolveWorkerConvertUrl(workerUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({
        fileUrl: input.fileUrl,
        fileName: input.fileName,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FileConversionError({
        message: 'Markdown conversion timed out',
        requestId: input.requestId,
        statusCode: 504,
      })
    }
    throw new FileConversionError({
      message: 'Failed to convert uploaded file',
      requestId: input.requestId,
      statusCode: 502,
      cause: String(error),
    })
  }
  clearTimeout(timeoutId)

  const workerPayload = (await convertResponse
    .json()
    .catch(() => null)) as { markdown?: unknown; error?: unknown } | null

  if (!convertResponse.ok) {
    const message =
      workerPayload && typeof workerPayload.error === 'string'
        ? workerPayload.error
        : 'Failed to convert uploaded file'
    throw new FileConversionError({
      message,
      requestId: input.requestId,
      statusCode: convertResponse.status,
    })
  }

  const markdown =
    workerPayload && typeof workerPayload.markdown === 'string'
      ? workerPayload.markdown
      : ''
  if (!markdown) {
    throw new FileConversionError({
      message: 'Conversion response did not include markdown',
      requestId: input.requestId,
      statusCode: 502,
    })
  }
  return markdown
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
  }) => Effect.Effect<
    UploadedFileResult,
    FileUploadStorageError | FileConversionError | FilePersistenceError
  >
}

export class FileUploadOrchestratorService extends ServiceMap.Service<
  FileUploadOrchestratorService,
  FileUploadOrchestratorServiceShape
>()('file-backend/FileUploadOrchestratorService') {}

export const FileUploadOrchestratorLive = Layer.effect(
  FileUploadOrchestratorService,
  Effect.gen(function* () {
    const attachmentRag = yield* AttachmentRagService

    return {
      upload: ({
        userId,
        ownerOrgId,
        workspaceId,
        accessScope,
        accessGroupIds,
        file,
        requestId,
        route,
      }) =>
        Effect.gen(function* () {
          const uploaded = yield* Effect.tryPromise({
            try: () =>
              r2UploadService.upload({
                userId,
                file,
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

          const markdownRaw = yield* Effect.tryPromise({
            try: () =>
              convertToMarkdown({
                fileUrl: uploaded.url,
                fileName: uploaded.name,
                requestId,
              }),
            catch: (error) => {
              if (
                typeof error === 'object' &&
                error !== null &&
                '_tag' in error &&
                (error as { _tag?: string })._tag === 'FileConversionError'
              ) {
                return error as FileConversionError
              }
              return new FileConversionError({
                message: 'Failed to convert uploaded file',
                requestId,
                statusCode: 502,
                cause: String(error),
              })
            },
          })

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

          const db = getZeroDatabase()
          if (!db) {
            return yield* Effect.fail(
              new FilePersistenceError({
                message: 'ZERO_UPSTREAM_DB is not configured',
                requestId,
              }),
            )
          }

          yield* Effect.tryPromise({
            try: () =>
              db.transaction(async (tx) => {
                await tx.mutate.attachment.insert({
                  id: attachmentId,
                  messageId: undefined,
                  threadId: undefined,
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
                  vectorIndexedAt: undefined,
                  vectorError: undefined,
                  status: 'uploaded',
                  createdAt: now,
                  updatedAt: now,
                })
              }),
            catch: (error) =>
              new FilePersistenceError({
                message: 'Failed to persist uploaded attachment',
                requestId,
                cause: String(error),
              }),
          })

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
                chunkBuild.metrics.embeddingStatus === 'indexed'
                  ? Effect.tryPromise({
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
                    }).pipe(Effect.catch(() => Effect.void))
                  : Effect.void,
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

          return {
            id: attachmentId,
            key: uploaded.key,
            url: uploaded.url,
            name: uploaded.name,
            size: uploaded.size,
            contentType: uploaded.contentType,
          }
        }),
    }
  }),
)
