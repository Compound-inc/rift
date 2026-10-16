import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for MiniMax models.
 */
function minimaxDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

export const MINIMAX_MODELS: readonly AiModelCatalogEntry<'minimax'>[] = [
  // Chat models verified against https://ai-gateway.vercel.sh/v1/models on 2026-10-16.
  {
    id: 'minimax/minimax-m3',
    providerId: 'minimax',
    providers: ['gateway'],
    name: 'MiniMax M3',
    description:
      "MiniMax-M3 is a frontier-class foundation model that unites the three capabilities defining today's frontier: a 1M-token context window, frontier coding and agentic performance, and native multimodality — the first open-weight model to deliver all three in a single system.",
    contextWindow: 512000,
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
    defaultMaxOutputTokens: 512000,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000012',
      inputCacheReadPerToken: '0.00000006',
    },
  },

  {
    id: 'minimax/minimax-m2.7',
    legacy: true,
    providerId: 'minimax',
    providers: ['gateway'],
    name: 'Minimax M2.7',
    description:
      'M2.7 delivers outstanding performance in real-world software engineering, including end-to-end full project delivery, log analysis and bug troubleshooting, code security, machine learning, and more.',
    contextWindow: 204800,
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
    defaultProviderOptions: minimaxDefaultProviderOptions(),
    defaultMaxOutputTokens: 131000,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000012',
      inputCacheReadPerToken: '0.00000006',
      inputCacheWritePerToken: '0.000000375',
    },
  },
  {
    id: 'minimax/minimax-m2.5',
    legacy: true,
    providerId: 'minimax',
    providers: ['gateway'],
    name: 'MiniMax M2.5',
    description:
      'MiniMax-M2.5 is a SOTA large language model designed for real-world productivity. It is capable of handling the entire development process of various complex systems. It covers full-stack projects across multiple platforms including Web, Android, iOS, Windows, and Mac, encompassing server-side APIs, functional logic, and databases.',
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
    defaultMaxOutputTokens: 131000,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000012',
      inputCacheReadPerToken: '0.00000003',
      inputCacheWritePerToken: '0.000000375',
    },
  },
  {
    id: 'minimax/minimax-m2.1',
    legacy: true,
    providerId: 'minimax',
    providers: ['gateway'],
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
    id: 'minimax/minimax-m2',
    legacy: true,
    providerId: 'minimax',
    providers: ['gateway'],
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
]
