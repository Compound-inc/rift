import { Effect, Layer, ServiceMap } from 'effect'
import {
  buildAttachmentChunkRows,
  normalizeMarkdownForStorage,
} from '@/lib/backend/chat/services/rag/attachment-content.pipeline'
import { ProjectSourceRagService } from '@/lib/backend/chat/services/rag'
import { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import {
  MarkdownConversionService,
} from '@/lib/backend/file/services/markdown-conversion.service'
import { readDirectTextFileContent } from '@/lib/backend/file/services/plain-text-file'
import {
  ZeroDatabaseNotConfiguredError,
  ZeroDatabaseService,
} from '@/lib/backend/server-effect/services/zero-database.service'
import {
  UploadServiceError,
  uploadService,
} from '@/lib/backend/upload/upload.service'
import { PROJECT_SOURCES_UPLOAD_POLICY } from '@/lib/shared/upload/upload-validation'
import { summarizeProjectSourceIndexError } from '@/lib/shared/project-sources'
import { checkProjectAccess } from '@/lib/shared/projects/access'
import { ProjectSourcesPersistenceError } from '../domain/errors'

type ProjectSourceAttachmentRow = {
  readonly id: string
  readonly userId: string
  readonly ownerOrgId?: string
  readonly projectId?: string
  readonly fileContent?: string
  readonly status?: 'deleted' | 'uploaded'
}

export type ProjectSourcesAdminServiceShape = {
  readonly uploadProjectSource: (input: {
    readonly projectId: string
    readonly userId: string
    readonly file: File
    readonly requestId: string
  }) => Effect.Effect<
    { readonly attachmentId: string },
    ProjectSourcesPersistenceError
  >
  readonly deleteProjectSource: (input: {
    readonly projectId: string
    readonly attachmentId: string
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<void, ProjectSourcesPersistenceError>
  readonly retryProjectSourceIndex: (input: {
    readonly projectId: string
    readonly attachmentId: string
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<void, ProjectSourcesPersistenceError>
}

/**
 * Owner-managed project source lifecycle. Project files are always active for
 * every Thread in the Project, so unlike org knowledge there is no per-file
 * activation flag.
 */
export class ProjectSourcesAdminService extends ServiceMap.Service<
  ProjectSourcesAdminService,
  ProjectSourcesAdminServiceShape
>()('project-sources/ProjectSourcesAdminService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const attachmentRecord = yield* AttachmentRecordService
      const markdownConversion = yield* MarkdownConversionService
      const projectSourceRag = yield* ProjectSourceRagService
      const zeroDatabase = yield* ZeroDatabaseService

      const withDb = <TValue>(
        input: {
          readonly message: string
          readonly requestId: string
          readonly projectId: string
          readonly attachmentId?: string
        },
        run: Parameters<typeof zeroDatabase.withDatabase<TValue, ProjectSourcesPersistenceError, never>>[0],
      ) =>
        zeroDatabase.withDatabase(run).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? new ProjectSourcesPersistenceError({
                  message: input.message,
                  requestId: input.requestId,
                  projectId: input.projectId,
                  attachmentId: input.attachmentId,
                  cause: error.message,
                })
              : error,
          ),
        )

      const loadOwnedProject = Effect.fn(
        'ProjectSourcesAdminService.loadOwnedProject',
      )(
        ({
          projectId,
          userId,
          requestId,
        }: {
          readonly projectId: string
          readonly userId: string
          readonly requestId: string
        }) =>
          withDb({
            message: 'Failed to load project',
            requestId,
            projectId,
          }, (db) =>
            Effect.tryPromise({
              try: () => db.run(zql.project.where('id', projectId).one()),
              catch: (error) =>
                new ProjectSourcesPersistenceError({
                  message: 'Failed to load project',
                  requestId,
                  projectId,
                  cause: String(error),
                }),
            }).pipe(
              Effect.flatMap((project) => {
                const access = checkProjectAccess(project, {
                  userId,
                  orgContext: { enforce: false },
                })
                if (access.kind !== 'ok') {
                  return Effect.fail(
                    new ProjectSourcesPersistenceError({
                      message: 'Project is not available',
                      requestId,
                      projectId,
                      cause: `project_access_${access.kind}`,
                    }),
                  )
                }
                return Effect.succeed(access.project)
              }),
            ),
          ),
      )

      const getAttachment = Effect.fn(
        'ProjectSourcesAdminService.getAttachment',
      )(
        ({
          projectId,
          attachmentId,
          userId,
          requestId,
        }: {
          readonly projectId: string
          readonly attachmentId: string
          readonly userId: string
          readonly requestId: string
        }) =>
          Effect.gen(function* () {
            yield* loadOwnedProject({ projectId, userId, requestId })
            return yield* attachmentRecord
              .getProjectSourceAttachmentRecord({
                projectId,
                attachmentId,
              })
              .pipe(
                Effect.map((attachment) =>
                  attachment as ProjectSourceAttachmentRow | null,
                ),
                Effect.mapError(
                  (error) =>
                    new ProjectSourcesPersistenceError({
                      message: 'Failed to load project source',
                      requestId,
                      projectId,
                      attachmentId,
                      cause: String(error),
                    }),
                ),
              )
          }),
      )

      const updateIndexState = Effect.fn(
        'ProjectSourcesAdminService.updateIndexState',
      )(
        (input: {
          readonly projectId: string
          readonly attachmentId: string
          readonly embeddingStatus: 'indexed' | 'disabled' | 'failed'
          readonly vectorIndexedAt?: number
          readonly vectorError?: string
          readonly requestId: string
        }) =>
          withDb({
            message: 'Failed to update project source index state',
            requestId: input.requestId,
            projectId: input.projectId,
            attachmentId: input.attachmentId,
          }, (db) =>
            Effect.tryPromise({
              try: () =>
                db.transaction(async (tx) => {
                  await tx.mutate.attachment.update({
                    id: input.attachmentId,
                    embeddingStatus: input.embeddingStatus,
                    vectorIndexedAt: input.vectorIndexedAt,
                    vectorError: summarizeProjectSourceIndexError(
                      input.vectorError,
                    ),
                    updatedAt: Date.now(),
                  })
                }),
              catch: (error) =>
                new ProjectSourcesPersistenceError({
                  message: 'Failed to update project source index state',
                  requestId: input.requestId,
                  projectId: input.projectId,
                  attachmentId: input.attachmentId,
                  cause: String(error),
                }),
            }),
          ),
      )

      const indexStoredMarkdown = Effect.fn(
        'ProjectSourcesAdminService.indexStoredMarkdown',
      )(
        (input: {
          readonly projectId: string
          readonly organizationId?: string
          readonly attachmentId: string
          readonly userId: string
          readonly markdown: string
          readonly requestId: string
        }) =>
          Effect.gen(function* () {
            const chunkBuild = yield* Effect.tryPromise({
              try: () =>
                buildAttachmentChunkRows({
                  attachmentId: input.attachmentId,
                  userId: input.userId,
                  markdown: input.markdown,
                  now: Date.now(),
                }),
              catch: (error) =>
                new ProjectSourcesPersistenceError({
                  message: 'Failed to prepare project source chunks',
                  requestId: input.requestId,
                  projectId: input.projectId,
                  attachmentId: input.attachmentId,
                  cause: String(error),
                }),
            })

            yield* projectSourceRag.indexProjectSourceChunks({
              chunks: chunkBuild.chunks.map((chunk) => ({
                ...chunk,
                scopeType: 'project_source' as const,
                sourceId: chunk.attachmentId,
                ownerOrgId: input.organizationId,
                projectId: input.projectId,
                accessScope: 'project' as const,
                embedding: chunk.embedding ?? [],
                embeddingModel: chunkBuild.metrics.embeddingModel,
              })),
            }).pipe(
              Effect.catch((error) =>
                updateIndexState({
                  projectId: input.projectId,
                  attachmentId: input.attachmentId,
                  embeddingStatus: 'failed',
                  vectorError: summarizeProjectSourceIndexError(
                    error instanceof Error ? error.message : String(error),
                  ),
                  requestId: input.requestId,
                }).pipe(
                  Effect.flatMap(() =>
                    Effect.fail(
                      new ProjectSourcesPersistenceError({
                        message: 'Failed to index project source vectors',
                        requestId: input.requestId,
                        projectId: input.projectId,
                        attachmentId: input.attachmentId,
                        cause: String(error),
                      }),
                    ),
                  ),
                ),
              ),
            )

            yield* updateIndexState({
              projectId: input.projectId,
              attachmentId: input.attachmentId,
              embeddingStatus: chunkBuild.metrics.embeddingStatus,
              vectorIndexedAt:
                chunkBuild.metrics.embeddingStatus === 'indexed'
                  ? Date.now()
                  : undefined,
              vectorError: undefined,
              requestId: input.requestId,
            })

            return chunkBuild.metrics
          }),
      )

      const uploadProjectSource: ProjectSourcesAdminServiceShape['uploadProjectSource'] =
        Effect.fn('ProjectSourcesAdminService.uploadProjectSource')(
          ({ projectId, userId, file, requestId }) =>
            Effect.gen(function* () {
              const project = yield* loadOwnedProject({
                projectId,
                userId,
                requestId,
              })
              const uploaded = yield* Effect.tryPromise({
                try: () =>
                  uploadService.upload({
                    userId,
                    file,
                    validationPolicy: PROJECT_SOURCES_UPLOAD_POLICY,
                  }),
                catch: (error) =>
                  new ProjectSourcesPersistenceError({
                    message:
                      error instanceof UploadServiceError
                        ? error.message
                        : 'Failed to upload project source file',
                    requestId,
                    projectId,
                    cause: String(error),
                  }),
              })

              const attachmentId = crypto.randomUUID()
              const now = Date.now()
              const directTextContent = yield* Effect.tryPromise({
                try: () => readDirectTextFileContent(file),
                catch: (error) =>
                  new ProjectSourcesPersistenceError({
                    message: 'Failed to extract project source content',
                    requestId,
                    projectId,
                    attachmentId,
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
                      new ProjectSourcesPersistenceError({
                        message:
                          error instanceof Error
                            ? error.message
                            : 'Failed to extract project source content',
                        requestId,
                        projectId,
                        attachmentId,
                        cause: String(error),
                      }),
                  ),
                ))
              const markdown = normalizeMarkdownForStorage(markdownRaw)
              const chunkBuild = yield* Effect.tryPromise({
                try: () =>
                  buildAttachmentChunkRows({
                    attachmentId,
                    userId,
                    markdown,
                    now,
                  }),
                catch: (error) =>
                  new ProjectSourcesPersistenceError({
                    message: 'Failed to prepare project source chunks',
                    requestId,
                    projectId,
                    attachmentId,
                    cause: String(error),
                  }),
              })

              yield* attachmentRecord.insertAttachmentRecord({
                id: attachmentId,
                userId,
                ownerOrgId: project.organizationId ?? undefined,
                projectId,
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
                accessScope: 'project',
                accessGroupIds: [],
                status: 'uploaded',
                createdAt: now,
                updatedAt: now,
              }).pipe(
                Effect.mapError(
                  (error) =>
                    new ProjectSourcesPersistenceError({
                      message: 'Failed to persist project source attachment',
                      requestId,
                      projectId,
                      attachmentId,
                      cause: String(error),
                    }),
                ),
              )

              yield* projectSourceRag.indexProjectSourceChunks({
                chunks: chunkBuild.chunks.map((chunk) => ({
                  ...chunk,
                  scopeType: 'project_source' as const,
                  sourceId: chunk.attachmentId,
                  ownerOrgId: project.organizationId ?? undefined,
                  projectId,
                  accessScope: 'project' as const,
                  embedding: chunk.embedding ?? [],
                  embeddingModel: chunkBuild.metrics.embeddingModel,
                })),
              }).pipe(
                Effect.flatMap(() =>
                  updateIndexState({
                    projectId,
                    attachmentId,
                    embeddingStatus: chunkBuild.metrics.embeddingStatus,
                    vectorIndexedAt:
                      chunkBuild.metrics.embeddingStatus === 'indexed'
                        ? Date.now()
                        : undefined,
                    vectorError: undefined,
                    requestId,
                  }),
                ),
                Effect.catch((error) =>
                  updateIndexState({
                    projectId,
                    attachmentId,
                    embeddingStatus: 'failed',
                    vectorError: summarizeProjectSourceIndexError(
                      error instanceof Error ? error.message : String(error),
                    ),
                    requestId,
                  }).pipe(
                    Effect.flatMap(() =>
                      Effect.fail(
                        new ProjectSourcesPersistenceError({
                          message: 'Failed to index project source vectors',
                          requestId,
                          projectId,
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

      const deleteProjectSource: ProjectSourcesAdminServiceShape['deleteProjectSource'] =
        Effect.fn('ProjectSourcesAdminService.deleteProjectSource')(
          ({ projectId, attachmentId, userId, requestId }) =>
            Effect.gen(function* () {
              const attachment = yield* getAttachment({
                projectId,
                attachmentId,
                userId,
                requestId,
              })
              if (!attachment || attachment.status !== 'uploaded') {
                return yield* Effect.fail(
                  new ProjectSourcesPersistenceError({
                    message: 'Project source attachment is not available',
                    requestId,
                    projectId,
                    attachmentId,
                  }),
                )
              }

              yield* projectSourceRag.deleteProjectSourceChunks({
                projectId,
                attachmentIds: [attachmentId],
              }).pipe(
                Effect.catch((error) =>
                  Effect.fail(
                    new ProjectSourcesPersistenceError({
                      message: 'Failed to delete project source vectors',
                      requestId,
                      projectId,
                      attachmentId,
                      cause: String(error),
                    }),
                  ),
                ),
              )

              yield* withDb({
                message: 'Failed to delete project source',
                requestId,
                projectId,
                attachmentId,
              }, (db) =>
                Effect.tryPromise({
                  try: () =>
                    db.transaction(async (tx) => {
                      await tx.mutate.attachment.update({
                        id: attachmentId,
                        status: 'deleted',
                        updatedAt: Date.now(),
                      })
                    }),
                  catch: (error) =>
                    new ProjectSourcesPersistenceError({
                      message: 'Failed to delete project source',
                      requestId,
                      projectId,
                      attachmentId,
                      cause: String(error),
                    }),
                }),
              )
            }),
        )

      const retryProjectSourceIndex: ProjectSourcesAdminServiceShape['retryProjectSourceIndex'] =
        Effect.fn('ProjectSourcesAdminService.retryProjectSourceIndex')(
          ({ projectId, attachmentId, userId, requestId }) =>
            Effect.gen(function* () {
              const attachment = yield* getAttachment({
                projectId,
                attachmentId,
                userId,
                requestId,
              })
              if (
                !attachment ||
                attachment.status !== 'uploaded' ||
                !attachment.fileContent
              ) {
                return yield* Effect.fail(
                  new ProjectSourcesPersistenceError({
                    message: 'Project source attachment is not available for reindexing',
                    requestId,
                    projectId,
                    attachmentId,
                  }),
                )
              }

              yield* indexStoredMarkdown({
                projectId,
                organizationId: attachment.ownerOrgId,
                attachmentId,
                userId: attachment.userId,
                markdown: attachment.fileContent,
                requestId,
              })
            }),
        )

      return {
        uploadProjectSource,
        deleteProjectSource,
        retryProjectSourceIndex,
      }
    }),
  )
}
