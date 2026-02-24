import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for Alibaba (Qwen) models. No provider-specific
 * options required for basic chat when using the AI Gateway.
 */
function alibabaDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

/**
 * Alibaba (Qwen) model catalog — chat models only (no video, no vision/VL).
 * Data aligned with Vercel AI Gateway /v1/models (pricing, context_window,
 * max_tokens, tags → capabilities).
 */
export const ALIBABA_MODELS: readonly AiModelCatalogEntry<'alibaba'>[] = [
  {
    id: 'alibaba/qwen3-max',
    providerId: 'alibaba',
    name: 'Qwen3 Max',
    description:
      'The Qwen 3 series Max model has undergone specialized upgrades in agent programming and tool invocation. Achieves state-of-the-art performance and is suited to agents operating in more complex scenarios.',
    contextWindow: 262144,
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
    defaultProviderOptions: alibabaDefaultProviderOptions(),
    defaultMaxOutputTokens: 65536,
    pricing: {
      inputPerToken: '0.000000845',
      outputPerToken: '0.00000338',
      inputTiers: [
        { cost: '0.000000845', min: 0, max: 32769 },
        { cost: '0.0000014', min: 32769, max: 131073 },
        { cost: '0.00000211', min: 131073 },
      ],
      outputTiers: [
        { cost: '0.00000338', min: 0, max: 32769 },
        { cost: '0.00000564', min: 32769, max: 131073 },
        { cost: '0.00000845', min: 131073 },
      ],
    },
  },
  {
    id: 'alibaba/qwen3-max-thinking',
    providerId: 'alibaba',
    name: 'Qwen 3 Max Thinking',
    description:
      'Qwen-3 Max with integrated thinking and non-thinking modes. Thinking mode supports web search, web information extraction, and code interpreter for complex, deliberative reasoning.',
    contextWindow: 256000,
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
    defaultProviderOptions: alibabaDefaultProviderOptions(),
    defaultMaxOutputTokens: 65536,
    pricing: {
      inputPerToken: '0.0000012',
      outputPerToken: '0.000006',
      inputCacheReadPerToken: '0.00000024',
      inputTiers: [
        { cost: '0.0000012', min: 0, max: 32001 },
        { cost: '0.0000024', min: 32001, max: 128001 },
        { cost: '0.000003', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.000006', min: 0, max: 32001 },
        { cost: '0.000012', min: 32001, max: 128001 },
        { cost: '0.000015', min: 128001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.00000024', min: 0, max: 32001 },
        { cost: '0.00000048', min: 32001, max: 128001 },
        { cost: '0.0000006', min: 128001 },
      ],
    },
  },
  {
    id: 'alibaba/qwen-3-235b',
    providerId: 'alibaba',
    name: 'Qwen3-235B-A22B',
    description:
      'Qwen3-235B-A22B-Instruct-2507: updated non-thinking mode with improvements in instruction following, logical reasoning, text comprehension, mathematics, science, coding and tool usage.',
    contextWindow: 40960,
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
    defaultProviderOptions: alibabaDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.000000071',
      outputPerToken: '0.000000463',
    },
  },
  {
    id: 'alibaba/qwen3-next-80b-a3b-instruct',
    providerId: 'alibaba',
    name: 'Qwen3 Next 80B A3B Instruct',
    description:
      'New generation open-source non-thinking model powered by Qwen3. Superior Chinese text understanding, logical reasoning, and text generation over Qwen3-235B-A22B-Instruct-2507.',
    contextWindow: 262144,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: false,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: false,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: alibabaDefaultProviderOptions(),
    defaultMaxOutputTokens: 32768,
    pricing: {
      inputPerToken: '0.00000009',
      outputPerToken: '0.0000011',
    },
  },
  {
    id: 'alibaba/qwen3-next-80b-a3b-thinking',
    providerId: 'alibaba',
    name: 'Qwen3 Next 80B A3B Thinking',
    description:
      'Qwen3-Next highly sparse MoE (80B total, ~3B active). Excels at complex reasoning, outperforming higher-cost thinking models and approaching Qwen3-235B-A22B-Thinking-2507.',
    contextWindow: 65536,
    zeroDataRetention: false,
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
    defaultProviderOptions: alibabaDefaultProviderOptions(),
    defaultMaxOutputTokens: 65536,
    pricing: {
      inputPerToken: '0.00000015',
      outputPerToken: '0.0000015',
    },
  },
]
