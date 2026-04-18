import { zql } from '@/lib/backend/chat/infra/zero/db'
import { createWritingHunks } from '@/lib/shared/writing/diff'
import {
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../../domain/errors'
import { getScopedProject, now } from '../persistence'
import type {
  WritingChangeHunkRow,
  WritingChangeRow,
  WritingChangeSetRow,
} from '../persistence'

export function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export async function getScopedChangeSet(input: {
  readonly db: any
  readonly changeSetId: string
  readonly userId: string
  readonly organizationId?: string
}): Promise<{
  project: Awaited<ReturnType<typeof getScopedProject>>
  changeSet: WritingChangeSetRow | null
}> {
  const changeSet = (await input.db.run(
    zql.writingChangeSet.where('id', input.changeSetId).one(),
  )) as WritingChangeSetRow | null

  if (!changeSet) {
    return { project: null, changeSet: null }
  }

  const project = await getScopedProject({
    db: input.db,
    projectId: changeSet.projectId,
    userId: input.userId,
    organizationId: input.organizationId,
  })

  return { project, changeSet }
}

export async function loadChangeRows(
  db: any,
  changeSetId: string,
): Promise<WritingChangeRow[]> {
  return (await db.run(
    zql.writingChange.where('changeSetId', changeSetId).orderBy('path', 'asc'),
  )) as WritingChangeRow[]
}

export async function loadChangeHunks(
  db: any,
  changeId: string,
): Promise<WritingChangeHunkRow[]> {
  return (await db.run(
    zql.writingChangeHunk.where('changeId', changeId).orderBy('hunkIndex', 'asc'),
  )) as WritingChangeHunkRow[]
}

export async function replaceChangeHunks(input: {
  readonly tx: any
  readonly changeId: string
  readonly hunks: readonly ReturnType<typeof createWritingHunks>[number][]
  readonly createdAt: number
}) {
  const existing = await input.tx.run(
    zql.writingChangeHunk.where('changeId', input.changeId).orderBy('hunkIndex', 'asc'),
  )
  for (const row of existing as WritingChangeHunkRow[]) {
    await input.tx.mutate.writingChangeHunk.delete({ id: row.id })
  }

  for (const hunk of input.hunks) {
    await input.tx.mutate.writingChangeHunk.insert({
      id: crypto.randomUUID(),
      changeId: input.changeId,
      hunkIndex: hunk.index,
      status: 'pending',
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      patchText: hunk.patchText,
      createdAt: input.createdAt,
    })
  }
}

export async function updateChangeSetResolution(input: {
  readonly tx: any
  readonly changeSetId: string
}) {
  const changes = (await input.tx.run(
    zql.writingChange.where('changeSetId', input.changeSetId).orderBy('path', 'asc'),
  )) as WritingChangeRow[]

  const statuses = new Set(changes.map((change) => change.status))
  let nextStatus: WritingChangeSetRow['status'] = 'pending'
  let resolvedAt: number | undefined

  if (statuses.size === 0 || statuses.has('rejected')) {
    nextStatus = 'rejected'
    resolvedAt = now()
  }
  if (statuses.has('conflicted')) {
    nextStatus = 'conflicted'
    resolvedAt = now()
  } else if (changes.length > 0 && [...statuses].every((status) => status === 'applied')) {
    nextStatus = 'applied'
    resolvedAt = now()
  } else if (statuses.has('applied')) {
    nextStatus = 'partially_applied'
  } else if (statuses.has('pending')) {
    nextStatus = 'pending'
  }

  await input.tx.mutate.writingChangeSet.update({
    id: input.changeSetId,
    status: nextStatus,
    resolvedAt,
  })
}

export function assertScopedChangeSetProject(input: {
  readonly project: Awaited<ReturnType<typeof getScopedProject>>
  readonly changeSet: WritingChangeSetRow | null
  readonly requestId: string
}) {
  if (!input.project || !input.changeSet) {
    throw new WritingProjectNotFoundError({
      message: 'Writing project not found',
      requestId: input.requestId,
      projectId: input.changeSet?.projectId ?? 'unknown-project',
    })
  }

  return {
    project: input.project,
    changeSet: input.changeSet,
  }
}
