import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for GLM (Zhipu AI / zai) models.
 */
function zaiDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

/**
 * GLM (Zhipu AI) model catalog.
 */
export const ZAI_MODELS: readonly AiModelCatalogEntry<'zai'>[] = [
  {
    id: 'zai/glm-4.5',
    providerId: 'zai',
    name: 'GLM-4.5',
    description:
      'GLM-4.5 Series flagship: 355B total (32B active) parameters, unifying reasoning, coding, and agent capabilities. Hybrid reasoning with dual operational modes.',
    contextWindow: 131072,
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
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 131072,
    pricing: {
      inputPerToken: '0.0000006',
      outputPerToken: '0.0000022',
    },
  },
  {
    id: 'zai/glm-4.5-air',
    providerId: 'zai',
    name: 'GLM 4.5 Air',
    description:
      'Lighter flagship: 106B total (12B active) MoE, for agent-oriented applications. Reasoning, tool-use, and implicit caching.',
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
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 96000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000011',
      inputCacheReadPerToken: '0.00000003',
    },
  },
  {
    id: 'zai/glm-4.5v',
    providerId: 'zai',
    name: 'GLM 4.5V',
    description:
      'Vision model built on GLM-4.5-Air base; 106B MoE. Inherits GLM-4.1V-Thinking techniques for visual understanding.',
    contextWindow: 65536,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: [],
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 16384,
    pricing: {
      inputPerToken: '0.0000006',
      outputPerToken: '0.0000018',
    },
  },
  {
    id: 'zai/glm-4.6',
    providerId: 'zai',
    name: 'GLM 4.6',
    description:
      'Latest GLM iteration: improvements in coding, long context, reasoning, search, writing, and agentic applications.',
    contextWindow: 200000,
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
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 96000,
    pricing: {
      inputPerToken: '0.00000045',
      outputPerToken: '0.0000018',
      inputCacheReadPerToken: '0.00000011',
    },
  },
  {
    id: 'zai/glm-4.6v',
    providerId: 'zai',
    name: 'GLM-4.6V',
    description:
      'Multimodal GLM-4.6V: 128k context, strong visual understanding. Vision, file-input, reasoning, tool-use.',
    contextWindow: 128000,
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
    reasoningEfforts: [],
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 24000,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000009',
      inputCacheReadPerToken: '0.00000005',
    },
  },
  {
    id: 'zai/glm-4.6v-flash',
    providerId: 'zai',
    name: 'GLM-4.6V-Flash',
    description:
      'Low-latency variant of GLM-4.6V for local deployment. Vision, reasoning, file-input, tool-use.',
    contextWindow: 128000,
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
    reasoningEfforts: [],
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 24000,
  },
  {
    id: 'zai/glm-4.7',
    providerId: 'zai',
    name: 'GLM 4.7',
    description:
      'Z.ai latest flagship: stronger coding and more stable multi-step reasoning and execution.',
    contextWindow: 202752,
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
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 120000,
    pricing: {
      inputPerToken: '0.00000043',
      outputPerToken: '0.00000175',
      inputCacheReadPerToken: '0.00000008',
    },
  },
  {
    id: 'zai/glm-4.7-flashx',
    providerId: 'zai',
    name: 'GLM 4.7 FlashX',
    description:
      'Lightweight deployment option: high performance with efficiency. Reasoning, tool-use, implicit caching.',
    contextWindow: 200000,
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
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.00000006',
      outputPerToken: '0.0000004',
      inputCacheReadPerToken: '0.00000001',
    },
  },
  {
    id: 'zai/glm-5',
    providerId: 'zai',
    name: 'GLM-5',
    description:
      'Zai next-gen flagship for Agentic Engineering: reliable productivity in complex system engineering and long-range agent tasks. SOTA coding and agent capabilities in open source.',
    contextWindow: 202800,
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
    defaultProviderOptions: zaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 131072,
    pricing: {
      inputPerToken: '0.000001',
      outputPerToken: '0.0000032',
      inputCacheReadPerToken: '0.0000002',
    },
  },
]
