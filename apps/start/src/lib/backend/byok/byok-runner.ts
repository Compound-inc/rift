import { Effect, Schema } from 'effect'
import { PermissionService } from '@/lib/backend/permissions'
import { ByokExecutorService } from './services/byok-executor.service'
import { ByokValidationError } from './domain/errors'
import { UpdateByokPayload } from './domain/schemas'
import type { ByokUpdateResult } from './domain/types'
import { ByokRuntime } from './runtime/byok-runtime'
import { validateProviderApiKeyFormat } from '@/lib/shared/model-policy/provider-keys'

/**
 * Validates input and runs the BYOK update Effect.
 *
 * Gating goes through the canonical `PermissionService.authorize('workspace.byok')`
 * so plan changes, Singularity-granted feature overrides, and the
 * resolver's denial context (minimum plan id, gate message) are all
 * shared with every other server-side check.
 */
export async function runUpdateByok(input: {
  readonly organizationId: string
  readonly userId: string
  readonly data: unknown
}): Promise<ByokUpdateResult> {
  const program = Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknownEffect(UpdateByokPayload)(
      input.data,
    ).pipe(
      Effect.mapError(
        (parseError) =>
          new ByokValidationError({
            message: 'Invalid payload',
            issue: String(parseError),
          }),
      ),
    )
    const executor = yield* ByokExecutorService
    if (validated.action === 'set_provider_api_key') {
      const keyValidation = validateProviderApiKeyFormat({
        providerId: validated.providerId,
        apiKey: validated.apiKey,
      })

      if (!keyValidation.ok) {
        return yield* Effect.fail(
          new ByokValidationError({
            message: keyValidation.message ?? 'Invalid provider API key',
          }),
        )
      }
    }

    const permissions = yield* PermissionService
    yield* permissions.authorize({
      organizationId: input.organizationId,
      userId: input.userId,
      permissionKey: 'workspace.byok',
    })
    return yield* executor.executeUpdate(input.organizationId, validated)
  })
  return ByokRuntime.run(program)
}
