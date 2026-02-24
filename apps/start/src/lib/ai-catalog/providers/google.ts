import type { GoogleLanguageModelOptions } from '@ai-sdk/google'
import type { AiModelCatalogEntry } from '../types'

/**
 * Shared base options for Google Generative AI (Gemini) calls. Keeps provider
 */
function googleBaseOptions(): GoogleLanguageModelOptions {
  return {} satisfies GoogleLanguageModelOptions
}

/**
 * Builds Google provider options for reasoning with thinking enabled.
 * includeThoughts: true so reasoning is emitted; thinkingBudget controls token count.
 */
function googleReasoningOptions(thinkingBudget: number): Record<string, unknown> {
  return {
    google: {
      ...googleBaseOptions(),
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget,
      } satisfies NonNullable<
        GoogleLanguageModelOptions['thinkingConfig']
      >,
    } satisfies GoogleLanguageModelOptions,
  }
}

/**
 * Default provider options for models that do not use per-effort options.
 */
function googleDefaultProviderOptions(): Record<string, unknown> {
  return { google: googleBaseOptions() }
}

/**
 * Google (Gemini) model catalog. Model IDs, context windows, max tokens,
 * capabilities, and provider-specific options (thinkingConfig with
 * thinkingBudget, includeThoughts).
 */
export const GOOGLE_MODELS: readonly AiModelCatalogEntry<'google'>[] = [
  {
    id: 'google/gemini-2.5-flash',
    providerId: 'google',
    name: 'Gemini 2.5 Flash',
    description:
      'Gemini 2.5 Flash is a thinking model that offers great, well-rounded capabilities. It is designed to offer a balance between price and performance with multimodal support and a 1M token context window.',
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      low: googleReasoningOptions(2048),
      medium: googleReasoningOptions(8192),
      high: googleReasoningOptions(16384),
    },
    defaultProviderOptions: googleDefaultProviderOptions(),
    defaultMaxOutputTokens: 65536,
    pricing: {
      inputPerToken: '0.0000003',
      outputPerToken: '0.0000025',
    },
  },
  {
    id: 'google/gemini-2.5-pro',
    providerId: 'google',
    name: 'Gemini 2.5 Pro',
    description:
      'Gemini 2.5 Pro is our most advanced reasoning Gemini model, capable of solving complex problems. Gemini 2.5 Pro can comprehend vast datasets and challenging problems from different information sources, including text, audio, images, video, and even entire code repositories.',
    contextWindow: 1048576,
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: googleReasoningOptions(4096),
      medium: googleReasoningOptions(12288),
      high: googleReasoningOptions(24576),
    },
    defaultProviderOptions: googleDefaultProviderOptions(),
    defaultMaxOutputTokens: 65536,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
    },
  },
  {
    id: 'google/gemini-3-flash',
    providerId: 'google',
    name: 'Gemini 3 Flash',
    description:
      "Google's most intelligent model built for speed, combining frontier intelligence with superior search and grounding.",
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      low: googleReasoningOptions(4096),
      medium: googleReasoningOptions(8192),
      high: googleReasoningOptions(16384),
    },
    defaultProviderOptions: googleDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.0000005',
      outputPerToken: '0.000003',
      inputCacheReadPerToken: '0.00000005',
      webSearchPerRequest: '14',
      inputTiers: [
        { cost: '0.0000005', min: 0, max: 200001 },
        { cost: '0.0000005', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.000003', min: 0, max: 200001 },
        { cost: '0.000003', min: 200001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.00000005', min: 0, max: 200001 },
        { cost: '0.00000005', min: 200001 },
      ],
    },
  },
  {
    id: 'google/gemini-3-pro-preview',
    providerId: 'google',
    name: 'Gemini 3 Pro',
    description:
      'This model improves upon Gemini 2.5 Pro and is catered towards challenging tasks, especially those involving complex reasoning or agentic workflows. Improvements highlighted include use cases for coding, multi-step function calling, planning, reasoning, deep knowledge tasks, and instruction following.',
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: googleReasoningOptions(4096),
      medium: googleReasoningOptions(12288),
      high: googleReasoningOptions(24576),
    },
    defaultProviderOptions: googleDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.000012',
      inputCacheReadPerToken: '0.0000002',
      webSearchPerRequest: '14',
      inputTiers: [
        { cost: '0.000002', min: 0, max: 200001 },
        { cost: '0.000004', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.000012', min: 0, max: 200001 },
        { cost: '0.000018', min: 200001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000002', min: 0, max: 200001 },
        { cost: '0.0000004', min: 200001 },
      ],
    },
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    providerId: 'google',
    name: 'Gemini 3.1 Pro',
    description:
      'Improved SWE and agentic capabilities, improved token efficiency and thinking, and expanded thinking levels.',
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: googleReasoningOptions(4096),
      medium: googleReasoningOptions(12288),
      high: googleReasoningOptions(24576),
    },
    defaultProviderOptions: googleDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.000012',
      inputCacheReadPerToken: '0.0000002',
      webSearchPerRequest: '14',
      inputTiers: [
        { cost: '0.000002', min: 0, max: 200001 },
        { cost: '0.000004', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.000012', min: 0, max: 200001 },
        { cost: '0.000018', min: 200001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000002', min: 0, max: 200001 },
        { cost: '0.0000004', min: 200001 },
      ],
    },
  },
]
