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
})
