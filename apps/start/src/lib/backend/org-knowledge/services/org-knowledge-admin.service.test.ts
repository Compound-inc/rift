import { describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import { OrgKnowledgeRagService } from '@/lib/backend/chat/services/rag'
import { MarkdownConversionService } from '@/lib/backend/file/services/markdown-conversion.service'
import { ORG_KNOWLEDGE_KIND } from '@/lib/shared/org-knowledge'
import { OrgKnowledgeAdminService } from './org-knowledge-admin.service'
import { OrgKnowledgeRepositoryService } from './org-knowledge-repository.service'

describe('OrgKnowledgeAdminService', () => {
  it('deletes vectors before marking the attachment deleted', async () => {
    const calls: string[] = []

    const layer = OrgKnowledgeAdminService.layer.pipe(
      Layer.provideMerge(
        Layer.succeed(OrgKnowledgeRepositoryService, {
          getAttachmentForOrg: () =>
            Effect.sync(() => {
              calls.push('get-attachment')
              return {
                id: 'attachment-1',
                userId: 'user-1',
                orgKnowledgeKind: ORG_KNOWLEDGE_KIND,
                status: 'uploaded' as const,
              }
            }),
          markAttachmentDeleted: () =>
            Effect.sync(() => {
              calls.push('mark-deleted')
            }),
        } as never),
      ),
      Layer.provideMerge(
        Layer.succeed(OrgKnowledgeRagService, {
          deleteOrgKnowledgeChunks: () =>
            Effect.sync(() => {
              calls.push('delete-vectors')
            }),
        } as never),
      ),
      Layer.provideMerge(
        Layer.succeed(MarkdownConversionService, {
          convertFromUrl: () =>
            Effect.fail(new Error('not used in delete test')),
        } as never),
      ),
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* OrgKnowledgeAdminService
        yield* service.deleteKnowledgeFile({
          organizationId: 'org-1',
          attachmentId: 'attachment-1',
          requestId: 'req-delete',
        })
      }).pipe(Effect.provide(layer)),
    )

    expect(calls).toEqual([
      'get-attachment',
      'delete-vectors',
      'mark-deleted',
    ])
  })
})
