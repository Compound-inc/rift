import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import type {
  AttachmentPersistenceRow,
  OrgKnowledgeAttachmentRecord,
  ProjectSourceAttachmentRecord,
} from '@/lib/backend/chat/infra/attachment-records'
import {
  getProjectSourceAttachmentRecordEffect,
  getOrgKnowledgeAttachmentRecordEffect,
  insertAttachmentRecordEffect,
} from '@/lib/backend/chat/infra/attachment-records'

export type AttachmentRecordServiceShape = {
  readonly insertAttachmentRecord: (
    input: AttachmentPersistenceRow,
  ) => Effect.Effect<void, unknown>
  readonly getOrgKnowledgeAttachmentRecord: (input: {
    readonly organizationId: string
    readonly attachmentId: string
  }) => Effect.Effect<OrgKnowledgeAttachmentRecord | null, unknown>
  readonly getProjectSourceAttachmentRecord: (input: {
    readonly projectId: string
    readonly attachmentId: string
  }) => Effect.Effect<ProjectSourceAttachmentRecord | null, unknown>
}

/**
 * Centralizes server-only attachment record access for columns intentionally
 * omitted from the shared Zero schema, such as extracted markdown content.
 */
export class AttachmentRecordService extends ServiceMap.Service<
  AttachmentRecordService,
  AttachmentRecordServiceShape
>()('chat-backend/AttachmentRecordService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient
      const provideUpstream = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
      ): Effect.Effect<TValue, TError> =>
        Effect.provideService(effect, PgClient.PgClient, client)

      return {
        insertAttachmentRecord: Effect.fn(
          'AttachmentRecordService.insertAttachmentRecord',
        )((input: AttachmentPersistenceRow) =>
          provideUpstream(insertAttachmentRecordEffect(input)),
        ),
        getOrgKnowledgeAttachmentRecord: Effect.fn(
          'AttachmentRecordService.getOrgKnowledgeAttachmentRecord',
        )(({ organizationId, attachmentId }: {
          readonly organizationId: string
          readonly attachmentId: string
        }) =>
          provideUpstream(
            getOrgKnowledgeAttachmentRecordEffect(organizationId, attachmentId),
          )),
        getProjectSourceAttachmentRecord: Effect.fn(
          'AttachmentRecordService.getProjectSourceAttachmentRecord',
        )(({ projectId, attachmentId }: {
          readonly projectId: string
          readonly attachmentId: string
        }) =>
          provideUpstream(
            getProjectSourceAttachmentRecordEffect(projectId, attachmentId),
          )),
      }
    }),
  )
}
