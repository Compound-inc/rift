import { Context, Effect, Layer } from 'effect'
import { RateLimitExceededError } from '../domain/errors'
import { getMemoryState } from '../infra/memory/state'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30

export type RateLimitServiceShape = {
  readonly assertAllowed: (input: {
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly allowed: true; readonly remaining: number },
    RateLimitExceededError
  >
}

export class RateLimitService extends Context.Tag('chat-backend/RateLimitService')<
  RateLimitService,
  RateLimitServiceShape
>() {}

export const RateLimitMemory = Layer.succeed(RateLimitService, {
  assertAllowed: ({ userId, requestId }) =>
    Effect.gen(function* () {
      const now = Date.now()
      const bucket = getMemoryState().rateLimits.get(userId)

      if (!bucket || now - bucket.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
        getMemoryState().rateLimits.set(userId, { windowStartMs: now, hits: 1 })
        return { allowed: true as const, remaining: RATE_LIMIT_MAX_REQUESTS - 1 }
      }

      if (bucket.hits >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - bucket.windowStartMs)
        return yield* Effect.fail(
          new RateLimitExceededError({
            message: 'Rate limit exceeded',
            requestId,
            userId,
            retryAfterMs,
          }),
        )
      }

      bucket.hits += 1
      getMemoryState().rateLimits.set(userId, bucket)
      return { allowed: true as const, remaining: RATE_LIMIT_MAX_REQUESTS - bucket.hits }
    }),
})
