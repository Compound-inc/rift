import { createHash } from 'node:crypto'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import type { WritingEntryKind, WritingSnapshotSource } from '@/lib/shared/writing'
import {
  WRITING_ROOT_PATH,
  assertValidWritingFolderPath,
  getWritingBaseName,
  getWritingParentPath,
  normalizeWritingPath,
} from '@/lib/shared/writing'

export type WritingProjectRow = {
  readonly id: string
  readonly ownerUserId: string
  readonly ownerOrgId: string
  readonly title: string
  readonly slug: string
  readonly description?: string | null
  readonly headSnapshotId?: string | null
  readonly defaultChatId?: string | null
  readonly autoAcceptMode: boolean
  readonly archivedAt?: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

export type WritingBlobRow = {
  readonly id: string
  readonly sha256: string
  readonly content: string
  readonly byteSize: number
  readonly createdAt: number
}

export type WritingEntryRow = {
  readonly id: string
  readonly projectId: string
  readonly path: string
  readonly parentPath?: string | null
  readonly name: string
  readonly kind: WritingEntryKind
  readonly blobId?: string | null
  readonly sha256?: string | null
  readonly lineCount?: number | null
  readonly sizeBytes?: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

export type WritingSnapshotEntryManifest = {
  readonly path: string
  readonly kind: WritingEntryKind
  readonly blobId?: string
  readonly sha256?: string
  readonly lineCount?: number
  readonly sizeBytes?: number
}

export type WritingProjectChatRow = {
  readonly id: string
  readonly projectId: string
  readonly ownerUserId: string
  readonly title: string
  readonly modelId: string
  readonly status: 'active' | 'archived'
  readonly createdAt: number
  readonly updatedAt: number
  readonly lastMessageAt: number
}

export type WritingChangeSetRow = {
  readonly id: string
  readonly projectId: string
  readonly chatId: string
  readonly assistantMessageId?: string | null
  readonly baseSnapshotId: string
  readonly status:
    | 'pending'
    | 'partially_applied'
    | 'applied'
    | 'rejected'
    | 'conflicted'
  readonly autoAccept: boolean
  readonly summary: string
  readonly createdAt: number
  readonly resolvedAt?: number | null
}

export type WritingChangeRow = {
  readonly id: string
  readonly changeSetId: string
  readonly path: string
  readonly fromPath?: string | null
  readonly operation: 'create' | 'update' | 'delete' | 'move'
  readonly baseBlobId?: string | null
  readonly proposedBlobId?: string | null
  readonly status: 'pending' | 'rejected' | 'applied' | 'conflicted'
  readonly createdAt: number
}

export type WritingChangeHunkRow = {
  readonly id: string
  readonly changeId: string
  readonly hunkIndex: number
  readonly status: 'pending' | 'rejected' | 'applied' | 'conflicted'
  readonly oldStart: number
  readonly oldLines: number
  readonly newStart: number
  readonly newLines: number
  readonly patchText: string
  readonly createdAt: number
}

export function now(): number {
  return Date.now()
}

export function normalizeScopedOrgId(organizationId?: string): string {
  return organizationId?.trim() ?? ''
}

export function hashWritingContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export async function getScopedProject(input: {
  readonly db: any
  readonly projectId: string
  readonly userId: string
  readonly organizationId?: string
}): Promise<WritingProjectRow | null> {
  const ownerOrgId = normalizeScopedOrgId(input.organizationId)

  const row = await input.db.run(
    zql.writingProject
      .where('id', input.projectId)
      .where('ownerUserId', input.userId)
      .where('ownerOrgId', ownerOrgId)
      .one(),
  )

  return (row as WritingProjectRow | null) ?? null
}

export async function getProjectChat(input: {
  readonly db: any
  readonly chatId: string
  readonly projectId: string
}): Promise<WritingProjectChatRow | null> {
  const row = await input.db.run(
    zql.writingProjectChat
      .where('id', input.chatId)
      .where('projectId', input.projectId)
      .one(),
  )

  return (row as WritingProjectChatRow | null) ?? null
}

export async function listProjectEntries(
  db: any,
  projectId: string,
): Promise<readonly WritingEntryRow[]> {
  const rows = await db.run(
    zql.writingEntry.where('projectId', projectId).orderBy('path', 'asc'),
  )
  return rows as readonly WritingEntryRow[]
}

export async function getProjectEntryByPath(input: {
  readonly db: any
  readonly projectId: string
  readonly path: string
}): Promise<WritingEntryRow | null> {
  const normalizedPath = normalizeWritingPath(input.path)
  const row = await input.db.run(
    zql.writingEntry
      .where('projectId', input.projectId)
      .where('path', normalizedPath)
      .one(),
  )
  return (row as WritingEntryRow | null) ?? null
}

export async function getBlobById(
  db: any,
  blobId?: string | null,
): Promise<WritingBlobRow | null> {
  if (!blobId) {
    return null
  }
  const row = await db.run(zql.writingBlob.where('id', blobId).one())
  return (row as WritingBlobRow | null) ?? null
}

export async function upsertWritingBlob(input: {
  readonly tx: any
  readonly content: string
}): Promise<WritingBlobRow> {
  const sha256 = hashWritingContent(input.content)
  const existing = await input.tx.run(zql.writingBlob.where('sha256', sha256).one())
  if (existing) {
    return existing as WritingBlobRow
  }

  const blob: WritingBlobRow = {
    id: crypto.randomUUID(),
    sha256,
    content: input.content,
    byteSize: Buffer.byteLength(input.content, 'utf8'),
    createdAt: now(),
  }

  await input.tx.mutate.writingBlob.insert(blob)
  return blob
}

export async function ensureFolderEntries(input: {
  readonly tx: any
  readonly projectId: string
  readonly folderPath: string
  readonly createdAt: number
}) {
  const normalized = assertValidWritingFolderPath(input.folderPath)
  if (normalized === WRITING_ROOT_PATH) {
    return
  }

  const segments = normalized.split('/').filter(Boolean)
  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    const existing = await input.tx.run(
      zql.writingEntry
        .where('projectId', input.projectId)
        .where('path', currentPath)
        .one(),
    )
    if (existing) {
      continue
    }

    await input.tx.mutate.writingEntry.insert({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      path: currentPath,
      parentPath: getWritingParentPath(currentPath) ?? WRITING_ROOT_PATH,
      name: getWritingBaseName(currentPath),
      kind: 'folder',
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    })
  }
}

export async function upsertWritingEntry(input: {
  readonly tx: any
  readonly projectId: string
  readonly path: string
  readonly kind: WritingEntryKind
  readonly blob?: WritingBlobRow | null
  readonly createdAt: number
}) {
  const normalizedPath = normalizeWritingPath(input.path)
  const existing = await input.tx.run(
    zql.writingEntry
      .where('projectId', input.projectId)
      .where('path', normalizedPath)
      .one(),
  )

  const payload = {
    projectId: input.projectId,
    path: normalizedPath,
    parentPath: getWritingParentPath(normalizedPath) ?? WRITING_ROOT_PATH,
    name: getWritingBaseName(normalizedPath),
    kind: input.kind,
    blobId: input.blob?.id,
    sha256: input.blob?.sha256,
    lineCount: input.blob?.content.split('\n').length ?? undefined,
    sizeBytes: input.blob?.byteSize,
    updatedAt: input.createdAt,
  }

  if (!existing) {
    await input.tx.mutate.writingEntry.insert({
      id: crypto.randomUUID(),
      createdAt: input.createdAt,
      ...payload,
    })
    return
  }

  await input.tx.mutate.writingEntry.update({
    id: existing.id,
    ...payload,
  })
}

export async function deleteProjectEntry(input: {
  readonly tx: any
  readonly projectId: string
  readonly path: string
}) {
  const normalizedPath = normalizeWritingPath(input.path)
  const rows = await input.tx.run(
    zql.writingEntry
      .where('projectId', input.projectId)
      .where('path', 'IN', [normalizedPath])
      .orderBy('path', 'desc'),
  )

  for (const row of rows as WritingEntryRow[]) {
    await input.tx.mutate.writingEntry.delete({ id: row.id })
  }
}

export async function replaceProjectEntries(input: {
  readonly tx: any
  readonly projectId: string
  readonly entries: readonly WritingSnapshotEntryManifest[]
  readonly createdAt: number
}) {
  const existing = await input.tx.run(
    zql.writingEntry.where('projectId', input.projectId).orderBy('path', 'desc'),
  )

  for (const row of existing as WritingEntryRow[]) {
    await input.tx.mutate.writingEntry.delete({ id: row.id })
  }

  for (const entry of [...input.entries].sort((left, right) => left.path.localeCompare(right.path))) {
    if (entry.path === WRITING_ROOT_PATH) {
      continue
    }
    await input.tx.mutate.writingEntry.insert({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      path: entry.path,
      parentPath: getWritingParentPath(entry.path) ?? WRITING_ROOT_PATH,
      name: getWritingBaseName(entry.path),
      kind: entry.kind,
      blobId: entry.blobId,
      sha256: entry.sha256,
      lineCount: entry.lineCount,
      sizeBytes: entry.sizeBytes,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    })
  }
}

export async function captureCurrentSnapshotManifest(
  db: any,
  projectId: string,
): Promise<readonly WritingSnapshotEntryManifest[]> {
  const entries = await listProjectEntries(db, projectId)
  return entries.map((entry) => ({
    path: entry.path,
    kind: entry.kind,
    blobId: entry.blobId ?? undefined,
    sha256: entry.sha256 ?? undefined,
    lineCount: entry.lineCount ?? undefined,
    sizeBytes: entry.sizeBytes ?? undefined,
  }))
}

export async function loadSnapshotManifest(input: {
  readonly db: any
  readonly snapshotId: string
}): Promise<readonly WritingSnapshotEntryManifest[]> {
  const rows = await input.db.run(
    zql.writingSnapshotEntry
      .where('snapshotId', input.snapshotId)
      .orderBy('path', 'asc'),
  )

  return (rows as any[]).map((row) => ({
    path: row.path,
    kind: row.kind,
    blobId: row.blobId ?? undefined,
    sha256: row.sha256 ?? undefined,
    lineCount: row.lineCount ?? undefined,
  }))
}

export async function insertSnapshot(input: {
  readonly tx: any
  readonly projectId: string
  readonly parentSnapshotId?: string
  readonly source: WritingSnapshotSource
  readonly summary: string
  readonly chatId?: string
  readonly messageId?: string
  readonly createdByUserId: string
  readonly restoredFromSnapshotId?: string
  readonly entries: readonly WritingSnapshotEntryManifest[]
  readonly createdAt: number
}): Promise<string> {
  const snapshotId = crypto.randomUUID()

  await input.tx.mutate.writingSnapshot.insert({
    id: snapshotId,
    projectId: input.projectId,
    parentSnapshotId: input.parentSnapshotId,
    source: input.source,
    summary: input.summary,
    chatId: input.chatId,
    messageId: input.messageId,
    createdByUserId: input.createdByUserId,
    restoredFromSnapshotId: input.restoredFromSnapshotId,
    createdAt: input.createdAt,
  })

  for (const entry of input.entries) {
    if (entry.path === WRITING_ROOT_PATH) {
      continue
    }
    await input.tx.mutate.writingSnapshotEntry.insert({
      id: crypto.randomUUID(),
      snapshotId,
      path: entry.path,
      kind: entry.kind,
      blobId: entry.blobId,
      sha256: entry.sha256,
      lineCount: entry.lineCount,
    })
  }

  return snapshotId
}
