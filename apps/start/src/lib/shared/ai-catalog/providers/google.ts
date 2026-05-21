import type { GoogleLanguageModelOptions } from '@ai-sdk/google'
import type { AiModelCatalogEntry } from '../types'

/**
 * Shared base options for Google Generative AI (Gemini) calls.
 */
function googleBaseOptions(): GoogleLanguageModelOptions {
  return {} satisfies GoogleLanguageModelOptions
}

/**
 * Builds Google provider options for reasoning with thinking enabled.
 */
function googleReasoningOptionsByBudget(
  thinkingBudget: number,
): Record<string, unknown> {
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

function googleReasoningOptionsByLevel(
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high',
): Record<string, unknown> {
  return {
    google: {
      ...googleBaseOptions(),
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel,
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
 * Google (Gemini) model catalog.
 */
export const GOOGLE_MODELS: readonly AiModelCatalogEntry<'google'>[] = [
  {
    id: 'google/gemini-3.5-flash',
    providerId: 'google',
    providers: ['gateway'],
    name: 'Gemini 3.5 Flash',
    description:
      "Google's latest model, highly optimized for coding proficiency and parallel agentic execution loops. Defaults to medium thinking effort for faster and more cost-efficient responses.",
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      minimal: googleReasoningOptionsByLevel('minimal'),
      low: googleReasoningOptionsByLevel('low'),
      medium: googleReasoningOptionsByLevel('medium'),
      high: googleReasoningOptionsByLevel('high'),
    },
    defaultProviderOptions: googleDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.0000015',
      outputPerToken: '0.000009',
      inputCacheReadPerToken: '0.00000015',
      webSearchPerRequest: '14',
    },
  },
  {
    id: 'google/gemini-3.1-flash-lite',
    providerId: 'google',
    providers: ['gateway'],
    name: 'Gemini 3.1 Flash Lite',
    description:
      'Gemini 3.1 Flash Lite outperforms 2.5 Flash Lite on overall quality and lands close to 2.5 Flash performance. Workhorse model for high-volume use cases, with improvements across audio input/ASR, RAG snippet ranking, translation, data extraction, and code completion.',
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      minimal: googleReasoningOptionsByLevel('minimal'),
      low: googleReasoningOptionsByLevel('low'),
      medium: googleReasoningOptionsByLevel('medium'),
      high: googleReasoningOptionsByLevel('high'),
    },
    defaultProviderOptions: googleDefaultProviderOptions(),
    defaultMaxOutputTokens: 65000,
    pricing: {
      inputPerToken: '0.00000025',
      outputPerToken: '0.0000015',
      inputCacheReadPerToken: '0.00000003',
      webSearchPerRequest: '14',
    },
  },
  {
    id: 'google/gemini-3-flash',
    providerId: 'google',
    providers: ['gateway'],
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
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      minimal: googleReasoningOptionsByLevel('minimal'),
      low: googleReasoningOptionsByLevel('low'),
      medium: googleReasoningOptionsByLevel('medium'),
      high: googleReasoningOptionsByLevel('high'),
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
    id: 'google/gemini-3.1-pro-preview',
    providerId: 'google',
    providers: ['gateway'],
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
      low: googleReasoningOptionsByLevel('low'),
      medium: googleReasoningOptionsByLevel('medium'),
      high: googleReasoningOptionsByLevel('high'),
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
    id: 'google/gemini-3-pro-preview',
    providerId: 'google',
    providers: ['gateway'],
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
    reasoningEfforts: ['low', 'high'],
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      low: googleReasoningOptionsByLevel('low'),
      high: googleReasoningOptionsByLevel('high'),
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
    id: 'google/gemini-2.5-flash',
    providerId: 'google',
    providers: ['gateway'],
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
      low: googleReasoningOptionsByBudget(2048),
      medium: googleReasoningOptionsByBudget(8192),
      high: googleReasoningOptionsByBudget(16384),
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
    providers: ['gateway'],
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
      low: googleReasoningOptionsByBudget(4096),
      medium: googleReasoningOptionsByBudget(12288),
      high: googleReasoningOptionsByBudget(24576),
    },
    defaultProviderOptions: googleDefaultProviderOptions(),
    defaultMaxOutputTokens: 65536,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
    },
  },
]
