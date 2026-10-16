/**
 * Prompt caching for requests that bypass the AI Gateway.
 *
 * Gateway requests already get `gateway.caching: 'auto'` (see
 * `withGatewayComplianceProviderOptions`), which makes the gateway place
 * provider-specific cache breakpoints itself. BYOK requests go straight to
 * the provider SDK with the org's own key, so that option never applies:
 *
 *   - OpenAI caches stable prompt prefixes automatically; nothing to add.
 *   - Anthropic only caches when asked. Request-level `cacheControl` turns on
 *     Anthropic's automatic caching, which caches the prompt up to its last
 *     cacheable block on every turn. That covers the system prompt and the
 *     RAG document library, which sits on the first user message precisely
 *     so it stays a stable prefix (ADR-0006).
 */
export function withDirectProviderPromptCaching(input: {
  readonly providerOptions?: Record<string, unknown>
  readonly providerKeyOverrideProviderId?: 'openai' | 'anthropic'
}): Record<string, unknown> | undefined {
  if (input.providerKeyOverrideProviderId !== 'anthropic') {
    return input.providerOptions
  }
  const anthropicOptions =
    input.providerOptions?.anthropic &&
    typeof input.providerOptions.anthropic === 'object' &&
    !Array.isArray(input.providerOptions.anthropic)
      ? (input.providerOptions.anthropic as Record<string, unknown>)
      : undefined
  return {
    ...(input.providerOptions ?? {}),
    anthropic: {
      ...(anthropicOptions ?? {}),
      cacheControl: { type: 'ephemeral' },
    },
  }
}
