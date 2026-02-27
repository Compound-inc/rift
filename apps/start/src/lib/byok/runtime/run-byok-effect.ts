import { Cause, Effect, Exit, Option } from 'effect'
import { ByokLiveLayer } from './live'

/**
 * Runs a BYOK Effect with live dependencies and unwraps failures into thrown
 * tagged domain errors so the server function can map them to user-facing messages.
 */
export function runByokEffect<TValue, TError, TRequirements>(
  effect: Effect.Effect<TValue, TError, TRequirements>,
): Promise<TValue> {
  return Effect.runPromiseExit(
    effect.pipe(Effect.provide(ByokLiveLayer as never)) as Effect.Effect<
      TValue,
      TError,
      never
    >,
  ).then((exit) => {
    if (Exit.isSuccess(exit)) {
      return exit.value
    }
    const failure = Cause.findErrorOption(exit.cause)
    if (Option.isSome(failure)) {
      throw failure.value
    }
    throw Cause.squash(exit.cause)
  })
}
