import type {
  CatalogProviderId,
  CatalogProviderToolId,
  ProviderToolIdByProvider,
} from './provider-tools'

/** Normalized reasoning levels exposed to UI and accepted by chat requests. */
export type AiReasoningEffort =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'

/** Provider-local tool id that can be attached to specific models. */
export type AiProviderToolId = CatalogProviderToolId

/**
 * Runtime capabilities exposed to UI/policy consumers so behavior can be gated
 * by feature support instead of provider-specific conditionals.
 */
export type AiModelCapabilities = {
  readonly supportsTools: boolean
  readonly supportsStreaming: boolean
  readonly supportsReasoning: boolean
  readonly supportsImageInput: boolean
  readonly supportsFileInput: boolean
  readonly supportsPdfInput: boolean
}

/**
 * Provider/model-specific constraints that callers may need to satisfy before
 * executing a request (for example, API flags or prompt requirements).
 */
export type AiModelRequirement = {
  readonly key: string
  readonly value: string | boolean | number
}

/**
 * Tiered cost for token-based pricing (e.g. higher cost above a context threshold).
 * Cost is per-token in dollars as string (e.g. "0.000005").
 */
export type AiPricingTier = {
  readonly cost: string
  readonly min: number
  readonly max?: number
}

/**
 * Optional pricing metadata aligned with Vercel AI Gateway /v1/models response.
 * Used for display and cost estimation; all values are per-token in dollars as strings
 * unless noted. See https://vercel.com/docs/ai-gateway/models-and-providers
 */
export type AiModelPricing = {
  readonly inputPerToken: string
  readonly outputPerToken: string
  readonly inputCacheReadPerToken?: string
  readonly inputCacheWritePerToken?: string
  /** Web search cost per request (when supported). */
  readonly webSearchPerRequest?: string
  readonly inputTiers?: readonly AiPricingTier[]
  readonly outputTiers?: readonly AiPricingTier[]
  readonly inputCacheReadTiers?: readonly AiPricingTier[]
  readonly inputCacheWriteTiers?: readonly AiPricingTier[]
}

/**
 * Canonical catalog row used across policy evaluation, admin settings, and
 * chat runtime model selection.
 */
export type AiModelCatalogEntry<
  TProviderId extends CatalogProviderId = CatalogProviderId,
> = {
  readonly id: string
  readonly providerId: TProviderId
  readonly name: string
  readonly description: string
  readonly contextWindow: number
  /** ZDR: Zero Data Retention. True when the provider does not retain training data. */
  readonly zeroDataRetention: boolean
  readonly capabilities: AiModelCapabilities
  /** Provider-specific tools explicitly enabled for this model. */
  readonly providerToolIds: readonly ProviderToolIdByProvider[TProviderId][]
  /**
   * Reasoning settings are model-specific to prevent invalid combinations.
   * An empty list means the model should be treated as non-reasoning.
   */
  readonly reasoningEfforts: readonly AiReasoningEffort[]
  readonly defaultReasoningEffort?: AiReasoningEffort
  /**
   * Provider options keyed by reasoning effort allow per-model tuning while
   * keeping execution logic provider-agnostic.
   */
  readonly providerOptionsByReasoning?: Partial<
    Record<AiReasoningEffort, Record<string, unknown>>
  >
  readonly defaultProviderOptions?: Record<string, unknown>
  readonly defaultMaxOutputTokens?: number
  readonly requirements?: readonly AiModelRequirement[]
  /** Optional pricing from Vercel AI Gateway (or same shape) for display and cost estimation. */
  readonly pricing?: AiModelPricing
}
