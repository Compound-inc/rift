import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { getMemoryState } from '../infra/memory/state'
import { StopGenerationService } from './stop-generation.service'
import { StreamResumeService } from './stream-resume.service'
import { ThreadService } from './thread.service'

const layer = StopGenerationService.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(ThreadService.layerMemory, StreamResumeService.layerMemory),
  ),
)

describe('StopGenerationService', () => {
  it('aborts the owned stream and treats repeated/finished stops as success', async () => {
    const controller = new AbortController()
    await Effect.runPromise(
      Effect.gen(function* () {
        const threads = yield* ThreadService
        const streams = yield* StreamResumeService
        const service = yield* StopGenerationService
        const { threadId } = yield* threads.createThread({
          userId: 'owner',
          modelId: 'model',
          requestId: 'create',
        })
        const input = { threadId, userId: 'owner', requestId: 'stop' }
        yield* streams.registerActiveStream({
          ...input,
          streamId: 'owned-stream',
          abortController: controller,
        })
        expect(yield* service.stop(input)).toBe(true)
        expect(controller.signal.aborted).toBe(true)
        expect(controller.signal.reason).toBe('user-stop')
        expect(yield* service.stop(input)).toBe(false)
        expect(yield* streams.getActiveStreamId(input)).toBeNull()
        yield* streams.releaseLocalStream({
          streamId: 'owned-stream',
          requestId: 'release',
        })
        getMemoryState().threads.delete(threadId)
        getMemoryState().messages.delete(threadId)
      }).pipe(Effect.provide(layer)),
    )
  })
  it('rejects another owner before stopping their stream', async () => {
    const controller = new AbortController()
    await Effect.runPromise(
      Effect.gen(function* () {
        const threads = yield* ThreadService
        const streams = yield* StreamResumeService
        const service = yield* StopGenerationService
        const { threadId } = yield* threads.createThread({
          userId: 'owner',
          modelId: 'model',
          requestId: 'create',
        })
        yield* streams.registerActiveStream({
          threadId,
          userId: 'owner',
          requestId: 'register',
          streamId: 'private-stream',
          abortController: controller,
        })
        const error = yield* service
          .stop({ threadId, userId: 'stranger', requestId: 'denied' })
          .pipe(Effect.flip)
        expect(error._tag).toBe('ThreadForbiddenError')
        expect(controller.signal.aborted).toBe(false)
        yield* streams.clearActiveStream({
          threadId,
          userId: 'owner',
          requestId: 'clear',
        })
        yield* streams.releaseLocalStream({
          streamId: 'private-stream',
          requestId: 'release',
        })
        getMemoryState().threads.delete(threadId)
        getMemoryState().messages.delete(threadId)
      }).pipe(Effect.provide(layer)),
    )
  })
  it('does not create a missing thread', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* StopGenerationService
        return yield* service.stop({
          threadId: 'missing-stop',
          userId: 'owner',
          requestId: 'missing',
        })
      }).pipe(Effect.provide(layer), Effect.flip),
    )
    expect(error._tag).toBe('ThreadNotFoundError')
  })
})
