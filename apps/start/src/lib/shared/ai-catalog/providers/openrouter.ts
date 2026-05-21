import type { AiModelCatalogEntry } from '../types'

/**
 * OpenRouter model catalog.
 *
 * OpenRouter is intentionally kept separate from the Vercel AI Gateway: only
 * the auto-router model is exposed, and all requests for it must go through
 *
 * ZDR is enforced dynamically via the request body (`provider.zdr: true`)
 * when an organization has `require_zdr` enabled. Because we can enforce
 * ZDR at runtime, the catalog row reports `zeroDataRetention: true`.
 */
export const OPENROUTER_MODELS: readonly AiModelCatalogEntry<'openrouter'>[] = [
  {
    id: 'openrouter/auto',
    providerId: 'openrouter',
    providers: ['openrouter'],
    name: 'Auto',
    description:
      "Auto Router automatically selects the best model for each prompt from a curated set of high-quality models, balancing capability, latency, and cost.",
    contextWindow: 200000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultMaxOutputTokens: 16384,
  },
]
