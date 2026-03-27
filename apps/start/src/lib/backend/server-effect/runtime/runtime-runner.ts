import { Cause, Exit, Layer, ManagedRuntime, Option } from 'effect'
import type { Effect } from 'effect'
import {
  ServerObservabilityLayer,
  withServerRuntimeObservability,
} from './server-observability.layer'

/**
 * Reuse one memo map across all runtimes so shared layers such as database
 * clients are initialized once per process instead of once per domain runtime.
 */
const sharedRuntimeMemoMap = Layer.makeMemoMapUnsafe()

/**
 * Shared helper for running Effect programs from framework edges.
 *
 * The runner provides a single `ManagedRuntime` for a layer and standardizes
 * failure unwrapping so callers receive the first tagged error whenever possible.
 */
export function makeRuntimeRunner<TServices, TLayerError>(
  layer: Layer.Layer<TServices, TLayerError, never>,
) {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(layer, ServerObservabilityLayer),
    { memoMap: sharedRuntimeMemoMap },
  )

  const runExit = <TValue, TError>(
    effect: Effect.Effect<TValue, TError, TServices>,
  ) =>
    runtime.runPromiseExit(
      withServerRuntimeObservability(effect),
    ) as Promise<Exit.Exit<TValue, TError>>

  const run = <TValue, TError>(
    effect: Effect.Effect<TValue, TError, TServices>,
  ) =>
    runExit(effect).then((exit) => {
      if (Exit.isSuccess(exit)) {
        return exit.value
      }

      const failure = Cause.findErrorOption(exit.cause)
      if (Option.isSome(failure)) {
        throw failure.value
      }

      throw Cause.squash(exit.cause)
    })

  return {
    runtime,
    run,
    runExit,
    dispose: () => runtime.dispose(),
  }
}
