import type { XaiLanguageModelResponsesOptions } from '@ai-sdk/xai'
import type { AiModelCatalogEntry } from '../types'

/**
 * Shared base options for xAI Responses API (store only).
 */
function xaiBaseOptions(): XaiLanguageModelResponsesOptions {
  return { store: false } satisfies XaiLanguageModelResponsesOptions
}

/**
 * Builds xAI Responses API provider options for a given reasoning effort.
 */
function xaiReasoningOptions(
  reasoningEffort: NonNullable<
    XaiLanguageModelResponsesOptions['reasoningEffort']
  >,
): Record<string, unknown> {
  return {
    xai: {
      ...xaiBaseOptions(),
      reasoningEffort,
    } satisfies XaiLanguageModelResponsesOptions,
  }
}

/**
 * Default provider options for models that do not use per-effort options.
 */
function xaiDefaultProviderOptions(): Record<string, unknown> {
  return { xai: xaiBaseOptions() }
}

/**
 * xAI model catalog. Model IDs, context windows, max tokens, and pricing
 */
export const XAI_MODELS: readonly AiModelCatalogEntry<'xai'>[] = [
  // Grok 4 Fast
  {
    id: 'xai/grok-4-fast-reasoning',
    providerId: 'xai',
    name: 'Grok 4 Fast Reasoning',
    description:
      'Grok 4 fast variant with reasoning and tool support. Large context with implicit caching.',
    contextWindow: 2000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search', 'code_execution'],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: xaiReasoningOptions('low'),
      medium: xaiReasoningOptions('medium'),
      high: xaiReasoningOptions('high'),
    },
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 256000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000005',
      inputTiers: [
        { cost: '0.0000002', min: 0, max: 128001 },
        { cost: '0.0000004', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.0000005', min: 0, max: 128001 },
        { cost: '0.000001', min: 128001 },
      ],
    },
  },
  {
    id: 'xai/grok-4-fast-non-reasoning',
    providerId: 'xai',
    name: 'Grok 4 Fast Non-Reasoning',
    description:
      'Grok 4 fast variant tuned for low-latency responses without reasoning.',
    contextWindow: 2000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search'],
    reasoningEfforts: [],
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 256000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000005',
      inputTiers: [
        { cost: '0.0000002', min: 0, max: 128001 },
        { cost: '0.0000004', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.0000005', min: 0, max: 128001 },
        { cost: '0.000001', min: 128001 },
      ],
    },
  },
  // Grok 4.1 (gateway uses dot: grok-4.1)
  {
    id: 'xai/grok-4.1-fast-reasoning',
    providerId: 'xai',
    name: 'Grok 4.1 Fast Reasoning',
    description:
      'Fast Grok 4.1 model with reasoning enabled and server-side tool support.',
    contextWindow: 2000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search', 'code_execution'],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: xaiReasoningOptions('low'),
      medium: xaiReasoningOptions('medium'),
      high: xaiReasoningOptions('high'),
    },
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 30000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000005',
      inputTiers: [
        { cost: '0.0000002', min: 0, max: 128001 },
        { cost: '0.0000004', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.0000005', min: 0, max: 128001 },
        { cost: '0.000001', min: 128001 },
      ],
    },
  },
  {
    id: 'xai/grok-4.1-fast-non-reasoning',
    providerId: 'xai',
    name: 'Grok 4.1 Fast Non-Reasoning',
    description: 'Fast Grok 4.1 model tuned for low-latency responses.',
    contextWindow: 2000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search'],
    reasoningEfforts: [],
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 30000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000005',
      inputTiers: [
        { cost: '0.0000002', min: 0, max: 128001 },
        { cost: '0.0000004', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.0000005', min: 0, max: 128001 },
        { cost: '0.000001', min: 128001 },
      ],
    },
  },
  // Grok Code
  {
    id: 'xai/grok-code-fast-1',
    providerId: 'xai',
    name: 'Grok Code Fast 1',
    description: 'Code-focused Grok model for engineering workflows with reasoning.',
    contextWindow: 256000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['code_execution', 'web_search'],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: xaiReasoningOptions('low'),
      medium: xaiReasoningOptions('medium'),
      high: xaiReasoningOptions('high'),
    },
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 256000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000015',
      inputCacheReadPerToken: '0.00000002',
    },
  },
]
