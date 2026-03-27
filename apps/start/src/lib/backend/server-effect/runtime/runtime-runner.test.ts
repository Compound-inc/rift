import { describe, expect, it } from 'vitest'
import { Effect, Layer, Schema, ServiceMap } from 'effect'
import { makeRuntimeRunner } from './runtime-runner'

class RuntimeRunnerTestError extends Schema.TaggedErrorClass<RuntimeRunnerTestError>()(
  'RuntimeRunnerTestError',
  {
    message: Schema.String,
  },
) {}

class RuntimeValueService extends ServiceMap.Service<
  RuntimeValueService,
  { readonly value: string }
>()('test/RuntimeValueService') {}

describe('makeRuntimeRunner', () => {
  it('runs provided effects and resolves service dependencies', async () => {
    const runner = makeRuntimeRunner(
      Layer.succeed(RuntimeValueService, { value: 'ready' }),
    )

    const result = await runner.run(
      Effect.gen(function* () {
        const runtimeValue = yield* RuntimeValueService
        return runtimeValue.value
      }),
    )

    expect(result).toBe('ready')
    await runner.dispose()
  })

  it('unwraps tagged failures from the exit cause', async () => {
    const runner = makeRuntimeRunner(Layer.succeed(RuntimeValueService, { value: 'ready' }))

    await expect(
      runner.run(
        Effect.fail(
          new RuntimeRunnerTestError({
            message: 'boom',
          }),
        ),
      ),
    ).rejects.toMatchObject({
      _tag: 'RuntimeRunnerTestError',
      message: 'boom',
    })

    await runner.dispose()
  })

  it('reuses memoized layer resources across runtime runners', async () => {
    let builds = 0
    const layer = Layer.effect(RuntimeValueService, Effect.sync(() => {
        builds += 1
        return RuntimeValueService.of({ value: 'shared' })
      }))
    const runnerA = makeRuntimeRunner(layer)
    const runnerB = makeRuntimeRunner(layer)

    const [valueA, valueB] = await Promise.all([
      runnerA.run(Effect.gen(function* () {
        const service = yield* RuntimeValueService
        return service.value
      })),
      runnerB.run(Effect.gen(function* () {
        const service = yield* RuntimeValueService
        return service.value
      })),
    ])

    expect(valueA).toBe('shared')
    expect(valueB).toBe('shared')
    expect(builds).toBe(1)

    await runnerA.dispose()
    await runnerB.dispose()
  })
})
