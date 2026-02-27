import { Effect, Schema } from 'effect'
import { ByokExecutorService } from './services/byok-executor.service'
import { WorkOsOrgResolverService } from './services/workos-org-resolver.service'
import { ByokValidationError } from './domain/errors'
import { UpdateByokPayload } from './domain/schemas'
import type { ByokUpdateResult } from './domain/types'
import { runByokEffect } from './runtime/run-byok-effect'

/**
 * Validates input and runs the BYOK update Effect.
 */
export async function runUpdateByok(data: unknown): Promise<ByokUpdateResult> {
  const program = Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknownEffect(UpdateByokPayload)(
      data,
    ).pipe(
      Effect.mapError(
        (parseError) =>
          new ByokValidationError({
            message: 'Invalid payload',
            issue: String(parseError),
          }),
      ),
    )
    const resolver = yield* WorkOsOrgResolverService
    const executor = yield* ByokExecutorService
    const orgWorkosId = yield* resolver.getOrgWorkosId()
    return yield* executor.executeUpdate(orgWorkosId, validated)
  })
  return runByokEffect(program)
}
