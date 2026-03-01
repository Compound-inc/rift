import { Cause, Effect, Exit, Layer, ManagedRuntime, Option } from 'effect'

/**
 * Shared helper for running Effect programs from framework edges.
 *
 * The runner provides a single `ManagedRuntime` for a layer and standardizes
 * failure unwrapping so callers receive the first tagged error whenever possible.
 */
export function makeRuntimeRunner<TServices, TLayerError, TLayerRequirements>(
  layer: Layer.Layer<TServices, TLayerError, TLayerRequirements>,
) {
  const runtime = ManagedRuntime.make(
    layer as Layer.Layer<TServices, TLayerError, never>,
  )

  const runExit = <TValue, TError, TRequirements>(
    effect: Effect.Effect<TValue, TError, TRequirements>,
  ) =>
    runtime.runPromiseExit(
      effect as never,
    ) as Promise<Exit.Exit<TValue, TError>>

  const run = <TValue, TError, TRequirements>(
    effect: Effect.Effect<TValue, TError, TRequirements>,
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
