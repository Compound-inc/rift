import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for Moonshot AI models.
 */
function moonshotaiDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

/**
 * Provider options for Moonshot thinking/reasoning models.
 */
function moonshotaiReasoningOptions(
  budgetTokens: number,
): Record<string, unknown> {
  return {
    moonshotai: {
      thinking: { type: 'enabled' as const, budgetTokens },
      reasoningHistory: 'interleaved' as const,
    },
  }
}

/**
 * Moonshot AI model catalog.
 */
export const MOONSHOTAI_MODELS: readonly AiModelCatalogEntry<'moonshotai'>[] = [
  // Chat models verified against https://ai-gateway.vercel.sh/v1/models on 2026-10-16.
  {
    id: 'moonshotai/kimi-k3',
    providerId: 'moonshotai',
    providers: ['gateway'],
    name: 'Kimi K3',
    description:
      'Kimi’s flagship model for long-horizon coding and end-to-end knowledge work, with a 1M-token context window.',
    contextWindow: 1000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: [],
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 131072,
    pricing: {
      inputPerToken: '0.000003',
      outputPerToken: '0.000015',
      inputCacheReadPerToken: '0.0000003',
    },
  },
  {
    id: 'moonshotai/kimi-k2.7-code',
    providerId: 'moonshotai',
    providers: ['gateway'],
    name: 'Kimi K2.7 Code',
    description:
      'Kimi-K2.7-Code is a coding model from Moonshot AI. It has  improved coding & agent performance over K2.6, more reasoning efficiency with less overthinking, and improved instruction following for long-horizon coding.',
    contextWindow: 256000,
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
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 32768,
    legacy: true,
    pricing: {
      inputPerToken: '0.00000095',
      outputPerToken: '0.000004',
      inputCacheReadPerToken: '0.00000019',
    },
  },

  {
    id: 'moonshotai/kimi-k2.6',
    legacy: true,
    providerId: 'moonshotai',
    providers: ['gateway'],
    name: 'Kimi K2.6',
    description: 'Long-horizon coding and design-with-code with vision input.',
    contextWindow: 262000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: moonshotaiReasoningOptions(1024),
      medium: moonshotaiReasoningOptions(2048),
      high: moonshotaiReasoningOptions(8192),
    },
    defaultProviderOptions: moonshotaiReasoningOptions(2048),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.00000095',
      outputPerToken: '0.000004',
      inputCacheReadPerToken: '0.00000016',
    },
  },
  {
    id: 'moonshotai/kimi-k2.5',
    legacy: true,
    providerId: 'moonshotai',
    providers: ['gateway'],
    name: 'Kimi K2.5',
    description: 'Flagship multimodal model.',
    contextWindow: 262114,
    zeroDataRetention: true,
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
    pricing: {
      inputPerToken: '0.0000006',
      outputPerToken: '0.000003',
      inputCacheReadPerToken: '0.0000001',
    },
  },
  {
    id: 'moonshotai/kimi-k2-thinking',
    legacy: true,
    providerId: 'moonshotai',
    providers: ['gateway'],
    name: 'Kimi K2 Thinking',
    description: 'Model with step-by-step reasoning.',
    contextWindow: 262114,
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: moonshotaiReasoningOptions(1024),
      medium: moonshotaiReasoningOptions(2048),
      high: moonshotaiReasoningOptions(8192),
    },
    defaultProviderOptions: moonshotaiReasoningOptions(2048),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000006',
      outputPerToken: '0.0000025',
      inputCacheReadPerToken: '0.00000015',
    },
  },
  {
    id: 'moonshotai/kimi-k2',
    legacy: true,
    providerId: 'moonshotai',
    providers: ['gateway'],
    name: 'Kimi K2',
    description:
      'General-purpose model with strong reasoning and tool support.',
    contextWindow: 131072,
    zeroDataRetention: false,
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
    pricing: {
      inputPerToken: '0.00000057',
      outputPerToken: '0.0000023',
    },
  },
]
