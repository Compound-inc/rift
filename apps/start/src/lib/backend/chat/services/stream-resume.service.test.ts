import { describe, expect, it, vi } from 'vitest'
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
  it('retains a targeted stop before registration and ignores a stale active generation', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const streams = yield* StreamResumeService
        const input = {
          userId: 'intent-owner',
          threadId: 'intent-thread',
          requestId: 'server-request',
        }
        const stale = new AbortController()
        yield* streams.registerActiveStream({
          ...input,
          requestId: 'old-server-request',
          generationRequestId: 'old-post',
          streamId: 'old-stream',
          abortController: stale,
        })
        yield* streams.recordStopIntent({
          ...input,
          targetRequestId: 'new-post',
        })
        expect(
          yield* streams.getActiveStreamId({
            ...input,
            targetRequestId: 'new-post',
          }),
        ).toBeNull()
        expect(stale.signal.aborted).toBe(false)
        const current = new AbortController()
        // Authentication may complete after DELETE, so the request ID must win
        // even when the orchestrator starts after the stop timestamp.
        yield* streams.registerActiveStream({
          ...input,
          startedAt: Date.now() + 100,
          generationRequestId: 'new-post',
          streamId: 'new-stream',
          abortController: current,
        })
        expect(current.signal.reason).toBe('user-stop')
        expect(
          yield* streams.hasStopIntent({
            ...input,
            targetRequestId: 'new-post',
            streamId: 'new-stream',
          }),
        ).toBe(true)
        expect(
          yield* streams.hasStopIntent({
            ...input,
            requestId: 'later-post',
            streamId: 'later-stream',
          }),
        ).toBe(false)
        yield* streams.clearActiveStream(input)
        yield* streams.releaseLocalStream({
          requestId: 'cleanup',
          streamId: 'old-stream',
        })
        yield* streams.releaseLocalStream({
          requestId: 'cleanup',
          streamId: 'new-stream',
        })
      }).pipe(Effect.provide(StreamResumeService.layerMemory)),
    )
  })
  it('limits thread-wide intents to the captured stream despite clock skew and late DELETEs', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const streams = yield* StreamResumeService
        const input = {
          userId: 'skew-owner',
          threadId: 'skew-thread',
          requestId: 'stop',
        }
        const first = new AbortController()
        yield* streams.registerActiveStream({
          ...input,
          streamId: 'first',
          generationRequestId: 'R1',
          startedAt: Date.now() + 86_400_000,
          abortController: first,
        })
        expect(yield* streams.recordStopIntent(input)).toBe('first')
        expect(
          yield* streams.hasStopIntent({ ...input, streamId: 'first' }),
        ).toBe(true)
        yield* streams.clearActiveStream({
          ...input,
          expectedStreamId: 'first',
        })
        expect(yield* streams.recordStopIntent(input)).toBeNull()
        const next = new AbortController()
        yield* streams.registerActiveStream({
          ...input,
          streamId: 'next',
          generationRequestId: 'R2',
          startedAt: Date.now() - 86_400_000,
          abortController: next,
        })
        expect(next.signal.aborted).toBe(false)
        expect(
          yield* streams.hasStopIntent({ ...input, streamId: 'next' }),
        ).toBe(false)
        yield* streams.clearActiveStream({ ...input, expectedStreamId: 'next' })
        yield* streams.releaseLocalStream({ ...input, streamId: 'first' })
        yield* streams.releaseLocalStream({ ...input, streamId: 'next' })
      }).pipe(Effect.provide(StreamResumeService.layerMemory)),
    )
  })
  it('expires stop intents rather than cancelling future attempts indefinitely', async () => {
    vi.useFakeTimers()
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const streams = yield* StreamResumeService
          const input = {
            userId: 'ttl-owner',
            threadId: 'ttl-thread',
            requestId: 'stopped-post',
            streamId: 'stopped-stream',
          }
          yield* streams.recordStopIntent({
            ...input,
            targetRequestId: input.requestId,
          })
          expect(yield* streams.hasStopIntent(input)).toBe(true)
          vi.advanceTimersByTime(60_001)
          expect(yield* streams.hasStopIntent(input)).toBe(false)
        }).pipe(Effect.provide(StreamResumeService.layerMemory)),
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
