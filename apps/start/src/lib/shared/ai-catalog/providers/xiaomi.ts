import type { AiModelCatalogEntry } from '../types'

/**
 * Default provider options for Xiaomi models.
 */
function xiaomiDefaultProviderOptions(): Record<string, unknown> {
  return {}
}

export const XIAOMI_MODELS: readonly AiModelCatalogEntry<'xiaomi'>[] = [
  {
    id: 'xiaomi/mimo-v2.5-pro',
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
