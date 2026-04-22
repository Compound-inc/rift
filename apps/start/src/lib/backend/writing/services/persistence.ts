import { createHash } from 'node:crypto'
import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import type {
  WritingEntryKind,
  WritingSnapshotSource,
} from '@/lib/shared/writing/constants'
import { WRITING_ROOT_PATH } from '@/lib/shared/writing/constants'
import {
  assertValidWritingFolderPath,
  getWritingBaseName,
  getWritingParentPath,
  normalizeWritingPath,
} from '@/lib/shared/writing/path-utils'
import { createWritingHunks } from '@/lib/shared/writing/diff'

export type WritingProjectRow = {
  readonly id: string
  readonly ownerUserId: string
  readonly ownerOrgId: string
  readonly title: string
  readonly slug: string
  readonly description?: string | null
  readonly headSnapshotId?: string | null
  readonly defaultConversationId?: string | null
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

export type WritingProjectConversationRow = {
  readonly id: string
  readonly product: string
  readonly scopeType: string
  readonly scopeId: string
  readonly ownerUserId: string
  readonly ownerOrgId: string
  readonly title: string
  readonly defaultModelId: string
  readonly status: 'active' | 'archived'
  readonly metadataJson: Record<string, unknown>
  readonly createdAt: number
  readonly updatedAt: number
  readonly lastMessageAt: number
}

export type WritingChangeSetRow = {
  readonly id: string
  readonly projectId: string
  readonly conversationId: string
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

type WritingProjectSqlRow = {
  readonly id: string
  readonly owner_user_id: string
  readonly owner_org_id: string
  readonly title: string
  readonly slug: string
  readonly description: string | null
  readonly head_snapshot_id: string | null
  readonly default_conversation_id: string | null
  readonly auto_accept_mode: boolean
  readonly archived_at: number | null
  readonly created_at: number
  readonly updated_at: number
}

type WritingConversationSqlRow = {
  readonly id: string
  readonly product: string
  readonly scope_type: string
  readonly scope_id: string
  readonly owner_user_id: string
  readonly owner_org_id: string
  readonly title: string
  readonly default_model_id: string
  readonly status: 'active' | 'archived'
  readonly metadata_json: unknown
  readonly created_at: number
  readonly updated_at: number
  readonly last_message_at: number
}

type WritingEntrySqlRow = {
  readonly id: string
  readonly project_id: string
  readonly path: string
  readonly parent_path: string | null
  readonly name: string
  readonly kind: WritingEntryKind
  readonly blob_id: string | null
  readonly sha256: string | null
  readonly line_count: number | null
  readonly size_bytes: number | null
  readonly created_at: number
  readonly updated_at: number
}

type WritingBlobSqlRow = {
  readonly id: string
  readonly sha256: string
  readonly content: string
  readonly byte_size: number
  readonly created_at: number
}

type WritingSnapshotEntrySqlRow = {
  readonly path: string
  readonly kind: WritingEntryKind
  readonly blob_id: string | null
  readonly sha256: string | null
  readonly line_count: number | null
}

type WritingChangeSetSqlRow = {
  readonly id: string
  readonly project_id: string
  readonly conversation_id: string
  readonly assistant_message_id: string | null
  readonly base_snapshot_id: string
  readonly status: WritingChangeSetRow['status']
  readonly auto_accept: boolean
  readonly summary: string
  readonly created_at: number
  readonly resolved_at: number | null
}

type WritingChangeSqlRow = {
  readonly id: string
  readonly change_set_id: string
  readonly path: string
  readonly from_path: string | null
  readonly operation: WritingChangeRow['operation']
  readonly base_blob_id: string | null
  readonly proposed_blob_id: string | null
  readonly status: WritingChangeRow['status']
  readonly created_at: number
}

type WritingChangeHunkSqlRow = {
  readonly id: string
  readonly change_id: string
  readonly hunk_index: number
  readonly status: WritingChangeHunkRow['status']
  readonly old_start: number
  readonly old_lines: number
  readonly new_start: number
  readonly new_lines: number
  readonly patch_text: string
  readonly created_at: number
}

function mapWritingProjectSqlRow(row: WritingProjectSqlRow): WritingProjectRow {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerOrgId: row.owner_org_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    headSnapshotId: row.head_snapshot_id,
    defaultConversationId: row.default_conversation_id,
    autoAcceptMode: row.auto_accept_mode,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWritingConversationSqlRow(
  row: WritingConversationSqlRow,
): WritingProjectConversationRow {
  return {
    id: row.id,
    product: row.product,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    ownerUserId: row.owner_user_id,
    ownerOrgId: row.owner_org_id,
    title: row.title,
    defaultModelId: row.default_model_id,
    status: row.status,
    metadataJson:
      typeof row.metadata_json === 'object' && row.metadata_json !== null
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  }
}

function mapWritingEntrySqlRow(row: WritingEntrySqlRow): WritingEntryRow {
  return {
    id: row.id,
    projectId: row.project_id,
    path: row.path,
    parentPath: row.parent_path,
    name: row.name,
    kind: row.kind,
    blobId: row.blob_id,
    sha256: row.sha256,
    lineCount: row.line_count,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWritingBlobSqlRow(row: WritingBlobSqlRow): WritingBlobRow {
  return {
    id: row.id,
    sha256: row.sha256,
    content: row.content,
    byteSize: row.byte_size,
    createdAt: row.created_at,
  }
}

function mapWritingChangeSetSqlRow(row: WritingChangeSetSqlRow): WritingChangeSetRow {
  return {
    id: row.id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    assistantMessageId: row.assistant_message_id,
    baseSnapshotId: row.base_snapshot_id,
    status: row.status,
    autoAccept: row.auto_accept,
    summary: row.summary,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

function mapWritingChangeSqlRow(row: WritingChangeSqlRow): WritingChangeRow {
  return {
    id: row.id,
    changeSetId: row.change_set_id,
    path: row.path,
    fromPath: row.from_path,
    operation: row.operation,
    baseBlobId: row.base_blob_id,
    proposedBlobId: row.proposed_blob_id,
    status: row.status,
    createdAt: row.created_at,
  }
}

function mapWritingChangeHunkSqlRow(row: WritingChangeHunkSqlRow): WritingChangeHunkRow {
  return {
    id: row.id,
    changeId: row.change_id,
    hunkIndex: row.hunk_index,
    status: row.status,
    oldStart: row.old_start,
    oldLines: row.old_lines,
    newStart: row.new_start,
    newLines: row.new_lines,
    patchText: row.patch_text,
    createdAt: row.created_at,
  }
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

/**
 * Shared SQL helper for project lookups. Callers that mutate project-linked
 * state can opt into `forUpdate` so the project head stays stable across the
 * rest of the transaction.
 */
export const getScopedProjectWithSql = Effect.fn(
  'WritingPersistence.getScopedProjectWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly projectId: string
      readonly userId: string
      readonly organizationId?: string
      readonly forUpdate?: boolean
    },
  ) =>
    Effect.gen(function* () {
      const rows = input.forUpdate
        ? yield* sql<WritingProjectSqlRow>`
            select *
            from writing_projects
            where id = ${input.projectId}
              and owner_user_id = ${input.userId}
              and owner_org_id = ${normalizeScopedOrgId(input.organizationId)}
            limit 1
            for update
          `
        : yield* sql<WritingProjectSqlRow>`
            select *
            from writing_projects
            where id = ${input.projectId}
              and owner_user_id = ${input.userId}
              and owner_org_id = ${normalizeScopedOrgId(input.organizationId)}
            limit 1
          `

      const row = rows[0]
      return row ? mapWritingProjectSqlRow(row) : null
    }),
)

export const getProjectConversationWithSql = Effect.fn(
  'WritingPersistence.getProjectConversationWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly conversationId: string
      readonly projectId: string
      readonly forUpdate?: boolean
    },
  ) =>
    Effect.gen(function* () {
      const rows = input.forUpdate
        ? yield* sql<WritingConversationSqlRow>`
            select *
            from agent_conversations
            where id = ${input.conversationId}
              and product = 'writing'
              and scope_type = 'writing_project'
              and scope_id = ${input.projectId}
            limit 1
            for update
          `
        : yield* sql<WritingConversationSqlRow>`
            select *
            from agent_conversations
            where id = ${input.conversationId}
              and product = 'writing'
              and scope_type = 'writing_project'
              and scope_id = ${input.projectId}
            limit 1
          `

      const row = rows[0]
      return row ? mapWritingConversationSqlRow(row) : null
    }),
)

export const listProjectEntriesWithSql = Effect.fn(
  'WritingPersistence.listProjectEntriesWithSql',
)((sql: PgClient.PgClient, projectId: string) =>
  Effect.gen(function* () {
    const rows = yield* sql<WritingEntrySqlRow>`
      select *
      from writing_entries
      where project_id = ${projectId}
      order by path asc
    `

    return rows.map(mapWritingEntrySqlRow)
  }),
)

export const getProjectEntryByPathWithSql = Effect.fn(
  'WritingPersistence.getProjectEntryByPathWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly projectId: string
      readonly path: string
    },
  ) =>
    Effect.gen(function* () {
      const normalizedPath = normalizeWritingPath(input.path)
      const rows = yield* sql<WritingEntrySqlRow>`
        select *
        from writing_entries
        where project_id = ${input.projectId}
          and path = ${normalizedPath}
        limit 1
      `

      const row = rows[0]
      return row ? mapWritingEntrySqlRow(row) : null
    }),
)

export const getBlobByIdWithSql = Effect.fn('WritingPersistence.getBlobByIdWithSql')(
  (sql: PgClient.PgClient, blobId?: string | null) =>
    Effect.gen(function* () {
      if (!blobId) {
        return null
      }

      const rows = yield* sql<WritingBlobSqlRow>`
        select *
        from writing_blobs
        where id = ${blobId}
        limit 1
      `

      const row = rows[0]
      return row ? mapWritingBlobSqlRow(row) : null
    }),
)

export const upsertWritingBlobWithSql = Effect.fn(
  'WritingPersistence.upsertWritingBlobWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly content: string
    },
  ) =>
    Effect.gen(function* () {
      const sha256 = hashWritingContent(input.content)
      const existingRows = yield* sql<WritingBlobSqlRow>`
        select *
        from writing_blobs
        where sha256 = ${sha256}
        limit 1
      `
      const existing = existingRows[0]
      if (existing) {
        return mapWritingBlobSqlRow(existing)
      }

      const blobId = crypto.randomUUID()
      const createdAt = now()
      const byteSize = Buffer.byteLength(input.content, 'utf8')

      yield* sql`
        insert into writing_blobs (
          id,
          sha256,
          content,
          byte_size,
          created_at
        ) values (
          ${blobId},
          ${sha256},
          ${input.content},
          ${byteSize},
          ${createdAt}
        )
        on conflict (sha256) do nothing
      `

      const rows = yield* sql<WritingBlobSqlRow>`
        select *
        from writing_blobs
        where sha256 = ${sha256}
        limit 1
      `
      const row = rows[0]
      if (!row) {
        return yield* Effect.die(
          new Error('writing blob insert did not return a persisted row'),
        )
      }

      return mapWritingBlobSqlRow(row)
    }),
)

const insertFolderEntryWithSql = Effect.fn(
  'WritingPersistence.insertFolderEntryWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly projectId: string
      readonly path: string
      readonly createdAt: number
    },
  ) =>
    sql`
      insert into writing_entries (
        id,
        project_id,
        path,
        parent_path,
        name,
        kind,
        blob_id,
        sha256,
        line_count,
        size_bytes,
        created_at,
        updated_at
      ) values (
        ${crypto.randomUUID()},
        ${input.projectId},
        ${input.path},
        ${getWritingParentPath(input.path) ?? WRITING_ROOT_PATH},
        ${getWritingBaseName(input.path)},
        'folder',
        null,
        null,
        null,
        null,
        ${input.createdAt},
        ${input.createdAt}
      )
      on conflict (project_id, path) do nothing
    `,
)

export const ensureFolderEntriesWithSql = Effect.fn(
  'WritingPersistence.ensureFolderEntriesWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly projectId: string
      readonly folderPath: string
      readonly createdAt: number
    },
  ) =>
    Effect.gen(function* () {
      const normalized = assertValidWritingFolderPath(input.folderPath)
      if (normalized === WRITING_ROOT_PATH) {
        return
      }

      const segments = normalized.split('/').filter(Boolean)
      let currentPath = ''
      for (const segment of segments) {
        currentPath += `/${segment}`
        yield* insertFolderEntryWithSql(sql, {
          projectId: input.projectId,
          path: currentPath,
          createdAt: input.createdAt,
        })
      }
    }),
)

export const upsertWritingEntryWithSql = Effect.fn(
  'WritingPersistence.upsertWritingEntryWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly projectId: string
      readonly path: string
      readonly kind: WritingEntryKind
      readonly blob?: WritingBlobRow | null
      readonly createdAt: number
    },
  ) =>
    Effect.gen(function* () {
      const normalizedPath = normalizeWritingPath(input.path)
      yield* sql`
        insert into writing_entries (
          id,
          project_id,
          path,
          parent_path,
          name,
          kind,
          blob_id,
          sha256,
          line_count,
          size_bytes,
          created_at,
          updated_at
        ) values (
          ${crypto.randomUUID()},
          ${input.projectId},
          ${normalizedPath},
          ${getWritingParentPath(normalizedPath) ?? WRITING_ROOT_PATH},
          ${getWritingBaseName(normalizedPath)},
          ${input.kind},
          ${input.blob?.id ?? null},
          ${input.blob?.sha256 ?? null},
          ${input.blob ? input.blob.content.split('\n').length : null},
          ${input.blob?.byteSize ?? null},
          ${input.createdAt},
          ${input.createdAt}
        )
        on conflict (project_id, path) do update
        set
          parent_path = excluded.parent_path,
          name = excluded.name,
          kind = excluded.kind,
          blob_id = excluded.blob_id,
          sha256 = excluded.sha256,
          line_count = excluded.line_count,
          size_bytes = excluded.size_bytes,
          updated_at = excluded.updated_at
      `
    }),
)

export const replaceProjectEntriesWithSql = Effect.fn(
  'WritingPersistence.replaceProjectEntriesWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly projectId: string
      readonly entries: readonly WritingSnapshotEntryManifest[]
      readonly createdAt: number
    },
  ) =>
    Effect.gen(function* () {
      yield* sql`
        delete from writing_entries
        where project_id = ${input.projectId}
      `

      for (const entry of [...input.entries].sort((left, right) =>
        left.path.localeCompare(right.path),
      )) {
        if (entry.path === WRITING_ROOT_PATH) {
          continue
        }

        yield* sql`
          insert into writing_entries (
            id,
            project_id,
            path,
            parent_path,
            name,
            kind,
            blob_id,
            sha256,
            line_count,
            size_bytes,
            created_at,
            updated_at
          ) values (
            ${crypto.randomUUID()},
            ${input.projectId},
            ${entry.path},
            ${getWritingParentPath(entry.path) ?? WRITING_ROOT_PATH},
            ${getWritingBaseName(entry.path)},
            ${entry.kind},
            ${entry.blobId ?? null},
            ${entry.sha256 ?? null},
            ${entry.lineCount ?? null},
            ${entry.sizeBytes ?? null},
            ${input.createdAt},
            ${input.createdAt}
          )
        `
      }
    }),
)

export const captureCurrentSnapshotManifestWithSql = Effect.fn(
  'WritingPersistence.captureCurrentSnapshotManifestWithSql',
)((sql: PgClient.PgClient, projectId: string) =>
  Effect.gen(function* () {
    const entries = yield* listProjectEntriesWithSql(sql, projectId)
    return entries.map((entry) => ({
      path: entry.path,
      kind: entry.kind,
      blobId: entry.blobId ?? undefined,
      sha256: entry.sha256 ?? undefined,
      lineCount: entry.lineCount ?? undefined,
      sizeBytes: entry.sizeBytes ?? undefined,
    }))
  }),
)

export const loadSnapshotManifestWithSql = Effect.fn(
  'WritingPersistence.loadSnapshotManifestWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly snapshotId: string
    },
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<WritingSnapshotEntrySqlRow>`
        select path, kind, blob_id, sha256, line_count
        from writing_snapshot_entries
        where snapshot_id = ${input.snapshotId}
        order by path asc
      `

      return rows.map((row) => ({
        path: row.path,
        kind: row.kind,
        blobId: row.blob_id ?? undefined,
        sha256: row.sha256 ?? undefined,
        lineCount: row.line_count ?? undefined,
      }))
    }),
)

export const insertSnapshotWithSql = Effect.fn(
  'WritingPersistence.insertSnapshotWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly projectId: string
      readonly parentSnapshotId?: string
      readonly source: WritingSnapshotSource
      readonly summary: string
      readonly conversationId?: string
      readonly messageId?: string
      readonly createdByUserId: string
      readonly restoredFromSnapshotId?: string
      readonly entries: readonly WritingSnapshotEntryManifest[]
      readonly createdAt: number
    },
  ) =>
    Effect.gen(function* () {
      const snapshotId = crypto.randomUUID()

      yield* sql`
        insert into writing_snapshots (
          id,
          project_id,
          parent_snapshot_id,
          source,
          summary,
          conversation_id,
          message_id,
          created_by_user_id,
          restored_from_snapshot_id,
          created_at
        ) values (
          ${snapshotId},
          ${input.projectId},
          ${input.parentSnapshotId ?? null},
          ${input.source},
          ${input.summary},
          ${input.conversationId ?? null},
          ${input.messageId ?? null},
          ${input.createdByUserId},
          ${input.restoredFromSnapshotId ?? null},
          ${input.createdAt}
        )
      `

      for (const entry of input.entries) {
        if (entry.path === WRITING_ROOT_PATH) {
          continue
        }

        yield* sql`
          insert into writing_snapshot_entries (
            id,
            snapshot_id,
            path,
            kind,
            blob_id,
            sha256,
            line_count
          ) values (
            ${crypto.randomUUID()},
            ${snapshotId},
            ${entry.path},
            ${entry.kind},
            ${entry.blobId ?? null},
            ${entry.sha256 ?? null},
            ${entry.lineCount ?? null}
          )
        `
      }

      return snapshotId
    }),
)

export const getWritingChangeSetWithSql = Effect.fn(
  'WritingPersistence.getWritingChangeSetWithSql',
)(
  (
    sql: PgClient.PgClient,
    changeSetId: string,
    options?: { readonly forUpdate?: boolean },
  ) =>
    Effect.gen(function* () {
      const rows = options?.forUpdate
        ? yield* sql<WritingChangeSetSqlRow>`
            select *
            from writing_change_sets
            where id = ${changeSetId}
            limit 1
            for update
          `
        : yield* sql<WritingChangeSetSqlRow>`
            select *
            from writing_change_sets
            where id = ${changeSetId}
            limit 1
          `

      const row = rows[0]
      return row ? mapWritingChangeSetSqlRow(row) : null
    }),
)

export const listWritingChangesByChangeSetWithSql = Effect.fn(
  'WritingPersistence.listWritingChangesByChangeSetWithSql',
)((sql: PgClient.PgClient, changeSetId: string) =>
  Effect.gen(function* () {
    const rows = yield* sql<WritingChangeSqlRow>`
      select *
      from writing_changes
      where change_set_id = ${changeSetId}
      order by path asc
    `

    return rows.map(mapWritingChangeSqlRow)
  }),
)

export const getWritingChangeByPathWithSql = Effect.fn(
  'WritingPersistence.getWritingChangeByPathWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly changeSetId: string
      readonly path: string
    },
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<WritingChangeSqlRow>`
        select *
        from writing_changes
        where change_set_id = ${input.changeSetId}
          and path = ${input.path}
        limit 1
      `

      const row = rows[0]
      return row ? mapWritingChangeSqlRow(row) : null
    }),
)

export const listWritingChangeHunksByChangeIdWithSql = Effect.fn(
  'WritingPersistence.listWritingChangeHunksByChangeIdWithSql',
)((sql: PgClient.PgClient, changeId: string) =>
  Effect.gen(function* () {
    const rows = yield* sql<WritingChangeHunkSqlRow>`
      select *
      from writing_change_hunks
      where change_id = ${changeId}
      order by hunk_index asc
    `

    return rows.map(mapWritingChangeHunkSqlRow)
  }),
)

export const replaceChangeHunksWithSql = Effect.fn(
  'WritingPersistence.replaceChangeHunksWithSql',
)(
  (
    sql: PgClient.PgClient,
    input: {
      readonly changeId: string
      readonly hunks: readonly ReturnType<typeof createWritingHunks>[number][]
      readonly createdAt: number
    },
  ) =>
    Effect.gen(function* () {
      yield* sql`
        delete from writing_change_hunks
        where change_id = ${input.changeId}
      `

      for (const hunk of input.hunks) {
        yield* sql`
          insert into writing_change_hunks (
            id,
            change_id,
            hunk_index,
            status,
            old_start,
            old_lines,
            new_start,
            new_lines,
            patch_text,
            created_at
          ) values (
            ${crypto.randomUUID()},
            ${input.changeId},
            ${hunk.index},
            'pending',
            ${hunk.oldStart},
            ${hunk.oldLines},
            ${hunk.newStart},
            ${hunk.newLines},
            ${hunk.patchText},
            ${input.createdAt}
          )
        `
      }
    }),
)

export const updateChangeSetResolutionWithSql = Effect.fn(
  'WritingPersistence.updateChangeSetResolutionWithSql',
)((sql: PgClient.PgClient, changeSetId: string) =>
  Effect.gen(function* () {
    const changes = yield* listWritingChangesByChangeSetWithSql(sql, changeSetId)
    const statuses = new Set(changes.map((change) => change.status))
    let nextStatus: WritingChangeSetRow['status'] = 'pending'
    let resolvedAt: number | null = null

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
      resolvedAt = null
    } else if (statuses.has('pending')) {
      nextStatus = 'pending'
      resolvedAt = null
    }

    yield* sql`
      update writing_change_sets
      set
        status = ${nextStatus},
        resolved_at = ${resolvedAt}
      where id = ${changeSetId}
    `
  }),
)

export const getScopedProjectSql = Effect.fn('WritingPersistence.getScopedProjectSql')(
  (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      return yield* getScopedProjectWithSql(sql, input)
    }),
)

export const getProjectConversationSql = Effect.fn(
  'WritingPersistence.getProjectConversationSql',
)(
  (input: {
    readonly conversationId: string
    readonly projectId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      return yield* getProjectConversationWithSql(sql, input)
    }),
)

export const listProjectEntriesSql = Effect.fn(
  'WritingPersistence.listProjectEntriesSql',
)((projectId: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    return yield* listProjectEntriesWithSql(sql, projectId)
  }),
)

export const getBlobByIdSql = Effect.fn('WritingPersistence.getBlobByIdSql')(
  (blobId?: string | null) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      return yield* getBlobByIdWithSql(sql, blobId)
    }),
)

export const getWritingChangeSetSql = Effect.fn(
  'WritingPersistence.getWritingChangeSetSql',
)((changeSetId: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    return yield* getWritingChangeSetWithSql(sql, changeSetId)
  }),
)

export const listWritingChangesByChangeSetSql = Effect.fn(
  'WritingPersistence.listWritingChangesByChangeSetSql',
)((changeSetId: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    return yield* listWritingChangesByChangeSetWithSql(sql, changeSetId)
  }),
)

export const countWritingChangesByChangeSetSql = Effect.fn(
  'WritingPersistence.countWritingChangesByChangeSetSql',
)((changeSetId: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    const rows = yield* sql<{ readonly count: number }>`
      select count(*)::int as count
      from writing_changes
      where change_set_id = ${changeSetId}
    `

    return rows[0]?.count ?? 0
  }),
)
