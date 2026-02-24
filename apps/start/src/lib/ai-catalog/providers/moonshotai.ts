import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for Moonshot AI models. No provider-specific options
 * required for basic chat.
 */
function moonshotaiDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

/**
 * Provider options for Moonshot thinking/reasoning models.
 * Enables thinking with a token budget and interleaved reasoning history.
 */
function moonshotaiThinkingProviderOptions(): Record<string, unknown> {
  return {
    moonshotai: {
      thinking: { type: 'enabled' as const, budgetTokens: 2048 },
      reasoningHistory: 'interleaved' as const,
    },
  }
}

/**
 * Moonshot AI model catalog. Kimi K2, K2.5, and K2 Thinking only.
 */
export const MOONSHOTAI_MODELS: readonly AiModelCatalogEntry<'moonshotai'>[] = [
  {
    id: 'moonshotai/kimi-k2.5',
    providerId: 'moonshotai',
    name: 'Kimi K2.5',
    description:
      'Flagship multimodal model.',
    contextWindow: 128000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: moonshotaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
  },
  {
    id: 'moonshotai/kimi-k2',
    providerId: 'moonshotai',
    name: 'Kimi K2',
    description:
      'General-purpose model with strong reasoning and tool support.',
    contextWindow: 128000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: false,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: moonshotaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
  },
  {
    id: 'moonshotai/kimi-k2-thinking',
    providerId: 'moonshotai',
    name: 'Kimi K2 Thinking',
    description:
      'Model with step-by-step reasoning.',
    contextWindow: 128000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: moonshotaiThinkingProviderOptions(),
    defaultMaxOutputTokens: 16384,
  },
]
