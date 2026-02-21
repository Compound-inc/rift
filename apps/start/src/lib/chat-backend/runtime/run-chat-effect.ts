import { Effect } from 'effect'
import { ChatLiveLayer } from './live'

export function runChatEffect<TValue, TError, TRequirements>(
  effect: Effect.Effect<TValue, TError, TRequirements>,
) {
  return Effect.runPromise(
    effect.pipe(Effect.provide(ChatLiveLayer as never)) as Effect.Effect<
      TValue,
      TError,
      never
    >,
  )
}
