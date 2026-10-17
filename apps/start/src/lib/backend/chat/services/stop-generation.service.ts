import { Effect, Layer, ServiceMap } from 'effect'
import type { ChatDomainError } from '../domain/errors'
import { StreamResumeService } from './stream-resume.service'
import { ThreadService } from './thread.service'

type StopGenerationInput = {
  readonly userId: string
  readonly organizationId?: string
  readonly threadId: string
  readonly requestId: string
  readonly targetRequestId?: string
}

/** Ownership is checked even when no stream remains, before reading its key. */
export class StopGenerationService extends ServiceMap.Service<
  StopGenerationService,
  {
    readonly stop: (
      input: StopGenerationInput,
    ) => Effect.Effect<boolean, ChatDomainError>
  }
>()('chat-backend/StopGenerationService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const threads = yield* ThreadService
      const streams = yield* StreamResumeService
      return {
        stop: Effect.fn('StopGenerationService.stop')(function* (
          input: StopGenerationInput,
        ) {
          yield* threads.assertThreadAccess({
            ...input,
            createIfMissing: false,
          })
          const streamId = yield* streams.recordStopIntent(input)
          if (!streamId) return false
          yield* streams.stopStream({
            streamId,
            requestId: input.requestId,
            reason: 'user-stop',
          })
          // Clear only this generation. A concurrently started turn owns a new key.
          yield* streams.clearActiveStream({
            ...input,
            expectedStreamId: streamId,
          })
          return true
        }),
      }
    }),
  )
}
