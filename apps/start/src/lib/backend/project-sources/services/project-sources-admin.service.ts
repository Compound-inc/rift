import { Effect, Layer, ServiceMap } from 'effect'
import {
  RagIndexerService,
  normalizeMarkdownForStorage,
} from '@/lib/backend/rag'
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
import { projectOwnerIsMember } from '@/integrations/zero/project-access'
import { checkProjectAccess } from '@/lib/shared/projects/access'
import { ProjectSourcesPersistenceError } from '../domain/errors'

type ProjectSourceAttachmentRow = {
  readonly id: string
  readonly userId: string
  readonly ownerOrgId?: string
  readonly projectId?: string
  readonly fileName: string
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
 * activation flag. Indexing goes through the shared `RagIndexerService`; an
 * indexing failure is recorded on the row (retryable) and never fails the
 * upload.
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
      const ragIndexer = yield* RagIndexerService
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
              try: async () => {
                const project = await db.run(zql.project.where('id', projectId).one())
                const ownerIsMember = await projectOwnerIsMember(db, project)
                return { project, ownerIsMember }
              },
              catch: (error) =>
                new ProjectSourcesPersistenceError({
                  message: 'Failed to load project',
                  requestId,
                  projectId,
                  cause: String(error),
                }),
            }).pipe(
              Effect.flatMap(({ project, ownerIsMember }) => {
                const access = checkProjectAccess(project, {
                  userId,
                  ownerIsMember,
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

      const reindexStoredMarkdown = Effect.fn(
        'ProjectSourcesAdminService.reindexStoredMarkdown',
      )(
        (input: {
          readonly projectId: string
          readonly organizationId?: string
          readonly attachmentId: string
          readonly fileName: string
          readonly userId: string
          readonly markdown: string
          readonly requestId: string
        }) =>
          Effect.gen(function* () {
            const index = yield* ragIndexer.indexDocument({
              scope: 'project_source',
              attachmentId: input.attachmentId,
              fileName: input.fileName,
              markdown: input.markdown,
              ownership: {
                userId: input.userId,
                ownerOrgId: input.organizationId,
                projectId: input.projectId,
                accessScope: 'project',
              },
              replaceExisting: true,
            })

            yield* updateIndexState({
              projectId: input.projectId,
              attachmentId: input.attachmentId,
              embeddingStatus: index.embeddingStatus,
              vectorIndexedAt: index.vectorIndexedAt,
              vectorError: index.vectorError,
              requestId: input.requestId,
            })

            if (index.embeddingStatus === 'failed') {
              return yield* Effect.fail(
                new ProjectSourcesPersistenceError({
                  message: 'Failed to index project source vectors',
                  requestId: input.requestId,
                  projectId: input.projectId,
                  attachmentId: input.attachmentId,
                  cause: index.vectorError,
                }),
              )
            }
            return index
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
              const ownerOrgId = project.organizationId ?? undefined
              const index = yield* ragIndexer.indexDocument({
                scope: 'project_source',
                attachmentId,
                fileName: uploaded.name,
                markdown,
                ownership: {
                  userId,
                  ownerOrgId,
                  projectId,
                  accessScope: 'project',
                },
              })

              yield* attachmentRecord.insertAttachmentRecord({
                id: attachmentId,
                userId,
                ownerOrgId,
                projectId,
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
                vectorError: summarizeProjectSourceIndexError(index.vectorError),
                accessScope: 'project',
                accessGroupIds: [],
                status: 'uploaded',
                createdAt: now,
                updatedAt: now,
              }).pipe(
                Effect.tapError(() =>
                  ragIndexer
                    .deleteDocuments({
                      tenant: { scope: 'project_source', projectId },
                      attachmentIds: [attachmentId],
                    })
                    .pipe(Effect.ignore),
                ),
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

              yield* ragIndexer.deleteDocuments({
                tenant: { scope: 'project_source', projectId },
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

              yield* reindexStoredMarkdown({
                projectId,
                organizationId: attachment.ownerOrgId,
                attachmentId,
                fileName: attachment.fileName,
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
