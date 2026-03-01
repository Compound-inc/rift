import { Effect } from 'effect'

/**
 * Forks background work without failing the caller while preserving
 * observability through a typed error side-channel.
 */
export const runDetachedObserved = Effect.fn('server-effect.runDetachedObserved')(
  function* <TValue, TError, TRequirements>(input: {
    readonly effect: Effect.Effect<TValue, TError, TRequirements>
    readonly onFailure: (error: TError) => Effect.Effect<void, never, TRequirements>
  }): Effect.fn.Return<void, never, TRequirements> {
    yield* Effect.forkDetach(
      input.effect.pipe(
        Effect.catch((error) => input.onFailure(error)),
      ),
    )
  },
)

/**
 * Runs detached work from imperative callbacks (for example, streaming hooks)
 * and forwards typed failures to an Effect-based error handler.
 */
export function runDetachedUnsafe<TValue, TError>(
  effect: Effect.Effect<TValue, TError>,
  onFailure: (error: TError) => Effect.Effect<void, never>,
): void {
  void Effect.runPromise(effect).catch((error) => {
    void Effect.runPromise(onFailure(error as TError))
  })
}
