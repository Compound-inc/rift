import { Effect, Layer, ServiceMap } from 'effect'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import { ZeroDatabaseNotConfiguredError, ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import {
  WRITING_DEFAULT_MODEL_ID,
  WRITING_PROJECT_INSTRUCTION_PATH,
} from '@/lib/shared/writing/constants'
import { createDefaultWritingScaffold } from '@/lib/shared/writing/scaffold'
import {
  createProjectSlug,
  getWritingParentPath,
} from '@/lib/shared/writing/path-utils'
import {
  WritingConflictError,
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import {
  captureCurrentSnapshotManifest,
  ensureFolderEntries,
  getScopedProject,
  insertSnapshot,
  now,
  normalizeScopedOrgId,
  upsertWritingBlob,
  upsertWritingEntry,
} from './persistence'

export type WritingProjectServiceShape = {
  readonly createProject: (input: {
    readonly userId: string
    readonly organizationId?: string
    readonly title: string
    readonly description?: string
    readonly requestId: string
  }) => Effect.Effect<
    {
      readonly projectId: string
      readonly defaultChatId: string
      readonly headSnapshotId: string
    },
    WritingInvalidRequestError | WritingConflictError | WritingPersistenceError
  >
  readonly renameProject: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly title: string
    readonly requestId: string
  }) => Effect.Effect<void, WritingProjectNotFoundError | WritingPersistenceError>
  readonly setAutoAcceptMode: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly enabled: boolean
    readonly requestId: string
  }) => Effect.Effect<void, WritingProjectNotFoundError | WritingPersistenceError>
  readonly getProject: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<
    {
      readonly id: string
      readonly ownerUserId: string
      readonly ownerOrgId: string
      readonly title: string
      readonly description?: string | null
      readonly slug: string
      readonly headSnapshotId?: string | null
      readonly defaultChatId?: string | null
      readonly autoAcceptMode: boolean
    },
    WritingProjectNotFoundError | WritingPersistenceError
  >
}

function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export class WritingProjectService extends ServiceMap.Service<
  WritingProjectService,
  WritingProjectServiceShape
>()('writing-backend/WritingProjectService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService

      const createProject: WritingProjectServiceShape['createProject'] = Effect.fn(
        'WritingProjectService.createProject',
      )(({ userId, organizationId, title, description, requestId }) =>
        zeroDatabase
          .withDatabase((db) =>
            Effect.tryPromise({
              try: async () => {
                const normalizedTitle = title.trim()
                if (normalizedTitle.length === 0) {
                  throw new WritingInvalidRequestError({
                    message: 'Project title is required',
                    requestId,
                  })
                }

                const ownerOrgId = normalizeScopedOrgId(organizationId)
                const baseSlug = createProjectSlug(normalizedTitle)
                const siblingProjects = (await db.run(
                  zql.writingProject
                    .where('ownerUserId', userId)
                    .where('ownerOrgId', ownerOrgId)
                    .orderBy('createdAt', 'asc'),
                )) as { slug: string }[]
                const existingSlugs = new Set(siblingProjects.map((project) => project.slug))
                let slug = baseSlug
                let suffix = 2
                while (existingSlugs.has(slug)) {
                  slug = `${baseSlug}-${suffix}`
                  suffix += 1
                }

                const createdAt = now()
                const projectId = crypto.randomUUID()
                const defaultChatId = crypto.randomUUID()

                await db.transaction(async (tx) => {
                  await tx.mutate.writingProject.insert({
                    id: projectId,
                    ownerUserId: userId,
                    ownerOrgId,
                    title: normalizedTitle,
                    slug,
                    description: description?.trim() || undefined,
                    autoAcceptMode: false,
                    createdAt,
                    updatedAt: createdAt,
                  })

                  await tx.mutate.writingProjectChat.insert({
                    id: defaultChatId,
                    projectId,
                    ownerUserId: userId,
                    title: 'Main chat',
                    modelId: WRITING_DEFAULT_MODEL_ID,
                    status: 'active',
                    createdAt,
                    updatedAt: createdAt,
                    lastMessageAt: createdAt,
                  })

                  for (const entry of createDefaultWritingScaffold(normalizedTitle)) {
                    if (entry.kind === 'folder') {
                      if (entry.path !== '/') {
                        await ensureFolderEntries({
                          tx,
                          projectId,
                          folderPath: entry.path,
                          createdAt,
                        })
                      }
                      continue
                    }

                    const parentPath = getWritingParentPath(entry.path)
                    if (parentPath) {
                      await ensureFolderEntries({
                        tx,
                        projectId,
                        folderPath: parentPath,
                        createdAt,
                      })
                    }
                    const blob = await upsertWritingBlob({
                      tx,
                      content: entry.content,
                    })
                    await upsertWritingEntry({
                      tx,
                      projectId,
                      path: entry.path,
                      kind: 'file',
                      blob,
                      createdAt,
                    })
                  }

                  const manifest = await captureCurrentSnapshotManifest(tx, projectId)
                  const snapshotId = await insertSnapshot({
                    tx,
                    projectId,
                    source: 'system',
                    summary: 'Initial project scaffold',
                    chatId: defaultChatId,
                    createdByUserId: userId,
                    entries: manifest,
                    createdAt,
                  })

                  await tx.mutate.writingProject.update({
                    id: projectId,
                    headSnapshotId: snapshotId,
                    defaultChatId,
                    updatedAt: createdAt,
                  })
                })

                const createdProject = await db.run(
                  zql.writingProject.where('id', projectId).one(),
                )
                if (!createdProject?.headSnapshotId || !createdProject.defaultChatId) {
                  throw new WritingConflictError({
                    message: 'Project scaffold was not created correctly',
                    requestId,
                    projectId,
                  })
                }

                return {
                  projectId,
                  defaultChatId: createdProject.defaultChatId,
                  headSnapshotId: createdProject.headSnapshotId,
                }
              },
              catch: (error) => {
                if (
                  error instanceof WritingInvalidRequestError ||
                  error instanceof WritingConflictError
                ) {
                  return error
                }
                return toPersistenceError(requestId, 'Failed to create writing project', error)
              },
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof ZeroDatabaseNotConfiguredError
                ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                : error,
            ),
          ),
      )

      const getProject: WritingProjectServiceShape['getProject'] = Effect.fn(
        'WritingProjectService.getProject',
      )(({ projectId, userId, organizationId, requestId }) =>
        zeroDatabase
          .withDatabase((db) =>
            Effect.tryPromise({
              try: async () => {
                const project = await getScopedProject({
                  db,
                  projectId,
                  userId,
                  organizationId,
                })
                if (!project) {
                  throw new WritingProjectNotFoundError({
                    message: 'Writing project not found',
                    requestId,
                    projectId,
                  })
                }
                return project
              },
              catch: (error) =>
                error instanceof WritingProjectNotFoundError
                  ? error
                  : toPersistenceError(requestId, 'Failed to load writing project', error),
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof ZeroDatabaseNotConfiguredError
                ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                : error,
            ),
          ),
      )

      const renameProject: WritingProjectServiceShape['renameProject'] = Effect.fn(
        'WritingProjectService.renameProject',
      )(({ projectId, userId, organizationId, title, requestId }) =>
        zeroDatabase
          .withDatabase((db) =>
            Effect.tryPromise({
              try: async () => {
                const project = await getScopedProject({
                  db,
                  projectId,
                  userId,
                  organizationId,
                })
                if (!project) {
                  throw new WritingProjectNotFoundError({
                    message: 'Writing project not found',
                    requestId,
                    projectId,
                  })
                }

                const updatedAt = now()
                await db.transaction(async (tx) => {
                  await tx.mutate.writingProject.update({
                    id: projectId,
                    title: title.trim(),
                    slug: createProjectSlug(title),
                    updatedAt,
                  })

                  const instructionEntry = await tx.run(
                    zql.writingEntry
                      .where('projectId', projectId)
                      .where('path', WRITING_PROJECT_INSTRUCTION_PATH)
                      .one(),
                  )
                  if (instructionEntry?.blobId) {
                    const existingBlob = await tx.run(
                      zql.writingBlob.where('id', instructionEntry.blobId).one(),
                    )
                    if (existingBlob) {
                      const updatedInstructions = String(existingBlob.content).replace(
                        /Project: .*/,
                        `Project: ${title.trim()}`,
                      )
                      const blob = await upsertWritingBlob({
                        tx,
                        content: updatedInstructions,
                      })
                      await upsertWritingEntry({
                        tx,
                        projectId,
                        path: WRITING_PROJECT_INSTRUCTION_PATH,
                        kind: 'file',
                        blob,
                        createdAt: updatedAt,
                      })
                    }
                  }
                })
              },
              catch: (error) =>
                error instanceof WritingProjectNotFoundError
                  ? error
                  : toPersistenceError(requestId, 'Failed to rename writing project', error),
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof ZeroDatabaseNotConfiguredError
                ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                : error,
            ),
          ),
      )

      const setAutoAcceptMode: WritingProjectServiceShape['setAutoAcceptMode'] = Effect.fn(
        'WritingProjectService.setAutoAcceptMode',
      )(({ projectId, userId, organizationId, enabled, requestId }) =>
        zeroDatabase
          .withDatabase((db) =>
            Effect.tryPromise({
              try: async () => {
                const project = await getScopedProject({
                  db,
                  projectId,
                  userId,
                  organizationId,
                })
                if (!project) {
                  throw new WritingProjectNotFoundError({
                    message: 'Writing project not found',
                    requestId,
                    projectId,
                  })
                }

                await db.transaction(async (tx) => {
                  await tx.mutate.writingProject.update({
                    id: projectId,
                    autoAcceptMode: enabled,
                    updatedAt: now(),
                  })
                })
              },
              catch: (error) =>
                error instanceof WritingProjectNotFoundError
                  ? error
                  : toPersistenceError(requestId, 'Failed to update auto-accept mode', error),
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof ZeroDatabaseNotConfiguredError
                ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                : error,
            ),
          ),
      )

      return {
        createProject,
        renameProject,
        setAutoAcceptMode,
        getProject,
      }
    }),
  )
}
