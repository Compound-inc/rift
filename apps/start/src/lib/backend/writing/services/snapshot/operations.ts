import { zql } from '@/lib/backend/chat/infra/zero/db'
import {
  assertValidWritingFilePath,
  assertValidWritingFolderPath,
  getWritingParentPath,
  WritingPathError,
} from '@/lib/shared/writing/path-utils'
import {
  WritingConflictError,
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../../domain/errors'
import {
  captureCurrentSnapshotManifest,
  ensureFolderEntries,
  getScopedProject,
  insertSnapshot,
  loadSnapshotManifest,
  now,
  replaceProjectEntries,
  upsertWritingBlob,
  upsertWritingEntry,
} from '../persistence'

export function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export function toInvalidRequestError(
  requestId: string,
  message: string,
  issue: unknown,
) {
  return new WritingInvalidRequestError({
    message,
    requestId,
    issue: issue instanceof Error ? issue.message : String(issue ?? ''),
  })
}

function assertExpectedHead(input: {
  readonly project: {
    readonly id: string
    readonly headSnapshotId?: string | null
  }
  readonly expectedHeadSnapshotId?: string
  readonly requestId: string
  readonly message: string
  readonly path?: string
}) {
  if (
    input.expectedHeadSnapshotId &&
    input.project.headSnapshotId &&
    input.expectedHeadSnapshotId !== input.project.headSnapshotId
  ) {
    throw new WritingConflictError({
      message: input.message,
      requestId: input.requestId,
      projectId: input.project.id,
      expectedHeadSnapshotId: input.expectedHeadSnapshotId,
      actualHeadSnapshotId: input.project.headSnapshotId ?? undefined,
      path: input.path,
    })
  }
}

export async function manualSaveFileOperation(input: {
  readonly db: any
  readonly projectId: string
  readonly userId: string
  readonly organizationId?: string
  readonly path: string
  readonly content: string
  readonly expectedHeadSnapshotId?: string
  readonly summary?: string
  readonly requestId: string
}) {
  const project = await getScopedProject({
    db: input.db,
    projectId: input.projectId,
    userId: input.userId,
    organizationId: input.organizationId,
  })
  if (!project) {
    throw new WritingProjectNotFoundError({
      message: 'Writing project not found',
      requestId: input.requestId,
      projectId: input.projectId,
    })
  }

  assertExpectedHead({
    project,
    expectedHeadSnapshotId: input.expectedHeadSnapshotId,
    requestId: input.requestId,
    message: 'Writing project head changed before the save completed',
    path: input.path,
  })

  const normalizedPath = assertValidWritingFilePath(input.path)
  const parentPath = getWritingParentPath(normalizedPath)
  const createdAt = now()

  await input.db.transaction(async (tx: any) => {
    if (parentPath) {
      await ensureFolderEntries({
        tx,
        projectId: input.projectId,
        folderPath: parentPath,
        createdAt,
      })
    }

    const blob = await upsertWritingBlob({
      tx,
      content: input.content,
    })
    await upsertWritingEntry({
      tx,
      projectId: input.projectId,
      path: normalizedPath,
      kind: 'file',
      blob,
      createdAt,
    })

    const manifest = await captureCurrentSnapshotManifest(tx, input.projectId)
    const snapshotId = await insertSnapshot({
      tx,
      projectId: input.projectId,
      parentSnapshotId: project.headSnapshotId ?? undefined,
      source: 'user',
      summary: input.summary ?? `Updated ${normalizedPath}`,
      createdByUserId: input.userId,
      entries: manifest,
      createdAt,
    })

    await tx.mutate.writingProject.update({
      id: input.projectId,
      headSnapshotId: snapshotId,
      updatedAt: createdAt,
    })
  })

  const updated = await input.db.run(
    zql.writingProject.where('id', input.projectId).one(),
  )
  return {
    headSnapshotId: updated?.headSnapshotId ?? project.headSnapshotId ?? '',
  }
}

export async function createFolderOperation(input: {
  readonly db: any
  readonly projectId: string
  readonly userId: string
  readonly organizationId?: string
  readonly path: string
  readonly expectedHeadSnapshotId?: string
  readonly requestId: string
}) {
  const project = await getScopedProject({
    db: input.db,
    projectId: input.projectId,
    userId: input.userId,
    organizationId: input.organizationId,
  })
  if (!project) {
    throw new WritingProjectNotFoundError({
      message: 'Writing project not found',
      requestId: input.requestId,
      projectId: input.projectId,
    })
  }

  assertExpectedHead({
    project,
    expectedHeadSnapshotId: input.expectedHeadSnapshotId,
    requestId: input.requestId,
    message: 'Writing project head changed before the folder was created',
    path: input.path,
  })

  const normalizedPath = assertValidWritingFolderPath(input.path)
  const createdAt = now()
  await input.db.transaction(async (tx: any) => {
    await ensureFolderEntries({
      tx,
      projectId: input.projectId,
      folderPath: normalizedPath,
      createdAt,
    })
    const manifest = await captureCurrentSnapshotManifest(tx, input.projectId)
    const snapshotId = await insertSnapshot({
      tx,
      projectId: input.projectId,
      parentSnapshotId: project.headSnapshotId ?? undefined,
      source: 'user',
      summary: `Created folder ${normalizedPath}`,
      createdByUserId: input.userId,
      entries: manifest,
      createdAt,
    })
    await tx.mutate.writingProject.update({
      id: input.projectId,
      headSnapshotId: snapshotId,
      updatedAt: createdAt,
    })
  })

  const updated = await input.db.run(
    zql.writingProject.where('id', input.projectId).one(),
  )
  return {
    headSnapshotId: updated?.headSnapshotId ?? project.headSnapshotId ?? '',
  }
}

export async function createCheckpointOperation(input: {
  readonly db: any
  readonly projectId: string
  readonly userId: string
  readonly organizationId?: string
  readonly summary: string
  readonly requestId: string
}) {
  const project = await getScopedProject({
    db: input.db,
    projectId: input.projectId,
    userId: input.userId,
    organizationId: input.organizationId,
  })
  if (!project) {
    throw new WritingProjectNotFoundError({
      message: 'Writing project not found',
      requestId: input.requestId,
      projectId: input.projectId,
    })
  }

  const createdAt = now()
  await input.db.transaction(async (tx: any) => {
    const manifest = await captureCurrentSnapshotManifest(tx, input.projectId)
    const snapshotId = await insertSnapshot({
      tx,
      projectId: input.projectId,
      parentSnapshotId: project.headSnapshotId ?? undefined,
      source: 'user',
      summary: input.summary,
      createdByUserId: input.userId,
      entries: manifest,
      createdAt,
    })
    await tx.mutate.writingProject.update({
      id: input.projectId,
      headSnapshotId: snapshotId,
      updatedAt: createdAt,
    })
  })

  const updated = await input.db.run(
    zql.writingProject.where('id', input.projectId).one(),
  )
  return {
    headSnapshotId: updated?.headSnapshotId ?? project.headSnapshotId ?? '',
  }
}

export async function restoreSnapshotOperation(input: {
  readonly db: any
  readonly projectId: string
  readonly snapshotId: string
  readonly userId: string
  readonly organizationId?: string
  readonly expectedHeadSnapshotId?: string
  readonly requestId: string
}) {
  const project = await getScopedProject({
    db: input.db,
    projectId: input.projectId,
    userId: input.userId,
    organizationId: input.organizationId,
  })
  if (!project) {
    throw new WritingProjectNotFoundError({
      message: 'Writing project not found',
      requestId: input.requestId,
      projectId: input.projectId,
    })
  }

  assertExpectedHead({
    project,
    expectedHeadSnapshotId: input.expectedHeadSnapshotId,
    requestId: input.requestId,
    message: 'Writing project head changed before restore completed',
  })

  const manifest = await loadSnapshotManifest({
    db: input.db,
    snapshotId: input.snapshotId,
  })
  const createdAt = now()
  await input.db.transaction(async (tx: any) => {
    await replaceProjectEntries({
      tx,
      projectId: input.projectId,
      entries: manifest,
      createdAt,
    })

    const restoredManifest = await captureCurrentSnapshotManifest(tx, input.projectId)
    const nextSnapshotId = await insertSnapshot({
      tx,
      projectId: input.projectId,
      parentSnapshotId: project.headSnapshotId ?? undefined,
      source: 'restore',
      summary: `Restored checkpoint ${input.snapshotId}`,
      createdByUserId: input.userId,
      restoredFromSnapshotId: input.snapshotId,
      entries: restoredManifest,
      createdAt,
    })

    await tx.mutate.writingProject.update({
      id: input.projectId,
      headSnapshotId: nextSnapshotId,
      updatedAt: createdAt,
    })
  })

  const updated = await input.db.run(
    zql.writingProject.where('id', input.projectId).one(),
  )
  return {
    headSnapshotId: updated?.headSnapshotId ?? project.headSnapshotId ?? '',
  }
}

export function mapSnapshotPathError(input: {
  readonly error: unknown
  readonly requestId: string
  readonly invalidMessage: string
  readonly persistenceMessage: string
}) {
  if (
    input.error instanceof WritingProjectNotFoundError ||
    input.error instanceof WritingConflictError ||
    input.error instanceof WritingInvalidRequestError
  ) {
    return input.error
  }
  if (input.error instanceof WritingPathError) {
    return toInvalidRequestError(
      input.requestId,
      input.invalidMessage,
      input.error,
    )
  }
  return toPersistenceError(input.requestId, input.persistenceMessage, input.error)
}
