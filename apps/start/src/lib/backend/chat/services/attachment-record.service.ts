import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import type {
  AttachmentContentRow,
  AttachmentPersistenceRow,
  OrgKnowledgeAttachmentRecord,
  ProjectSourceAttachmentRecord,
} from '@/lib/backend/chat/infra/attachment-records'
import {
  getProjectSourceAttachmentRecordEffect,
  getOrgKnowledgeAttachmentRecordEffect,
  insertAttachmentRecordEffect,
  listAttachmentContentRowsByIdsForUserEffect,
  listAttachmentContentRowsByIdsForProjectEffect,
  listAttachmentContentRowsByThreadEffect,
} from '@/lib/backend/chat/infra/attachment-records'

export type AttachmentRecordServiceShape = {
  readonly insertAttachmentRecord: (
    input: AttachmentPersistenceRow,
  ) => Effect.Effect<void, unknown>
  readonly listAttachmentContentRowsByThread: (
    threadId: string,
  ) => Effect.Effect<readonly AttachmentContentRow[], unknown>
  readonly listAttachmentContentRowsByIdsForUser: (input: {
    readonly userId: string
    readonly attachmentIds: readonly string[]
  }) => Effect.Effect<readonly AttachmentContentRow[], unknown>
  readonly listAttachmentContentRowsByIdsForProject: (input: {
    readonly projectId: string
    readonly attachmentIds: readonly string[]
  }) => Effect.Effect<readonly AttachmentContentRow[], unknown>
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
        listAttachmentContentRowsByThread: Effect.fn(
          'AttachmentRecordService.listAttachmentContentRowsByThread',
        )((threadId: string) =>
          provideUpstream(listAttachmentContentRowsByThreadEffect(threadId)),
        ),
        listAttachmentContentRowsByIdsForUser: Effect.fn(
          'AttachmentRecordService.listAttachmentContentRowsByIdsForUser',
        )((input: {
          readonly userId: string
          readonly attachmentIds: readonly string[]
        }) =>
            provideUpstream(listAttachmentContentRowsByIdsForUserEffect(input)),
        ),
        listAttachmentContentRowsByIdsForProject: Effect.fn(
          'AttachmentRecordService.listAttachmentContentRowsByIdsForProject',
        )((input: {
          readonly projectId: string
          readonly attachmentIds: readonly string[]
        }) =>
          provideUpstream(listAttachmentContentRowsByIdsForProjectEffect(input)),
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
