import { Cause, Effect, Exit, Option } from 'effect'
import { ChatLiveLayer } from './live'

export function runChatEffect<TValue, TError, TRequirements>(
  effect: Effect.Effect<TValue, TError, TRequirements>,
) {
  return Effect.runPromiseExit(
    effect.pipe(Effect.provide(ChatLiveLayer as never)) as Effect.Effect<
      TValue,
      TError,
      never
    >,
  ).then((exit) => {
    if (Exit.isSuccess(exit)) {
      return exit.value
    }

    const failure = Cause.failureOption(exit.cause)
    if (Option.isSome(failure)) {
      throw failure.value
    }

    throw Cause.squash(exit.cause)
  })
}
