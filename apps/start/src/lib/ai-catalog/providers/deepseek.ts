import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for DeepSeek models. No provider-specific options
 * required for basic chat when using the AI Gateway.
 */
function deepseekDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

/**
 * DeepSeek model catalog. Data aligned with Vercel AI Gateway /v1/models
 * (pricing, context_window, max_tokens, tags → capabilities).
 */
export const DEEPSEEK_MODELS: readonly AiModelCatalogEntry<'deepseek'>[] = [
  {
    id: 'deepseek/deepseek-r1',
    providerId: 'deepseek',
    name: 'DeepSeek-R1',
    description:
      'The DeepSeek R1 model has undergone a minor version upgrade, with the current version being DeepSeek-R1-0528.',
    contextWindow: 160000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: false,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: deepseekDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000005',
      outputPerToken: '0.00000215',
      inputCacheReadPerToken: '0.0000004',
    },
  },
  {
    id: 'deepseek/deepseek-v3',
    providerId: 'deepseek',
    name: 'DeepSeek V3 0324',
    description: 'Fast general-purpose LLM with enhanced reasoning capabilities.',
    contextWindow: 163840,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: false,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: deepseekDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.00000077',
      outputPerToken: '0.00000077',
    },
  },
  {
    id: 'deepseek/deepseek-v3.1',
    providerId: 'deepseek',
    name: 'DeepSeek-V3.1',
    description:
      'DeepSeek-V3.1 is post-trained on the top of DeepSeek-V3.1-Base, with extended long context (32K→630B tokens, 128K→209B tokens) and UE8M0 FP8 scale data format.',
    contextWindow: 163840,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: deepseekDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.00000021',
      outputPerToken: '0.00000079',
    },
  },
  {
    id: 'deepseek/deepseek-v3.2',
    providerId: 'deepseek',
    name: 'DeepSeek V3.2',
    description: 'DeepSeek-V3.2: Official successor to V3.2-Exp.',
    contextWindow: 128000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: false,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: deepseekDefaultProviderOptions(),
    defaultMaxOutputTokens: 8000,
    pricing: {
      inputPerToken: '0.00000026',
      outputPerToken: '0.00000038',
      inputCacheReadPerToken: '0.00000013',
    },
  },
  {
    id: 'deepseek/deepseek-v3.2-thinking',
    providerId: 'deepseek',
    name: 'DeepSeek V3.2 Thinking',
    description: 'Thinking mode of DeepSeek V3.2.',
    contextWindow: 128000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: deepseekDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.00000028',
      outputPerToken: '0.00000042',
      inputCacheReadPerToken: '0.000000028',
    },
  },
]
