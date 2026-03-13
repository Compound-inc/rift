import { Cause, Duration, Effect, Exit, Option } from 'effect'

const DETACHED_TASK_TIMEOUT = Duration.seconds(30)
type DetachedTimeout = ReturnType<typeof Duration.seconds>

type DetachedOutcomeHandler<TRequirements> =
  | Effect.Effect<void, never, TRequirements>
  | (() => Effect.Effect<void, never, TRequirements>)

function resolveDetachedOutcome<TRequirements>(
  outcome?: DetachedOutcomeHandler<TRequirements>,
) {
  if (!outcome) return Effect.void
  return typeof outcome === 'function' ? outcome() : outcome
}

function withDetachedTimeout<TError, TRequirements>(input: {
  readonly effect: Effect.Effect<void, TError, TRequirements>
  readonly onTimeout?: DetachedOutcomeHandler<TRequirements>
  readonly onInterrupt?: DetachedOutcomeHandler<TRequirements>
  readonly timeout?: DetachedTimeout
}) {
  return input.effect.pipe(
    Effect.exit,
    Effect.timeoutOption(input.timeout ?? DETACHED_TASK_TIMEOUT),
    Effect.flatMap((result) => {
      if (Option.isNone(result)) {
        return resolveDetachedOutcome(input.onTimeout)
      }

      if (Exit.isSuccess(result.value)) {
        return Effect.void
      }

      if (Cause.hasInterruptsOnly(result.value.cause)) {
        return resolveDetachedOutcome(input.onInterrupt)
      }

      return Effect.failCause(result.value.cause)
    }),
  )
}

/**
 * Forks background work without failing the caller while preserving
 * observability through a typed error side-channel.
 */
export const runDetachedObserved = Effect.fn('server-effect.runDetachedObserved')(
  function* <TValue, TError, TRequirements>(input: {
    readonly effect: Effect.Effect<TValue, TError, TRequirements>
    readonly onFailure: (error: TError) => Effect.Effect<void, never, TRequirements>
    readonly onTimeout?: DetachedOutcomeHandler<TRequirements>
    readonly onInterrupt?: DetachedOutcomeHandler<TRequirements>
    readonly timeout?: DetachedTimeout
  }): Effect.fn.Return<void, never, TRequirements> {
    yield* withDetachedTimeout({
      effect: input.effect.pipe(
        Effect.catch((error) => input.onFailure(error)),
        Effect.asVoid,
      ),
      onTimeout: input.onTimeout,
      onInterrupt: input.onInterrupt,
      timeout: input.timeout,
    }).pipe(Effect.forkDetach)
  },
)

/**
 * Runs detached work from imperative callbacks (for example, streaming hooks)
 * and forwards typed failures to an Effect-based error handler.
 */
export function runDetachedUnsafe<TValue, TError>(input: {
  readonly effect: Effect.Effect<TValue, TError>
  readonly onFailure: (error: TError) => Effect.Effect<void, never>
  readonly onTimeout?: DetachedOutcomeHandler<never>
  readonly onInterrupt?: DetachedOutcomeHandler<never>
  readonly timeout?: DetachedTimeout
}): void {
  void Effect.runPromise(
    withDetachedTimeout({
      effect: input.effect.pipe(
        Effect.catch((error) => input.onFailure(error)),
        Effect.asVoid,
      ),
      onTimeout: input.onTimeout,
      onInterrupt: input.onInterrupt,
      timeout: input.timeout,
    }),
  ).catch(() => undefined)
}
