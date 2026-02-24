import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for MiniMax models. No provider-specific options
 * required for basic chat when using the AI Gateway.
 */
function minimaxDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

/**
 * MiniMax model catalog. Data aligned with Vercel AI Gateway /v1/models
 * (pricing, context_window, max_tokens, tags → capabilities).
 */
export const MINIMAX_MODELS: readonly AiModelCatalogEntry<'minimax'>[] = [
  {
    id: 'minimax/minimax-m2',
    providerId: 'minimax',
    name: 'MiniMax M2',
    description:
      'MiniMax-M2 redefines efficiency for agents. It is a compact, fast, and cost-effective MoE model (230 billion total parameters with 10 billion active parameters) built for elite performance in coding and agentic tasks, all while maintaining powerful general intelligence.',
    contextWindow: 205000,
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
    defaultProviderOptions: minimaxDefaultProviderOptions(),
    defaultMaxOutputTokens: 205000,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000012',
      inputCacheReadPerToken: '0.00000003',
      inputCacheWritePerToken: '0.000000375',
    },
  },
  {
    id: 'minimax/minimax-m2.1',
    providerId: 'minimax',
    name: 'MiniMax M2.1',
    description:
      "MiniMax 2.1 is MiniMax's latest model, optimized specifically for robustness in coding, tool use, instruction following, and long-horizon planning.",
    contextWindow: 204800,
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
    defaultProviderOptions: minimaxDefaultProviderOptions(),
    defaultMaxOutputTokens: 131072,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000012',
      inputCacheReadPerToken: '0.00000015',
    },
  },
  {
    id: 'minimax/minimax-m2.5',
    providerId: 'minimax',
    name: 'MiniMax M2.5',
    description:
      'MiniMax-M2.5 is a SOTA large language model designed for real-world productivity. It is capable of handling the entire development process of various complex systems. It covers full-stack projects across multiple platforms including Web, Android, iOS, Windows, and Mac, encompassing server-side APIs, functional logic, and databases.',
    contextWindow: 204800,
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
    defaultProviderOptions: minimaxDefaultProviderOptions(),
    defaultMaxOutputTokens: 131000,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000012',
      inputCacheReadPerToken: '0.00000003',
      inputCacheWritePerToken: '0.000000375',
    },
  },
]
