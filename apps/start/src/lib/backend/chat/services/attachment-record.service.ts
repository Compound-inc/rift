import { Effect, Layer, ServiceMap } from 'effect'
import type {
  AttachmentContentRow,
  AttachmentPersistenceRow,
  OrgKnowledgeAttachmentRecord,
} from '@/lib/backend/chat/infra/attachment-records'
import {
  getOrgKnowledgeAttachmentRecord as loadOrgKnowledgeAttachmentRecord,
  insertAttachmentRecord as persistAttachmentRecord,
  listAttachmentContentRowsByThread as loadAttachmentContentRowsByThread,
} from '@/lib/backend/chat/infra/attachment-records'

export type AttachmentRecordServiceShape = {
  readonly insertAttachmentRecord: (
    input: AttachmentPersistenceRow,
  ) => Effect.Effect<void, unknown>
  readonly listAttachmentContentRowsByThread: (
    threadId: string,
  ) => Effect.Effect<readonly AttachmentContentRow[], unknown>
  readonly getOrgKnowledgeAttachmentRecord: (input: {
    readonly organizationId: string
    readonly attachmentId: string
  }) => Effect.Effect<OrgKnowledgeAttachmentRecord | null, unknown>
}

/**
 * Centralizes server-only attachment record access for columns intentionally
 * omitted from the shared Zero schema, such as extracted markdown content.
 */
export class AttachmentRecordService extends ServiceMap.Service<
  AttachmentRecordService,
  AttachmentRecordServiceShape
>()('chat-backend/AttachmentRecordService') {
  static readonly layer = Layer.succeed(this, {
    insertAttachmentRecord: Effect.fn(
      'AttachmentRecordService.insertAttachmentRecord',
    )((input: AttachmentPersistenceRow) =>
      Effect.tryPromise({
        try: () => persistAttachmentRecord(input),
        catch: (error) => error,
      }),
    ),
    listAttachmentContentRowsByThread: Effect.fn(
      'AttachmentRecordService.listAttachmentContentRowsByThread',
    )((threadId: string) =>
      Effect.tryPromise({
        try: () => loadAttachmentContentRowsByThread(threadId),
        catch: (error) => error,
      }),
    ),
    getOrgKnowledgeAttachmentRecord: Effect.fn(
      'AttachmentRecordService.getOrgKnowledgeAttachmentRecord',
    )(({ organizationId, attachmentId }: {
      readonly organizationId: string
      readonly attachmentId: string
    }) =>
      Effect.tryPromise({
        try: () => loadOrgKnowledgeAttachmentRecord(organizationId, attachmentId),
        catch: (error) => error,
      }),
    ),
  })
}
