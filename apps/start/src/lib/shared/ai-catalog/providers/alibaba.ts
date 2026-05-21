import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for Alibaba (Qwen) models.
 */
function alibabaDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

function alibabaReasoningOptions(
  thinkingBudget: number,
): Record<string, unknown> {
  return {
    alibaba: {
      enableThinking: true,
      thinkingBudget,
    },
  }
}

export const ALIBABA_MODELS: readonly AiModelCatalogEntry<'alibaba'>[] = [
  {
    id: 'alibaba/qwen-3.6-max-preview',
    providerId: 'alibaba',
    providers: ['gateway'],
    name: 'Qwen 3.6 Max Preview',
    description:
      'Compared with Qwen3-Max and Qwen3.6-Plus, this model features enhanced vibe coding abilities, more efficient coding agent execution, and significantly improved front-end development. Long-tail knowledge retention has also been upgraded.',
    contextWindow: 240000,
    zeroDataRetention: false,
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
      low: alibabaReasoningOptions(2048),
      medium: alibabaReasoningOptions(8192),
      high: alibabaReasoningOptions(16384),
    },
    defaultProviderOptions: alibabaReasoningOptions(8192),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.0000013',
      outputPerToken: '0.0000078',
      inputCacheReadPerToken: '0.00000026',
      inputCacheWritePerToken: '0.000001625',
      inputTiers: [
        { cost: '0.0000013', min: 0, max: 128001 },
        { cost: '0.000002', min: 128000 },
      ],
      outputTiers: [
        { cost: '0.0000078', min: 0, max: 128001 },
        { cost: '0.000012', min: 128000 },
      ],
      inputCacheReadTiers: [
        { cost: '0.00000026', min: 0, max: 128001 },
        { cost: '0.0000002', min: 128000 },
      ],
      inputCacheWriteTiers: [
        { cost: '0.000001625', min: 0, max: 128001 },
        { cost: '0.0000025', min: 128000 },
      ],
    },
  },
  {
    id: 'alibaba/qwen3.6-plus',
    providerId: 'alibaba',
    providers: ['gateway'],
    name: 'Qwen 3.6 Plus',
    description:
      'The Qwen3.6 native vision-language Plus series models demonstrate exceptional performance on par with the current state-of-the-art models, with a significant improvement in overall results compared to the 3.5 series. The models have been markedly enhanced in code-related capabilities such as agentic coding, front-end programming, and Vibe coding, as well as in multi-modal general object recognition, OCR, and object localization.',
    contextWindow: 1000000,
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
    defaultProviderOptions: alibabaDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.0000005',
      outputPerToken: '0.000003',
      inputCacheReadPerToken: '0.0000001',
    },
  },
  {
    id: 'alibaba/qwen3.5-plus',
    providerId: 'alibaba',
    providers: ['gateway'],
    name: 'Qwen 3.5 Plus',
    description:
      'The Qwen3.5 native vision-language series Plus models are built on a hybrid architecture that integrates linear attention mechanisms with sparse mixture-of-experts models, achieving higher inference efficiency. In a variety of task evaluations, the 3.5 series consistently demonstrates performance on par with state-of-the-art leading models. Compared to the 3 series, these models show a leap forward in both pure-text and multimodal capabilities.',
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
    reasoningEfforts: [],
    defaultProviderOptions: alibabaDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.0000004',
      outputPerToken: '0.0000024',
      inputCacheReadPerToken: '0.00000004',
      inputCacheWritePerToken: '0.0000005',
      inputTiers: [
        { cost: '0.0000004', min: 0, max: 256001 },
        { cost: '0.0000012', min: 256001 },
      ],
      outputTiers: [
        { cost: '0.0000024', min: 0, max: 256001 },
        { cost: '0.0000072', min: 256001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.00000004', min: 0, max: 256001 },
        { cost: '0.00000012', min: 256001 },
      ],
      inputCacheWriteTiers: [
        { cost: '0.0000005', min: 0, max: 256001 },
        { cost: '0.0000015', min: 256001 },
      ],
    },
  },
  {
    id: 'alibaba/qwen3-max-thinking',
    providerId: 'alibaba',
    providers: ['gateway'],
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: alibabaReasoningOptions(2048),
      medium: alibabaReasoningOptions(8192),
      high: alibabaReasoningOptions(16384),
    },
    defaultProviderOptions: alibabaReasoningOptions(8192),
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
    id: 'alibaba/qwen3-max',
    providerId: 'alibaba',
    providers: ['gateway'],
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
    id: 'alibaba/qwen3-next-80b-a3b-thinking',
    providerId: 'alibaba',
    providers: ['gateway'],
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: alibabaReasoningOptions(2048),
      medium: alibabaReasoningOptions(8192),
      high: alibabaReasoningOptions(16384),
    },
    defaultProviderOptions: alibabaReasoningOptions(8192),
    defaultMaxOutputTokens: 65536,
    pricing: {
      inputPerToken: '0.00000015',
      outputPerToken: '0.0000015',
    },
  },
  {
    id: 'alibaba/qwen3-next-80b-a3b-instruct',
    providerId: 'alibaba',
    providers: ['gateway'],
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
    id: 'alibaba/qwen-3-235b',
    providerId: 'alibaba',
    providers: ['gateway'],
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
]
