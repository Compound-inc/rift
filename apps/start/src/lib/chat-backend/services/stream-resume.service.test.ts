import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { StreamResumeService } from './stream-resume.service'

describe('StreamResumeService', () => {
  it('fails fast when REDIS_URL is missing for the live layer', async () => {
    const previousRedisUrl = process.env.REDIS_URL
    delete process.env.REDIS_URL

    try {
      const error = await Effect.runPromise(
        Effect.gen(function* () {
          const streamResume = yield* StreamResumeService
          return yield* streamResume.getActiveStreamId({
            userId: 'u1',
            threadId: 't1',
            requestId: 'req-live',
          })
        }).pipe(Effect.provide(StreamResumeService.layer), Effect.flip),
      )

      expect(String(error)).toContain('REDIS_URL is not configured')
    } finally {
      if (typeof previousRedisUrl === 'string') {
        process.env.REDIS_URL = previousRedisUrl
      } else {
        delete process.env.REDIS_URL
      }
    }
  })

  it('clears memory active streams idempotently', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const streamResume = yield* StreamResumeService
        yield* streamResume.registerActiveStream({
          userId: 'user-idempotent',
          threadId: 'thread-idempotent',
          requestId: 'req-register',
          streamId: 'stream-idempotent',
          abortController: new AbortController(),
        })

        const active = yield* streamResume.getActiveStreamId({
          userId: 'user-idempotent',
          threadId: 'thread-idempotent',
          requestId: 'req-read',
        })
        expect(active).toBe('stream-idempotent')

        yield* streamResume.clearActiveStream({
          userId: 'user-idempotent',
          threadId: 'thread-idempotent',
          requestId: 'req-clear-1',
          expectedStreamId: 'stream-idempotent',
        })
        // second clear should be a no-op
        yield* streamResume.clearActiveStream({
          userId: 'user-idempotent',
          threadId: 'thread-idempotent',
          requestId: 'req-clear-2',
          expectedStreamId: 'stream-idempotent',
        })

        const after = yield* streamResume.getActiveStreamId({
          userId: 'user-idempotent',
          threadId: 'thread-idempotent',
          requestId: 'req-read-after',
        })
        expect(after).toBeNull()
      }).pipe(Effect.provide(StreamResumeService.layerMemory)),
    )
  })
})
