import { Effect, Layer, ServiceMap } from 'effect'
import { RateLimitExceededError } from '../domain/errors'
import { getMemoryState } from '../infra/memory/state'

/**
 * Simple fixed-window in-memory rate limiting.
 * Replace with Redis/distributed limiter before scaling beyond single-node semantics.
 */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30

/** Service contract for per-user chat request throttling. */
export type RateLimitServiceShape = {
  readonly assertAllowed: (input: {
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly allowed: true; readonly remaining: number },
    RateLimitExceededError
  >
}

/** Injectable rate-limit service token. */
export class RateLimitService extends ServiceMap.Service<
  RateLimitService,
  RateLimitServiceShape
>()('chat-backend/RateLimitService') {
  /** In-memory rate limiter used by current live wiring. */
  static readonly layerMemory = Layer.succeed(this, {
    assertAllowed: Effect.fn('RateLimitService.assertAllowed')(
      function* ({ userId, requestId }: { readonly userId: string; readonly requestId: string }) {
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
      },
    ),
  })
}
