import type { OpenAILanguageModelResponsesOptions } from '@ai-sdk/openai'
import type { AiModelCatalogEntry } from '../types'

/**
 * Shared base options for all OpenAI Responses API calls. Keeps provider
 * options aligned with the SDK (serviceTier, textVerbosity, store, etc.).
 */
function openaiBaseOptions(): OpenAILanguageModelResponsesOptions {
  return {
    store: false,
    serviceTier: 'auto',
    textVerbosity: 'medium',
  } satisfies OpenAILanguageModelResponsesOptions
}

/**
 * Builds OpenAI Responses API provider options for a given reasoning effort.
 * Merges base options (serviceTier, textVerbosity, store) with reasoningEffort
 * and reasoningSummary for reasoning models.
 */
function openaiReasoningOptions(
  reasoningEffort: OpenAILanguageModelResponsesOptions['reasoningEffort'],
): Record<string, unknown> {
  return {
    openai: {
      ...openaiBaseOptions(),
      reasoningEffort,
      reasoningSummary: 'auto',
    } satisfies OpenAILanguageModelResponsesOptions,
  }
}

/**
 * Default provider options for models that do not use per-effort options
 * (e.g. non-reasoning or when no effort is selected). Uses same base as
 * reasoning options for consistency.
 */
function openaiDefaultProviderOptions(): Record<string, unknown> {
  return { openai: openaiBaseOptions() }
}

/**
 * OpenAI model catalog. Model IDs, context windows, max tokens, capabilities,
 * and provider-specific options (reasoningEffort, store, serviceTier,
 * textVerbosity, reasoningSummary).
 */
export const OPENAI_MODELS: readonly AiModelCatalogEntry<'openai'>[] = [
  // GPT-5.2 (Dec 2025)
  {
    id: 'openai/gpt-5.2-chat',
    providerId: 'openai',
    name: 'GPT-5.2',
    description:
      'The model powering ChatGPT is gpt-5.2-chat-latest: this is OpenAI\'s best general-purpose model, part of the GPT-5 flagship model family.',
    contextWindow: 128000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ["web_search"],
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.00000175',
      outputPerToken: '0.000014',
      inputCacheReadPerToken: '0.000000175',
      webSearchPerRequest: '10',
    },
  },
  {
    id: 'openai/gpt-5.2-codex',
    providerId: 'openai',
    name: 'GPT-5.2-Codex',
    description:
      'GPT‑5.2-Codex is a version of GPT‑5.2⁠ further optimized for agentic coding in Codex, including improvements on long-horizon work through context compaction, stronger performance on large code changes like refactors and migrations, improved performance in Windows environments, and significantly stronger cybersecurity capabilities.',
    contextWindow: 400000,
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
      xhigh: openaiReasoningOptions('xhigh'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.00000175',
      outputPerToken: '0.000014',
      inputCacheReadPerToken: '0.000000175',
      webSearchPerRequest: '10',
    },
  },
  // o4-mini (Apr 2025)
  {
    id: 'openai/o4-mini',
    providerId: 'openai',
    name: 'o4-mini',
    description:
      'OpenAI\'s o4-mini delivers fast, cost-efficient reasoning with exceptional performance for its size, particularly excelling in math (best-performing on AIME benchmarks), coding, and visual tasks.',
    contextWindow: 200000,
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 100000,
    pricing: {
      inputPerToken: '0.0000011',
      outputPerToken: '0.0000044',
      inputCacheReadPerToken: '0.000000275',
    },
  },
  // GPT-5.1
  {
    id: 'openai/gpt-5.1-instant',
    providerId: 'openai',
    name: 'GPT-5.1 Instant',
    description:
      'GPT-5.1 Instant (or GPT-5.1 chat) is a warmer and more conversational version of GPT-5-chat, with improved instruction following and adaptive reasoning for deciding when to think before responding.',
    contextWindow: 128000,
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
    reasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: openaiReasoningOptions('none'),
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.00000013',
    },
  },
  {
    id: 'openai/gpt-5.1-thinking',
    providerId: 'openai',
    name: 'GPT 5.1 Thinking',
    description:
      'An upgraded version of GPT-5 that adapts thinking time more precisely to the question to spend more time on complex questions and respond more quickly to simpler tasks.',
    contextWindow: 400000,
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
    reasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: openaiReasoningOptions('none'),
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.00000013',
    },
  },
  // GPT-5
  {
    id: 'openai/gpt-5-chat',
    providerId: 'openai',
    name: 'GPT-5',
    description: 'GPT-5 Chat points to the GPT-5 snapshot currently used in ChatGPT.',
    contextWindow: 128000,
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.000000125',
      webSearchPerRequest: '10',
    },
  },
  {
    id: 'openai/gpt-5-mini',
    providerId: 'openai',
    name: 'GPT-5 mini',
    description:
      'GPT-5 mini is a cost optimized model that excels at reasoning/chat tasks. It offers an optimal balance between speed, cost, and capability.',
    contextWindow: 400000,
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.00000025',
      outputPerToken: '0.000002',
      inputCacheReadPerToken: '0.00000003',
    },
  },
  {
    id: 'openai/gpt-5-nano',
    providerId: 'openai',
    name: 'GPT-5 nano',
    description:
      'GPT-5 nano is a high throughput model that excels at simple instruction or classification tasks.',
    contextWindow: 400000,
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.00000005',
      outputPerToken: '0.0000004',
      inputCacheReadPerToken: '0.00000001',
    },
  },
  // GPT-4.1
  {
    id: 'openai/gpt-4.1',
    providerId: 'openai',
    name: 'GPT-4.1',
    description:
      "GPT 4.1 is OpenAI's flagship model for complex tasks. It is well suited for problem solving across domains.",
    contextWindow: 1047576,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 32768,
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.000008',
      inputCacheReadPerToken: '0.0000005',
    },
  },
  // o-series
  {
    id: 'openai/o1',
    providerId: 'openai',
    name: 'o1',
    description:
      'o1 is OpenAI\'s flagship reasoning model, designed for complex problems that require deep thinking. It provides strong reasoning capabilities with improved accuracy for complex multi-step tasks.',
    contextWindow: 200000,
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 100000,
    pricing: {
      inputPerToken: '0.000015',
      outputPerToken: '0.00006',
      inputCacheReadPerToken: '0.0000075',
    },
  },
  {
    id: 'openai/o3',
    providerId: 'openai',
    name: 'o3',
    description:
      'OpenAI\'s o3 is their most powerful reasoning model, setting new state-of-the-art benchmarks in coding, math, science, and visual perception. It excels at complex queries requiring multi-faceted analysis, with particular strength in analyzing images, charts, and graphics.',
    contextWindow: 200000,
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 100000,
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.000008',
      inputCacheReadPerToken: '0.0000005',
    },
  },
  {
    id: 'openai/o3-mini',
    providerId: 'openai',
    name: 'o3-mini',
    description:
      'o3-mini is OpenAI\'s most recent small reasoning model, providing high intelligence at the same cost and latency targets of o1-mini.',
    contextWindow: 200000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: [],
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      minimal: openaiReasoningOptions('minimal'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 100000,
    pricing: {
      inputPerToken: '0.0000011',
      outputPerToken: '0.0000044',
      inputCacheReadPerToken: '0.00000055',
    },
  },
  // OSS
  {
    id: 'openai/gpt-oss-120b',
    providerId: 'openai',
    name: 'GPT-OSS 120B',
    description:
      'Extremely capable general-purpose LLM with strong, controllable reasoning capabilities. Open-weight model hosted via Vercel AI Gateway.',
    contextWindow: 131072,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 131072,
    pricing: {
      inputPerToken: '0.0000001',
      outputPerToken: '0.0000005',
    },
  },
  {
    id: 'openai/gpt-oss-20b',
    providerId: 'openai',
    name: 'GPT-OSS 20B',
    description:
      'A compact, open-weight language model optimized for low-latency and resource-constrained environments, including local and edge deployments. Hosted via Vercel AI Gateway.',
    contextWindow: 128000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 8192,
    pricing: {
      inputPerToken: '0.00000007',
      outputPerToken: '0.0000003',
    },
  },
]
