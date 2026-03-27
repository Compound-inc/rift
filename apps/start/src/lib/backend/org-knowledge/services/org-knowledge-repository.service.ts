import { Effect, Layer, ServiceMap } from 'effect'
import { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import {
  ZeroDatabaseNotConfiguredError,
  ZeroDatabaseService,
} from '@/lib/backend/server-effect/services/zero-database.service'
import { EMPTY_ORG_PROVIDER_KEY_STATUS } from '@/lib/shared/model-policy/types'
import {
  ORG_KNOWLEDGE_KIND,
  summarizeOrgKnowledgeIndexError,
} from '@/lib/shared/org-knowledge'
import { OrgKnowledgePersistenceError } from '../domain/errors'

type OrgKnowledgeRow = {
  readonly id: string
  readonly userId: string
  readonly ownerOrgId?: string
  readonly attachmentUrl: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly fileContent: string
  readonly orgKnowledgeKind?: string
  readonly orgKnowledgeActive?: boolean
  readonly embeddingModel?: string
  readonly embeddingTokens?: number
  readonly embeddingDimensions?: number
  readonly embeddingChunks?: number
  readonly vectorIndexedAt?: number
  readonly vectorError?: string
  readonly status?: 'deleted' | 'uploaded'
}

type PersistedAttachmentInput = {
  readonly id: string
  readonly userId: string
  readonly ownerOrgId: string
  readonly fileKey: string
  readonly attachmentUrl: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly fileContent: string
  readonly embeddingModel: string
  readonly embeddingTokens: number
  readonly embeddingDimensions: number
  readonly embeddingChunks: number
  readonly embeddingStatus: 'indexed' | 'disabled' | 'failed'
  readonly createdAt: number
  readonly updatedAt: number
}

export type OrgKnowledgeRepositoryServiceShape = {
  readonly listActiveAttachmentIds: (input: {
    readonly organizationId: string
    readonly requestId: string
  }) => Effect.Effect<readonly string[], OrgKnowledgePersistenceError>
  readonly insertKnowledgeAttachment: (input: {
    readonly attachment: PersistedAttachmentInput
    readonly requestId: string
  }) => Effect.Effect<void, OrgKnowledgePersistenceError>
  readonly setAttachmentActive: (input: {
    readonly organizationId: string
    readonly attachmentId: string
    readonly active: boolean
    readonly requestId: string
  }) => Effect.Effect<void, OrgKnowledgePersistenceError>
  readonly markAttachmentDeleted: (input: {
    readonly organizationId: string
    readonly attachmentId: string
    readonly requestId: string
  }) => Effect.Effect<void, OrgKnowledgePersistenceError>
  readonly updateAttachmentIndexState: (input: {
    readonly organizationId: string
    readonly attachmentId: string
    readonly embeddingStatus: 'indexed' | 'disabled' | 'failed'
    readonly vectorIndexedAt?: number
    readonly vectorError?: string
    readonly requestId: string
  }) => Effect.Effect<void, OrgKnowledgePersistenceError>
  readonly getAttachmentForOrg: (input: {
    readonly organizationId: string
    readonly attachmentId: string
    readonly requestId: string
  }) => Effect.Effect<OrgKnowledgeRow | null, OrgKnowledgePersistenceError>
  readonly syncPolicyState: (input: {
    readonly organizationId: string
    readonly requestId: string
  }) => Effect.Effect<void, OrgKnowledgePersistenceError>
}

/**
 * Repository service for org knowledge rows stored on the shared `attachments`
 * table.
 */
export class OrgKnowledgeRepositoryService extends ServiceMap.Service<
  OrgKnowledgeRepositoryService,
  OrgKnowledgeRepositoryServiceShape
>()('org-knowledge/OrgKnowledgeRepositoryService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const attachmentRecord = yield* AttachmentRecordService
      const zeroDatabase = yield* ZeroDatabaseService

      /**
       * Repository methods expose only domain errors. This helper collapses the
       * shared Zero infra error into the org-knowledge persistence boundary so
       * callers do not need to know about runtime database configuration tags.
       */
      const withOrgKnowledgeDb = <TValue>(
        input: {
          readonly organizationId: string
          readonly requestId: string
          readonly message: string
          readonly attachmentId?: string
        },
        run: Parameters<typeof zeroDatabase.withDatabase<TValue, OrgKnowledgePersistenceError, never>>[0],
      ) =>
        zeroDatabase.withDatabase(run).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? new OrgKnowledgePersistenceError({
                  message: input.message,
                  requestId: input.requestId,
                  organizationId: input.organizationId,
                  attachmentId: input.attachmentId,
                  cause: error.message,
                })
              : error,
          ),
        )

      const listActiveAttachmentIds: OrgKnowledgeRepositoryServiceShape['listActiveAttachmentIds'] =
        Effect.fn('OrgKnowledgeRepositoryService.listActiveAttachmentIds')(
          ({ organizationId, requestId }) =>
            withOrgKnowledgeDb({
              message: 'Failed to load active organization knowledge attachments',
              requestId,
              organizationId,
            }, (db) =>
              Effect.tryPromise({
                try: async () => {
                  const rows = await db.run(
                    zql.attachment
                      .where('ownerOrgId', organizationId)
                      .where('orgKnowledgeKind', ORG_KNOWLEDGE_KIND)
                      .where('orgKnowledgeActive', true)
                      .where('embeddingStatus', 'indexed')
                      .where('status', 'uploaded')
                      .orderBy('updatedAt', 'desc'),
                  )
                  return rows.map((row) => row.id)
                },
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to load active organization knowledge attachments',
                    requestId,
                    organizationId,
                    cause: String(error),
                  }),
              }),
            ),
        )

      const insertKnowledgeAttachment: OrgKnowledgeRepositoryServiceShape['insertKnowledgeAttachment'] =
        Effect.fn('OrgKnowledgeRepositoryService.insertKnowledgeAttachment')(
          ({ attachment, requestId }) =>
            attachmentRecord.insertAttachmentRecord({
              id: attachment.id,
              userId: attachment.userId,
              ownerOrgId: attachment.ownerOrgId,
              fileKey: attachment.fileKey,
              attachmentUrl: attachment.attachmentUrl,
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              fileSize: attachment.fileSize,
              fileContent: attachment.fileContent,
              embeddingModel: attachment.embeddingModel,
              embeddingTokens: attachment.embeddingTokens,
              embeddingDimensions: attachment.embeddingDimensions,
              embeddingChunks: attachment.embeddingChunks,
              embeddingStatus: attachment.embeddingStatus,
              accessScope: 'org',
              orgKnowledgeKind: ORG_KNOWLEDGE_KIND,
              orgKnowledgeActive: false,
              accessGroupIds: [],
              status: 'uploaded',
              createdAt: attachment.createdAt,
              updatedAt: attachment.updatedAt,
            }).pipe(
              Effect.mapError(
                (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to persist organization knowledge attachment',
                    requestId,
                    organizationId: attachment.ownerOrgId,
                    attachmentId: attachment.id,
                    cause: String(error),
                  }),
              ),
            ),
        )

      const getAttachmentForOrg: OrgKnowledgeRepositoryServiceShape['getAttachmentForOrg'] =
        Effect.fn('OrgKnowledgeRepositoryService.getAttachmentForOrg')(
          ({ organizationId, attachmentId, requestId }) =>
            attachmentRecord.getOrgKnowledgeAttachmentRecord({
              organizationId,
              attachmentId,
            }).pipe(
              Effect.mapError(
                (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to load organization knowledge attachment',
                    requestId,
                    organizationId,
                    attachmentId,
                    cause: String(error),
                  }),
              ),
            ),
        )

      const syncPolicyState: OrgKnowledgeRepositoryServiceShape['syncPolicyState'] =
        Effect.fn('OrgKnowledgeRepositoryService.syncPolicyState')(
          ({ organizationId, requestId }) =>
            withOrgKnowledgeDb({
              message: 'Failed to sync organization knowledge policy state',
              requestId,
              organizationId,
            }, (db) =>
              Effect.tryPromise({
                try: async () => {
                  const activeRows = await db.run(
                    zql.attachment
                      .where('ownerOrgId', organizationId)
                      .where('orgKnowledgeKind', ORG_KNOWLEDGE_KIND)
                      .where('orgKnowledgeActive', true)
                      .where('embeddingStatus', 'indexed')
                      .where('status', 'uploaded'),
                  )
                  const activeCount = activeRows.length
                  const existingPolicy = await db.run(
                    zql.orgAiPolicy.where('organizationId', organizationId).one(),
                  )
                  const updatedAt = Date.now()

                  await db.transaction(async (tx) => {
                    if (existingPolicy) {
                      await tx.mutate.orgAiPolicy.update({
                        id: existingPolicy.id,
                        orgKnowledgeEnabled: activeCount > 0,
                        updatedAt,
                      })
                      return
                    }

                    await tx.mutate.orgAiPolicy.insert({
                      id: crypto.randomUUID(),
                      organizationId,
                      disabledProviderIds: [],
                      disabledModelIds: [],
                      complianceFlags: {},
                      providerNativeToolsEnabled: true,
                      externalToolsEnabled: true,
                      disabledToolKeys: [],
                      orgKnowledgeEnabled: activeCount > 0,
                      providerKeyStatus: EMPTY_ORG_PROVIDER_KEY_STATUS,
                      enforcedModeId: null,
                      updatedAt,
                    })
                  })
                },
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to sync organization knowledge policy state',
                    requestId,
                    organizationId,
                    cause: String(error),
                  }),
              }),
            ),
        )

      const setAttachmentActive: OrgKnowledgeRepositoryServiceShape['setAttachmentActive'] =
        Effect.fn('OrgKnowledgeRepositoryService.setAttachmentActive')(
          ({ organizationId, attachmentId, active, requestId }) =>
            withOrgKnowledgeDb({
              message: 'Failed to update organization knowledge attachment state',
              requestId,
              organizationId,
              attachmentId,
            }, (db) =>
              Effect.tryPromise({
                try: async () => {
                  const existing = await db.run(
                    zql.attachment
                      .where('id', attachmentId)
                      .where('ownerOrgId', organizationId)
                      .where('orgKnowledgeKind', ORG_KNOWLEDGE_KIND)
                      .one(),
                  )
                  if (!existing || existing.status !== 'uploaded') {
                    throw new Error('Attachment is not available for this organization')
                  }

                  await db.transaction(async (tx) => {
                    await tx.mutate.attachment.update({
                      id: attachmentId,
                      orgKnowledgeActive: active,
                      updatedAt: Date.now(),
                    })
                  })
                },
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to update organization knowledge attachment state',
                    requestId,
                    organizationId,
                    attachmentId,
                    cause: String(error),
                  }),
              }),
            ).pipe(
              Effect.flatMap(() =>
                syncPolicyState({
                  organizationId,
                  requestId,
                }).pipe(Effect.asVoid),
              ),
            ),
        )

      const markAttachmentDeleted: OrgKnowledgeRepositoryServiceShape['markAttachmentDeleted'] =
        Effect.fn('OrgKnowledgeRepositoryService.markAttachmentDeleted')(
          ({ organizationId, attachmentId, requestId }) =>
            withOrgKnowledgeDb({
              message: 'Failed to delete organization knowledge attachment',
              requestId,
              organizationId,
              attachmentId,
            }, (db) =>
              Effect.tryPromise({
                try: async () => {
                  const existing = await db.run(
                    zql.attachment
                      .where('id', attachmentId)
                      .where('ownerOrgId', organizationId)
                      .where('orgKnowledgeKind', ORG_KNOWLEDGE_KIND)
                      .one(),
                  )
                  if (!existing) {
                    throw new Error('Attachment is not available for this organization')
                  }

                  await db.transaction(async (tx) => {
                    await tx.mutate.attachment.update({
                      id: attachmentId,
                      status: 'deleted',
                      orgKnowledgeActive: false,
                      updatedAt: Date.now(),
                    })
                  })
                },
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to delete organization knowledge attachment',
                    requestId,
                    organizationId,
                    attachmentId,
                    cause: String(error),
                  }),
              }),
            ).pipe(
              Effect.flatMap(() =>
                syncPolicyState({
                  organizationId,
                  requestId,
                }).pipe(Effect.asVoid),
              ),
            ),
        )

      const updateAttachmentIndexState: OrgKnowledgeRepositoryServiceShape['updateAttachmentIndexState'] =
        Effect.fn('OrgKnowledgeRepositoryService.updateAttachmentIndexState')(
          ({
            organizationId,
            attachmentId,
            embeddingStatus,
            vectorIndexedAt,
            vectorError,
            requestId,
          }) =>
            withOrgKnowledgeDb({
              message: 'Failed to update organization knowledge index state',
              requestId,
              organizationId,
              attachmentId,
            }, (db) =>
              Effect.tryPromise({
                try: () =>
                  db.transaction(async (tx) => {
                    await tx.mutate.attachment.update({
                      id: attachmentId,
                      embeddingStatus,
                      vectorIndexedAt,
                      vectorError: summarizeOrgKnowledgeIndexError(vectorError),
                      updatedAt: Date.now(),
                    })
                  }),
                catch: (error) =>
                  new OrgKnowledgePersistenceError({
                    message: 'Failed to update organization knowledge index state',
                    requestId,
                    organizationId,
                    attachmentId,
                    cause: String(error),
                  }),
              }),
            ),
        )

      return {
        listActiveAttachmentIds,
        insertKnowledgeAttachment,
        setAttachmentActive,
        markAttachmentDeleted,
        updateAttachmentIndexState,
        getAttachmentForOrg,
        syncPolicyState,
      }
    }),
  )
}
