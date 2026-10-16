import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for Xiaomi models.
 */
function xiaomiDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

export const XIAOMI_MODELS: readonly AiModelCatalogEntry<'xiaomi'>[] = [
  // Chat models verified against https://ai-gateway.vercel.sh/v1/models on 2026-10-16.
  {
    id: 'xiaomi/mimo-v2.6-flash',
    providerId: 'xiaomi',
    providers: ['gateway'],
    name: 'MiMo V2.6 Flash',
    description:
      "MiMo V2.6 Flash is Xiaomi's efficient multimodal reasoning model for coding, automation, and everyday agent workflows. It accepts text, images, audio, and video within a 1M-token context window, with up to 128K tokens of output. Deep thinking, tool calling, JSON mode, and prompt caching make it suitable for applications that need multimodal understanding at a lower token cost.",
    contextWindow: 1048576,
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
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 131072,
    pricing: {
      inputPerToken: '0.00000014',
      outputPerToken: '0.00000028',
      inputCacheReadPerToken: '0.0000000028',
    },
  },
  {
    id: 'xiaomi/mimo-v2.6-pro',
    providerId: 'xiaomi',
    providers: ['gateway'],
    name: 'MiMo V2.6 Pro',
    description:
      "MiMo V2.6 Pro is Xiaomi's flagship multimodal reasoning model for complex software engineering, long-running agent tasks, and professional workflows. It supports text, image, audio, and video inputs with a 1M-token context window and up to 128K tokens of output. Deep thinking, tool calling, JSON mode, and prompt caching support applications that combine large inputs with multi-step reasoning.",
    contextWindow: 1048576,
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
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 131072,
    pricing: {
      inputPerToken: '0.000000435',
      outputPerToken: '0.00000087',
      inputCacheReadPerToken: '0.0000000036',
    },
  },

  {
    id: 'xiaomi/mimo-v2.5-pro',
    legacy: true,
    providerId: 'xiaomi',
    providers: ['gateway'],
    name: 'MiMo V2.5 Pro',
    description:
      'MiMo V2.5 Pro is a 1.02T-parameter Mixture-of-Experts model with 42B active parameters, built on a hybrid-attention architecture with a 1M-token context window. Improves on V2 Pro for general agentic capabilities, complex software engineering, and long-horizon tasks.',
    contextWindow: 1050000,
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
    defaultProviderOptions: xiaomiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.000001',
      outputPerToken: '0.000003',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        { cost: '0.000001', min: 0, max: 256001 },
        { cost: '0.000002', min: 256001 },
      ],
      outputTiers: [
        { cost: '0.000003', min: 0, max: 256001 },
        { cost: '0.000006', min: 256001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000002', min: 0, max: 256001 },
        { cost: '0.0000004', min: 256001 },
      ],
    },
  },
  {
    id: 'xiaomi/mimo-v2.5',
    legacy: true,
    providerId: 'xiaomi',
    providers: ['gateway'],
    name: 'MiMo V2.5',
    description:
      'A native full-modal model supporting text, image, video, and audio understanding, with powerful Agent capabilities.',
    contextWindow: 1050000,
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
    defaultProviderOptions: xiaomiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.0000004',
      outputPerToken: '0.000002',
      inputCacheReadPerToken: '0.00000008',
      inputTiers: [
        { cost: '0.0000004', min: 0, max: 256001 },
        { cost: '0.0000008', min: 256001 },
      ],
      outputTiers: [
        { cost: '0.000002', min: 0, max: 256001 },
        { cost: '0.000004', min: 256001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.00000008', min: 0, max: 256001 },
        { cost: '0.00000016', min: 256001 },
      ],
    },
  },
  {
    id: 'xiaomi/mimo-v2-pro',
    legacy: true,
    providerId: 'xiaomi',
    providers: ['gateway'],
    name: 'MiMo V2 Pro',
    description:
      'Xiaomi MiMo-V2-Pro is built for demanding real-world Agent workflows. It has over 1T total parameters, with 42B active parameters, uses an innovative hybrid attention architecture, and supports an ultra-long context window of up to 1M tokens.',
    contextWindow: 1000000,
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
    defaultProviderOptions: xiaomiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.000001',
      outputPerToken: '0.000003',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        { cost: '0.000001', min: 0, max: 256001 },
        { cost: '0.000002', min: 256001 },
      ],
      outputTiers: [
        { cost: '0.000003', min: 0, max: 256001 },
        { cost: '0.000006', min: 256001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000002', min: 0, max: 256001 },
        { cost: '0.0000004', min: 256001 },
      ],
    },
  },
]
