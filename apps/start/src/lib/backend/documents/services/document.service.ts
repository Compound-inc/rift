import { estimateTokensFromText } from '@/lib/shared/chat-contracts/token-estimate'
import { Effect, Layer, ServiceMap } from 'effect'
import {
  createDocumentSchema,
  documentModelView,
  documentModelBudgets,
  documentScopeSchema,
  ownsDocument,
  updateDocumentSchema,
} from '@/lib/shared/documents/contracts'
import type {
  DocumentRecord,
  DocumentScope,
  DocumentSummary,
  DocumentVersion,
} from '@/lib/shared/documents/contracts'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import {
  DocumentAccessError,
  DocumentPersistenceError,
  DocumentValidationError,
  DocumentVersionConflictError,
  DocumentRewriteLimitError,
} from '../domain/errors'
import type { DocumentError } from '../domain/errors'
import type { z } from 'zod'

type DocumentModelSummary = DocumentSummary & {
  rewritable: boolean
  maxRewriteTokens: number
}

type CreateInput = z.infer<typeof createDocumentSchema> & { documentId: string }
type UpdateInput = z.infer<typeof updateDocumentSchema>
export type DocumentServiceShape = {
  create: (
    scope: DocumentScope,
    input: CreateInput,
  ) => Effect.Effect<DocumentModelSummary, DocumentError>
  update: (
    scope: DocumentScope,
    input: UpdateInput,
  ) => Effect.Effect<DocumentModelSummary, DocumentError>
  read: (
    scope: DocumentScope,
    documentId: string,
  ) => Effect.Effect<
    DocumentModelSummary & {
      kind: 'markdown' | 'code'
      language?: string
      content: string
      truncated: boolean
      totalBytes: number
    },
    DocumentError
  >
}

/** Async transaction adapter, executed only from the Effect service. */
export type DocumentTransaction = {
  thread: (scope: DocumentScope) => Promise<{ projectId?: string } | undefined>
  get: (id: string) => Promise<DocumentRecord | undefined>
  version: (id: string, version: number) => Promise<DocumentVersion | undefined>
  insert: (document: DocumentRecord) => Promise<void>
  append: (document: DocumentRecord, version: DocumentVersion) => Promise<void>
}
export type DocumentRepository = {
  transaction: <TValue>(
    f: (tx: DocumentTransaction) => Promise<TValue>,
  ) => Promise<TValue>
}
const denied = () =>
  new DocumentAccessError({ message: 'Document or thread not found' })

/** Eligibility uses the serialized replacement and full read result, including
 * escaping and metadata. Reading a truncated view never authorizes a rewrite.
 */
function modelMetadata(
  document: DocumentRecord,
  version: DocumentVersion,
  scope: DocumentScope,
) {
  const budgets = documentModelBudgets(scope)
  const metadata = {
    documentId: document.id,
    title: document.title,
    version: version.version,
    kind: document.kind,
    language: document.language ?? undefined,
    maxRewriteTokens: budgets.rewriteTokens,
  }
  const replacementTokens = estimateTokensFromText(
    JSON.stringify({
      documentId: document.id,
      baseVersion: version.version,
      content: version.content,
    }),
  )
  const readTokens = estimateTokensFromText(
    JSON.stringify({
      ok: true,
      ...metadata,
      rewritable: false,
      content: version.content,
      truncated: false,
      totalBytes: new TextEncoder().encode(version.content).byteLength,
    }),
  )
  return {
    ...metadata,
    rewritable:
      replacementTokens <= budgets.rewriteTokens &&
      readTokens <= budgets.readTokens,
  }
}

/** All document tools spend the same result allowance. Generated tool inputs
 * fit in the step's output reservation; prepareStep counts their replay next time.
 */
function spendReadBudget<T>(scope: DocumentScope, result: T): T {
  if (scope.documentReadBudget) {
    scope.documentReadBudget.remainingTokens = Math.max(
      0,
      scope.documentReadBudget.remainingTokens -
        estimateTokensFromText(JSON.stringify({ ok: true, ...result })),
    )
  }
  return result
}

/** Advertise the follow-up request's capacity, then retain that promise for
 * this exact version. Updates do not need to fit another read of the same body.
 */
function rememberRewriteLimit<T extends DocumentModelSummary>(
  scope: DocumentScope,
  result: T,
  replacementTokens: number,
  replayedInputTokens = 0,
): T {
  const budget = scope.documentReadBudget
  const projected = budget?.projectRewriteTokens?.(
    // Create/update bodies replay with their summary. The envelope allowance
    // also covers small metadata differences after lowering the advertised limit.
    replayedInputTokens +
      estimateTokensFromText(JSON.stringify({ ok: true, ...result })) +
      256,
  )
  const maxRewriteTokens = Math.min(
    result.maxRewriteTokens,
    projected ?? result.maxRewriteTokens,
  )
  const next = {
    ...result,
    maxRewriteTokens,
    rewritable: result.rewritable && replacementTokens <= maxRewriteTokens,
  }
  if (next.rewritable) {
    budget?.rewriteLimits?.set(result.documentId, {
      version: result.version,
      maxRewriteTokens,
    })
  } else {
    budget?.rewriteLimits?.delete(result.documentId)
  }
  return next
}

function replacementTokens(
  documentId: string,
  version: number,
  content: string,
) {
  return estimateTokensFromText(
    JSON.stringify({ documentId, baseVersion: version, content }),
  )
}

function modelSummary(
  document: DocumentRecord,
  version: DocumentVersion,
  scope: DocumentScope,
) {
  const { documentId, title, maxRewriteTokens, rewritable } = modelMetadata(
    document,
    version,
    scope,
  )
  const inputTokens = replacementTokens(
    documentId,
    version.version,
    version.content,
  )
  return spendReadBudget(
    scope,
    rememberRewriteLimit(
      scope,
      {
        documentId,
        title,
        version: version.version,
        maxRewriteTokens,
        rewritable,
      },
      inputTokens,
      inputTokens,
    ),
  )
}
function modelRead(
  document: DocumentRecord,
  version: DocumentVersion,
  scope: DocumentScope,
) {
  const metadata = modelMetadata(document, version, scope)
  const remaining =
    scope.documentReadBudget?.remainingTokens ??
    documentModelBudgets(scope).readTokens
  // Keep a share for subsequent calls in the same step. Small allowances still
  // return a marked prefix whenever the metadata and marker fit.
  const readTokens =
    scope.documentReadBudget && remaining > 512
      ? Math.floor(remaining * 0.7)
      : remaining
  const view = documentModelView(
    version.content,
    { ...metadata, rewritable: false },
    readTokens,
  )
  const result = {
    ...metadata,
    ...view,
    rewritable: metadata.rewritable && !view.truncated,
  }
  if (
    estimateTokensFromText(JSON.stringify({ ok: true, ...result })) > readTokens
  )
    throw new DocumentValidationError({
      message:
        'Not enough context room to read this document. Start a new turn with less context.',
    })
  if (scope.documentReadBudget) {
    const truncatedVersions = (scope.documentReadBudget.truncatedVersions ??=
      new Map())
    if (result.truncated) truncatedVersions.set(document.id, version.version)
    else truncatedVersions.delete(document.id)
  }
  return spendReadBudget(
    scope,
    rememberRewriteLimit(
      scope,
      result,
      replacementTokens(document.id, version.version, version.content),
    ),
  )
}

/** Validation is repeated at this boundary so non-tool callers get the same byte limits. */
function implementation(repository: DocumentRepository): DocumentServiceShape {
  const run = <TValue>(
    scope: DocumentScope,
    body: (tx: DocumentTransaction) => Promise<TValue>,
  ) =>
    Effect.tryPromise({
      try: () =>
        repository.transaction(async (tx) => {
          if (
            !documentScopeSchema.safeParse(scope).success ||
            !(await tx.thread(scope))
          )
            throw denied()
          return body(tx)
        }),
      catch: (error) =>
        error instanceof DocumentAccessError ||
        error instanceof DocumentValidationError ||
        error instanceof DocumentPersistenceError ||
        error instanceof DocumentVersionConflictError ||
        error instanceof DocumentRewriteLimitError
          ? error
          : new DocumentPersistenceError({
              message: 'Could not persist document',
              cause: String(error),
            }),
    })
  return {
    create: Effect.fn('DocumentService.create')((scope, input) =>
      run(scope, async (tx) => {
        const { documentId: _documentId, ...fields } = input
        const parsed = createDocumentSchema.safeParse(fields)
        if (!parsed.success)
          throw new DocumentValidationError({ message: parsed.error.message })
        const existing = await tx.get(input.documentId)
        // The tool call ID makes replay after transport retries idempotent.
        if (existing) {
          if (!ownsDocument(existing, scope)) throw denied()
          const version = await tx.version(existing.id, existing.currentVersion)
          if (!version)
            throw new DocumentPersistenceError({
              message: 'Document version missing',
              cause: existing.id,
            })
          return modelSummary(existing, version, scope)
        }
        const thread = await tx.thread(scope)
        const now = Date.now()
        const { content, ...metadata } = parsed.data
        const document: DocumentRecord = {
          ...metadata,
          id: input.documentId,
          userId: scope.userId,
          organizationId: scope.organizationId,
          threadId: scope.threadId,
          projectId: thread?.projectId,
          currentVersion: 1,
          createdAt: now,
          updatedAt: now,
        }
        await tx.insert(document)
        const firstVersion: DocumentVersion = {
          documentId: document.id,
          version: 1,
          content,
          createdBy: 'assistant',
          sourceMessageId: scope.sourceMessageId,
          createdAt: now,
        }
        await tx.append(document, firstVersion)
        return modelSummary(document, firstVersion, scope)
      }),
    ),
    update: Effect.fn('DocumentService.update')((scope, input) =>
      run(scope, async (tx) => {
        const parsed = updateDocumentSchema.safeParse(input)
        if (!parsed.success)
          throw new DocumentValidationError({ message: parsed.error.message })
        const document = await tx.get(input.documentId)
        if (!ownsDocument(document, scope)) throw denied()
        if (parsed.data.baseVersion !== document.currentVersion)
          throw new DocumentVersionConflictError({
            message:
              'Document changed. Call read_document and retry with its version as baseVersion.',
            currentVersion: document.currentVersion,
          })
        const base = await tx.version(document.id, document.currentVersion)
        if (!base)
          throw new DocumentPersistenceError({
            message: 'Document version missing',
            cause: document.id,
          })
        // Checking the base does not emit another read or spend its allowance.
        const advertised = scope.documentReadBudget?.rewriteLimits?.get(document.id)
        const baseFits = advertised?.version === base.version
          ? replacementTokens(document.id, base.version, base.content) <=
            advertised.maxRewriteTokens
          : modelMetadata(document, base, scope).rewritable
        if (
          !baseFits ||
          scope.documentReadBudget?.truncatedVersions?.get(document.id) ===
            base.version
        )
          throw new DocumentRewriteLimitError({
            message:
              'This document exceeds the model rewrite budget. The user can edit it directly in the document panel.',
          })
        const version = document.currentVersion + 1
        const nextVersion: DocumentVersion = {
          documentId: document.id,
          version,
          content: parsed.data.content,
          createdBy: 'assistant',
          sourceMessageId: scope.sourceMessageId,
          createdAt: Date.now(),
        }
        await tx.append(
          { ...document, currentVersion: version, updatedAt: Date.now() },
          nextVersion,
        )
        return modelSummary(document, nextVersion, scope)
      }).pipe(
        // A concurrent user save may commit after our snapshot. The version PK
        // rolls our write back; reread in a fresh transaction to report the conflict.
        Effect.catchTag('DocumentPersistenceError', (error) =>
          run(scope, async (tx) => {
            const current = await tx.get(input.documentId)
            if (!ownsDocument(current, scope)) throw denied()
            if (current.currentVersion !== input.baseVersion)
              throw new DocumentVersionConflictError({
                message:
                  'Document changed. Call read_document and retry with its version as baseVersion.',
                currentVersion: current.currentVersion,
              })
            throw error
          }),
        ),
      ),
    ),
    read: Effect.fn('DocumentService.read')((scope, documentId) =>
      run(scope, async (tx) => {
        const document = await tx.get(documentId)
        if (!ownsDocument(document, scope)) throw denied()
        const version = await tx.version(document.id, document.currentVersion)
        if (!version)
          throw new DocumentPersistenceError({
            message: 'Document version missing',
            cause: document.id,
          })
        return modelRead(document, version, scope)
      }),
    ),
  }
}

export class DocumentService extends ServiceMap.Service<
  DocumentService,
  DocumentServiceShape
>()('documents/DocumentService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const database = yield* ZeroDatabaseService
      const db = yield* database.getOrFail
      return implementation({
        transaction: (body) =>
          db.transaction(async (tx) =>
            body({
              thread: async (scope) => {
                const thread = await tx.run(
                  zql.thread
                    .where('threadId', scope.threadId)
                    .where('userId', scope.userId)
                    .one(),
                )
                if (
                  !thread ||
                  (thread.ownerOrgId ?? undefined) !== scope.organizationId
                )
                  return undefined
                if (thread.projectId) {
                  const project = await tx.run(
                    zql.project.where('id', thread.projectId).one(),
                  )
                  if (!project || project.deletedAt != null) return undefined
                }
                return { projectId: thread.projectId ?? undefined }
              },
              get: (id) => tx.run(zql.document.where('id', id).one()),
              version: (id, version) =>
                tx.run(
                  zql.documentVersion
                    .where('documentId', id)
                    .where('version', version)
                    .one(),
                ),
              insert: async ({ ...document }) => {
                await tx.mutate.document.insert(document)
              },
              // The composite PK rejects concurrent writes to the same next version;
              // both the version and current pointer commit or roll back together.
              append: async (document, version) => {
                await tx.mutate.documentVersion.insert(version)
                await tx.mutate.document.update({
                  id: document.id,
                  currentVersion: document.currentVersion,
                  updatedAt: document.updatedAt,
                })
              },
            }),
          ),
      })
    }),
  )

  /** Deterministic repository injection for transaction and authorization tests. */
  static layerMemory(repository: DocumentRepository) {
    return Layer.succeed(this, implementation(repository))
  }
}
