import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for Mistral models. No provider-specific options
 * required for basic chat; optional settings (safePrompt, parallelToolCalls,
 * document limits) can be added per-model if needed.
 */
function mistralDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

/**
 * Mistral AI model catalog.
 */
export const MISTRAL_MODELS: readonly AiModelCatalogEntry<'mistral'>[] = [
  {
    id: 'mistral/mistral-large-3',
    providerId: 'mistral',
    name: 'Mistral Large 3',
    description:
      'Flagship general-purpose multimodal model (Dec 2025). Strong reasoning, long context, and multilingual performance.',
    contextWindow: 256000,
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
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 32768,
    pricing: {
      inputPerToken: '0.0000005',
      outputPerToken: '0.0000015',
    },
  },
  {
    id: 'mistral/mistral-medium',
    providerId: 'mistral',
    name: 'Mistral Medium 3.1',
    description:
      'Frontier-class multimodal model (Aug 2025). Balanced performance and cost for complex tasks.',
    contextWindow: 128000,
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
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 32768,
    pricing: {
      inputPerToken: '0.0000004',
      outputPerToken: '0.000002',
    },
  },
  {
    id: 'mistral/mistral-small',
    providerId: 'mistral',
    name: 'Mistral Small 3.2',
    description:
      'Efficient generalist. Good balance of speed and quality for everyday tasks.',
    contextWindow: 131000,
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
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.00000006',
      outputPerToken: '0.00000018',
    },
  },
  {
    id: 'mistral/pixtral-large',
    providerId: 'mistral',
    name: 'Pixtral Large',
    description:
      'Vision-language model for image understanding and multimodal tasks. Supports images without degrading text performance.',
    contextWindow: 128000,
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
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000004',
      outputPerToken: '0.0000012',
    },
  },
  {
    id: 'mistral/codestral',
    providerId: 'mistral',
    name: 'Codestral',
    description:
      'Code-specialized model for completion, generation, and fill-in-the-middle. Low latency for dev workflows.',
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
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000009',
    },
  },
  {
    id: 'mistral/magistral-medium',
    providerId: 'mistral',
    name: 'Magistral Medium 1.2',
    description:
      'Frontier multimodal reasoning model. Step-by-step thinking for complex problems.',
    contextWindow: 128000,
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
    reasoningEfforts: [],
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000005',
      outputPerToken: '0.0000015',
    },
  },
  {
    id: 'mistral/magistral-small',
    providerId: 'mistral',
    name: 'Magistral Small 1.2',
    description:
      'Small multimodal reasoning model (Sep 2025). Efficient step-by-step thinking.',
    contextWindow: 128000,
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
    reasoningEfforts: [],
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000006',
    },
  },
  {
    id: 'mistral/ministral-14b',
    providerId: 'mistral',
    name: 'Ministral 14B',
    description:
      'Best-in-class small model with text and vision. Strong quality in the efficient tier.',
    contextWindow: 128000,
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
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000001',
      outputPerToken: '0.0000003',
    },
  },
  {
    id: 'mistral/ministral-8b',
    providerId: 'mistral',
    name: 'Ministral 8B',
    description:
      'Efficient 8B model with text and vision. Cost-sensitive and fast.',
    contextWindow: 128000,
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
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.00000005',
      outputPerToken: '0.00000015',
    },
  },
  {
    id: 'mistral/devstral-2',
    providerId: 'mistral',
    name: 'Devstral 2',
    description:
      'Developer-oriented model for code and technical assistance with strong tool use.',
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
    defaultProviderOptions: mistralDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000006',
    },
  },
]
