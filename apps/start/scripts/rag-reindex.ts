/**
 * Re-index existing documents with the current RAG pipeline (ADR-0006).
 *
 * Why this exists:
 * - Documents uploaded before the RAG rework were chunked differently: files
 *   under 12 KB became one oversized chunk, and anything past 140 chunks
 *   (~page 80 of a long PDF) was never indexed.
 * - Org knowledge and project files have a "Retry index" action in the UI,
 *   but chat attachments do not, so this script is the only way to upgrade
 *   them.
 *
 * What it does, per uploaded attachment (all scopes):
 * 1. Runs `RagIndexerService.indexDocument` with `replaceExisting`, which
 *    deletes the document's old points and writes the new chunks with
 *    contextual headers.
 * 2. Writes the resulting embedding metrics and index state back to the row.
 *
 * Reads `ZERO_UPSTREAM_DB`, `QDRANT_*` and `AI_GATEWAY_API_KEY` from the
 * environment / `.env` files like the app does. Safe to re-run: point ids are
 * deterministic and old points are replaced.
 *
 * Usage (from apps/start):
 *   bun run rag:reindex --dry-run            # list what would be re-indexed
 *   bun run rag:reindex                      # re-index everything
 *   bun run rag:reindex --scope=attachment   # attachment | project_source | org_knowledge
 *   bun run rag:reindex --limit=50
 */

import { Effect } from 'effect'
import { Pool } from 'pg'
import { RagIndexerService } from '../src/lib/backend/rag'
import type { RagOwnership, RagScope } from '../src/lib/backend/rag'

type AttachmentRow = {
  readonly id: string
  readonly user_id: string
  readonly owner_org_id: string | null
  readonly project_id: string | null
  readonly workspace_id: string | null
  readonly org_knowledge_kind: string | null
  readonly access_scope: RagOwnership['accessScope'] | null
  readonly file_name: string
  readonly file_content: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  const value = (name: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
  const scope = value('scope') as RagScope | undefined
  if (scope && !['attachment', 'project_source', 'org_knowledge'].includes(scope)) {
    throw new Error(`Unknown --scope=${scope}`)
  }
  const limit = value('limit')
  return {
    dryRun: args.includes('--dry-run'),
    scope,
    limit: limit ? Number.parseInt(limit, 10) : undefined,
  }
}

/** Same scope mapping the upload paths use when they first index a file. */
function scopeOf(row: AttachmentRow): RagScope {
  if (row.org_knowledge_kind) return 'org_knowledge'
  if (row.project_id) return 'project_source'
  return 'attachment'
}

function ownershipOf(row: AttachmentRow, scope: RagScope): RagOwnership {
  return {
    userId: row.user_id,
    ownerOrgId: row.owner_org_id ?? undefined,
    projectId: row.project_id ?? undefined,
    workspaceId: row.workspace_id ?? undefined,
    accessScope:
      scope === 'org_knowledge'
        ? 'org'
        : scope === 'project_source'
          ? 'project'
          : (row.access_scope ?? 'user'),
  }
}

async function main() {
  const options = parseArgs()
  const connectionString = process.env.ZERO_UPSTREAM_DB
  if (!connectionString) throw new Error('ZERO_UPSTREAM_DB is not set')
  const pool = new Pool({ connectionString, max: 2 })

  try {
    const { rows } = await pool.query<AttachmentRow>(
      `select id, user_id, owner_org_id, project_id, workspace_id,
              org_knowledge_kind, access_scope, file_name, file_content
         from attachments
        where coalesce(status, 'uploaded') = 'uploaded'
          and length(file_content) > 0
        order by created_at asc`,
    )
    const targets = rows
      .filter((row) => !options.scope || scopeOf(row) === options.scope)
      .slice(0, options.limit)

    console.log(
      `${targets.length} document(s) to re-index${options.dryRun ? ' (dry run)' : ''}`,
    )
    if (options.dryRun) {
      for (const row of targets) {
        console.log(`  ${scopeOf(row).padEnd(14)} ${row.id}  ${row.file_name}`)
      }
      return
    }

    let failed = 0
    for (const [index, row] of targets.entries()) {
      const scope = scopeOf(row)
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const indexer = yield* RagIndexerService
          return yield* indexer.indexDocument({
            scope,
            attachmentId: row.id,
            fileName: row.file_name,
            markdown: row.file_content,
            ownership: ownershipOf(row, scope),
            replaceExisting: true,
          })
        }).pipe(Effect.provide(RagIndexerService.layer)),
      )

      await pool.query(
        `update attachments
            set embedding_model = $2,
                embedding_tokens = $3,
                embedding_dimensions = $4,
                embedding_chunks = $5,
                embedding_status = $6,
                vector_indexed_at = $7,
                vector_error = $8,
                content_chars = char_length(file_content),
                updated_at = $9
          where id = $1`,
        [
          row.id,
          result.embeddingModel,
          result.embeddingTokens,
          result.embeddingDimensions,
          result.embeddingChunks,
          result.embeddingStatus,
          result.vectorIndexedAt ?? null,
          result.vectorError?.slice(0, 500) ?? null,
          Date.now(),
        ],
      )
      if (result.embeddingStatus === 'failed') failed += 1
      console.log(
        `[${index + 1}/${targets.length}] ${result.embeddingStatus.padEnd(8)} ${scope.padEnd(14)} ${row.file_name} (${result.embeddingChunks} chunks)${result.vectorError ? ` — ${result.vectorError}` : ''}`,
      )
    }
    console.log(`Done. ${targets.length - failed} indexed, ${failed} failed.`)
    if (failed > 0) process.exitCode = 1
  } finally {
    await pool.end()
  }
}

await main()
