import { Effect, Layer } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import { MarkdownConversionService } from '@/lib/backend/file/services/markdown-conversion.service'
import { RagIndexerService } from '@/lib/backend/rag'
import { ProjectSourcesAdminService } from './project-sources-admin.service'

describe('project source management after owner removal', () => {
  it.each([
    'uploadProjectSource',
    'deleteProjectSource',
    'retryProjectSourceIndex',
  ] as const)(
    'rejects %s before uploading, reading files or indexing',
    async (operation) => {
      const run = vi
        .fn()
        .mockResolvedValueOnce({
          id: 'p',
          userId: 'owner',
          organizationId: 'org',
          visibility: 'org',
        })
        .mockResolvedValueOnce(undefined)
      const readFile = vi.fn(() => Effect.succeed(null))
      const db = { run }
      const layer = ProjectSourcesAdminService.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(ZeroDatabaseService, {
              getOrFail: Effect.succeed(db as never),
              withDatabase: (fn) => fn(db as never),
            }),
            Layer.succeed(AttachmentRecordService, {
              getProjectSourceAttachmentRecord: readFile,
            } as never),
            MarkdownConversionService.layer,
            RagIndexerService.layerNoop,
          ),
        ),
      )
      const effect = Effect.gen(function* () {
        const service = yield* ProjectSourcesAdminService
        return yield* service[operation]({
          projectId: 'p',
          attachmentId: 'f',
          userId: 'owner',
          requestId: 'test',
          file: new File(['text'], 'guide.txt'),
        })
      }).pipe(Effect.provide(layer))
      expect(await Effect.runPromise(Effect.flip(effect))).toMatchObject({
        _tag: 'ProjectSourcesPersistenceError',
        message: 'Project is not available',
      })
      expect(readFile).not.toHaveBeenCalled()
      expect(run).toHaveBeenCalledTimes(2)
    },
  )
})
