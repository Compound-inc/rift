import { getCatalogModel } from '@/lib/shared/ai-catalog'
import type { OrgAiPolicy } from '@/lib/shared/model-policy/types'

/**
 * Compliance-aware provider option assembly for the AI Gateway.
 *
 * The chat orchestrator forwards two request-shaping concerns to the
 * gateway on every turn:
 *
 *   - `gateway.caching: 'auto'` (always)
 *   - `gateway.zeroDataRetention: true` (when the org's
 *     `complianceFlags.require_zdr` is on AND the request is not using a
 *     bring-your-own-key override; BYOK requests honor the user's own
 *     provider terms instead)
 *
 * This helper used to be inline inside `chat-orchestrator.service.ts`.
 * Extracting it makes the policy testable in isolation \u2014 a regression
 * test asserts the ZDR flag is forwarded for org policies that require
 * it, after a feature merge silently dropped that enforcement (see
 * commit `ee81f30f`).
 */
export function withGatewayComplianceProviderOptions(input: {
  readonly providerOptions?: Record<string, unknown>
  readonly orgPolicy?: OrgAiPolicy
  readonly hasProviderKeyOverride?: boolean
}): Record<string, unknown> | undefined {
  const gatewayOptions =
    input.providerOptions?.gateway &&
    typeof input.providerOptions.gateway === 'object' &&
    !Array.isArray(input.providerOptions.gateway)
      ? (input.providerOptions.gateway as Record<string, unknown>)
      : undefined

  const requireZdr = Boolean(input.orgPolicy?.complianceFlags.require_zdr)
  const applyZdr = requireZdr && !input.hasProviderKeyOverride

  return {
    ...(input.providerOptions ?? {}),
    gateway: {
      ...(gatewayOptions ?? {}),
      caching: 'auto',
      ...(applyZdr ? { zeroDataRetention: true } : {}),
    },
  }
}

/**
 * Resolves OpenRouter-specific request options for a single chat turn.
 * Returns `undefined` for non-OpenRouter routes so callers can ignore
 * the result without branching. ZDR enforcement is dynamic: when the
 * org has `require_zdr` enabled we surface a flag that the orchestrator
 * forwards as `provider.zdr: true` to OpenRouter, restricting routing
 * to ZDR endpoints regardless of the upstream model picked by the auto
 * router.
 */
export function resolveOpenRouterRequestOptions(input: {
  readonly modelId: string
  readonly orgPolicy?: OrgAiPolicy
}): { readonly enforceZdr: boolean } | undefined {
  const catalogModel = getCatalogModel(input.modelId)
  if (catalogModel?.providerId !== 'openrouter') return undefined

  return {
    enforceZdr: Boolean(input.orgPolicy?.complianceFlags.require_zdr),
  }
}
