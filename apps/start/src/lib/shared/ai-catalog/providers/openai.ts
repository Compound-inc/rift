import type { OpenAILanguageModelResponsesOptions } from '@ai-sdk/openai'
import type { AiModelCatalogEntry } from '../types'

/**
 * Shared base options for all OpenAI Responses API calls.
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
 * Default provider options for models that do not use per-effort options.
 */
function openaiDefaultProviderOptions(): Record<string, unknown> {
  return { openai: openaiBaseOptions() }
}

/**
 * OpenAI model catalog.
 */
export const OPENAI_MODELS: readonly AiModelCatalogEntry<'openai'>[] = [
  // Chat models verified against https://ai-gateway.vercel.sh/v1/models on 2026-10-16.
  {
    id: 'openai/gpt-6.1-sol',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-6.1 Sol',
    description:
      "GPT-6.1 Sol is OpenAI's reasoning model for complex coding, computer use, and professional work. It accepts text and images, generates text, and supports a 1,050,000-token context window with up to 128,000 output tokens. Configurable reasoning effort, structured outputs, prompt caching, and Responses API tools support multi-step workflows.",
    contextWindow: 1050000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    defaultMaxOutputTokens: 128000,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
      xhigh: {
        openai: {
          store: false,
          reasoningEffort: 'xhigh',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.0000001',
      inputCacheWritePerToken: '0.0000025',
      inputTiers: [
        {
          cost: '0.000002',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000004',
          min: 272001,
        },
      ],
      outputTiers: [
        {
          cost: '0.00001',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000015',
          min: 272001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000001',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.0000002',
          min: 272001,
        },
      ],
      inputCacheWriteTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000005',
          min: 272001,
        },
      ],
    },
  },
  {
    id: 'openai/gpt-6-luna',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-6 Luna',
    description:
      "GPT-6 Luna is OpenAI's efficient reasoning model for focused, high-volume tasks. It accepts text and images, generates text, and supports a 1,050,000-token context window with up to 128,000 output tokens. Configurable reasoning effort, structured outputs, prompt caching, and Responses API tools support cost-sensitive applications, coding tasks, and automated workflows.",
    contextWindow: 1050000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultMaxOutputTokens: 128000,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
      xhigh: {
        openai: {
          store: false,
          reasoningEffort: 'xhigh',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.0000001',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000001',
      inputCacheWritePerToken: '0.000000125',
      inputTiers: [
        {
          cost: '0.0000001',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.0000002',
          min: 272001,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000005',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.00000075',
          min: 272001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.00000001',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.00000002',
          min: 272001,
        },
      ],
      inputCacheWriteTiers: [
        {
          cost: '0.000000125',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.00000025',
          min: 272001,
        },
      ],
    },
  },
  {
    id: 'openai/gpt-6-sol',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-6 Sol',
    description:
      "GPT-6 Sol is OpenAI's reasoning model for complex coding and agentic workflows. It accepts text and images, generates text, and supports a 1,050,000-token context window with up to 128,000 output tokens. Configurable reasoning effort, structured outputs, prompt caching, and Responses API tools make it suited to software development and multi-step automation.",
    contextWindow: 1050000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultMaxOutputTokens: 128000,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
      xhigh: {
        openai: {
          store: false,
          reasoningEffort: 'xhigh',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.0000002',
      inputCacheWritePerToken: '0.0000025',
      inputTiers: [
        {
          cost: '0.000002',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000004',
          min: 272001,
        },
      ],
      outputTiers: [
        {
          cost: '0.00001',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000015',
          min: 272001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.0000004',
          min: 272001,
        },
      ],
      inputCacheWriteTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000005',
          min: 272001,
        },
      ],
    },
  },
  {
    id: 'openai/gpt-6-astra',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-6 Astra',
    description:
      "GPT-6 Astra is OpenAI's most capable model for complex reasoning, coding, computer use, research, and document creation.",
    contextWindow: 1050000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    defaultMaxOutputTokens: 128000,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
      xhigh: {
        openai: {
          store: false,
          reasoningEffort: 'xhigh',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00001',
      outputPerToken: '0.00005',
      inputCacheReadPerToken: '0.000001',
      inputCacheWritePerToken: '0.0000125',
      inputTiers: [
        {
          cost: '0.00001',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.00002',
          min: 272001,
        },
      ],
      outputTiers: [
        {
          cost: '0.00005',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000075',
          min: 272001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.000001',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000002',
          min: 272001,
        },
      ],
      inputCacheWriteTiers: [
        {
          cost: '0.0000125',
          min: 0,
          max: 272001,
        },
        {
          cost: '0.000025',
          min: 272001,
        },
      ],
    },
  },
  {
    id: 'openai/gpt-5.6-luna',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT 5.6 Luna',
    description:
      'GPT-5.6 Luna is a fast, affordable GPT-5.6 model that brings strong capability at the lowest cost in the series.',
    contextWindow: 1050000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
      xhigh: {
        openai: {
          store: false,
          reasoningEffort: 'xhigh',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000012',
      inputCacheReadPerToken: '0.00000002',
      inputCacheWritePerToken: '0.00000025',
      inputTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.0000004',
          min: 272000,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000012',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.0000018',
          min: 272000,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.00000002',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.00000004',
          min: 272000,
        },
      ],
      inputCacheWriteTiers: [
        {
          cost: '0.00000025',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.0000005',
          min: 272000,
        },
      ],
    },
  },
  {
    id: 'openai/gpt-5.6-sol',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT 5.6 Sol',
    description:
      "GPT-5.6 Sol is the flagship of OpenAI's GPT-5.6 series, its most capable model for long-horizon agentic work across coding, biology, and cybersecurity.",
    contextWindow: 1050000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      minimal: {
        openai: {
          store: false,
          reasoningEffort: 'minimal',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
      xhigh: {
        openai: {
          store: false,
          reasoningEffort: 'xhigh',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000004',
      outputPerToken: '0.00002',
      inputCacheReadPerToken: '0.0000004',
      inputCacheWritePerToken: '0.000005',
      inputTiers: [
        {
          cost: '0.000004',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.000008',
          min: 272000,
        },
      ],
      outputTiers: [
        {
          cost: '0.00002',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.00003',
          min: 272000,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000004',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.0000008',
          min: 272000,
        },
      ],
      inputCacheWriteTiers: [
        {
          cost: '0.000005',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.00001',
          min: 272000,
        },
      ],
    },
  },
  {
    id: 'openai/gpt-5.6-terra',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT 5.6 Terra',
    description:
      'GPT-5.6 Terra is a balanced GPT-5.6 model for everyday work, with performance comparable to the previous generation at half the cost.',
    contextWindow: 1050000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      minimal: {
        openai: {
          store: false,
          reasoningEffort: 'minimal',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
      xhigh: {
        openai: {
          store: false,
          reasoningEffort: 'xhigh',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.000012',
      inputCacheReadPerToken: '0.0000002',
      inputCacheWritePerToken: '0.0000025',
      inputTiers: [
        {
          cost: '0.000002',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.000004',
          min: 272000,
        },
      ],
      outputTiers: [
        {
          cost: '0.000012',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.000018',
          min: 272000,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.0000004',
          min: 272000,
        },
      ],
      inputCacheWriteTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 272000,
        },
        {
          cost: '0.000005',
          min: 272000,
        },
      ],
    },
  },
  {
    id: 'openai/gpt-5.2',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT 5.2',
    description:
      "GPT-5.2 is OpenAI's best general-purpose model, part of the GPT-5 flagship model family. It's their most intelligent model yet for both general and agentic tasks.",
    contextWindow: 400000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      minimal: {
        openai: {
          store: false,
          reasoningEffort: 'minimal',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
      xhigh: {
        openai: {
          store: false,
          reasoningEffort: 'xhigh',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00000175',
      outputPerToken: '0.000014',
      inputCacheReadPerToken: '0.000000175',
    },
  },
  {
    id: 'openai/gpt-5.1-codex-max',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT 5.1 Codex Max',
    description: 'GPT‑5.1-Codex-Max is purpose-built for agentic coding.',
    contextWindow: 400000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.000000125',
    },
  },
  {
    id: 'openai/gpt-5.1-codex',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-5.1-Codex',
    description:
      'GPT-5.1-Codex is a version of GPT-5.1 optimized for agentic coding tasks in Codex or similar environments.',
    contextWindow: 400000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.00000013',
    },
  },
  {
    id: 'openai/gpt-5.1-codex-mini',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT 5.1 Codex Mini',
    description:
      'GPT-5.1 Codex mini is a smaller, faster, and cheaper version of GPT-5.1 Codex.',
    contextWindow: 400000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: {
        openai: {
          store: false,
          reasoningEffort: 'none',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00000025',
      outputPerToken: '0.000002',
      inputCacheReadPerToken: '0.00000003',
    },
  },
  {
    id: 'openai/gpt-5-codex',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-5-Codex',
    description:
      'GPT-5-Codex is a version of GPT-5 optimized for agentic coding tasks in Codex or similar environments.',
    contextWindow: 400000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.00000013',
    },
  },
  {
    id: 'openai/gpt-5',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-5',
    description:
      "GPT-5 is OpenAI's flagship language model that excels at complex reasoning, broad real-world knowledge, code-intensive, and multi-step agentic tasks.",
    contextWindow: 400000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      minimal: {
        openai: {
          store: false,
          reasoningEffort: 'minimal',
          reasoningSummary: 'auto',
        },
      },
      low: {
        openai: {
          store: false,
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
      medium: {
        openai: {
          store: false,
          reasoningEffort: 'medium',
          reasoningSummary: 'auto',
        },
      },
      high: {
        openai: {
          store: false,
          reasoningEffort: 'high',
          reasoningSummary: 'auto',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.000000125',
    },
  },
  {
    id: 'openai/gpt-4.1-mini',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-4.1 mini',
    description:
      'GPT 4.1 mini provides a balance between intelligence, speed, and cost that makes it an attractive model for many use cases.',
    contextWindow: 1047576,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 32768,
    legacy: true,
    pricing: {
      inputPerToken: '0.0000004',
      outputPerToken: '0.0000016',
      inputCacheReadPerToken: '0.0000001',
    },
  },
  {
    id: 'openai/gpt-4.1-nano',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-4.1 nano',
    description:
      'GPT-4.1 nano is the fastest, most cost-effective GPT 4.1 model.',
    contextWindow: 1047576,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 32768,
    legacy: true,
    pricing: {
      inputPerToken: '0.0000001',
      outputPerToken: '0.0000004',
      inputCacheReadPerToken: '0.000000025',
    },
  },
  {
    id: 'openai/gpt-4o-mini',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-4o mini',
    description:
      'GPT-4o mini from OpenAI is their most advanced and cost-efficient small model. It is multi-modal (accepting text or image inputs and outputting text) and has higher intelligence than gpt-3.5-turbo but is just as fast.',
    contextWindow: 128000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 16384,
    legacy: true,
    pricing: {
      inputPerToken: '0.00000015',
      outputPerToken: '0.0000006',
      inputCacheReadPerToken: '0.000000075',
    },
  },
  {
    id: 'openai/gpt-4o',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-4o',
    description:
      'GPT-4o from OpenAI has broad general knowledge and domain expertise allowing it to follow complex instructions in natural language and solve difficult problems accurately. It matches GPT-4 Turbo performance with a faster and cheaper API.',
    contextWindow: 128000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search'],
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 16384,
    legacy: true,
    pricing: {
      inputPerToken: '0.0000025',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.00000125',
    },
  },
  {
    id: 'openai/gpt-4-turbo',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-4 Turbo',
    description:
      'gpt-4-turbo from OpenAI has broad general knowledge and domain expertise allowing it to follow complex instructions in natural language and solve difficult problems accurately. It has a knowledge cutoff of April 2023 and a 128,000 token context window.',
    contextWindow: 128000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 4096,
    legacy: true,
    pricing: {
      inputPerToken: '0.00001',
      outputPerToken: '0.00003',
    },
  },
  {
    id: 'openai/gpt-3.5-turbo',
    providerId: 'openai',
    providers: ['gateway'],
    name: 'GPT-3.5 Turbo',
    description:
      "OpenAI's most capable and cost effective model in the GPT-3.5 family optimized for chat purposes, but also works well for traditional completions tasks.",
    contextWindow: 16385,
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
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultMaxOutputTokens: 4096,
    legacy: true,
    pricing: {
      inputPerToken: '0.0000005',
      outputPerToken: '0.0000015',
    },
  },

  {
    id: 'openai/gpt-5.5',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'gateway'],
    name: 'GPT-5.5',
    description:
      "GPT‑5.5 understands what you're trying to do faster and can carry more of the work itself. It excels at writing and debugging code, researching online, analyzing data, and moving across tools until a task is finished.",
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
    providerToolIds: ['web_search', 'code_interpreter'],
    reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'none',
    providerOptionsByReasoning: {
      none: openaiReasoningOptions('none'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
      xhigh: openaiReasoningOptions('xhigh'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.000005',
      outputPerToken: '0.00003',
      inputCacheReadPerToken: '0.0000005',
      webSearchPerRequest: '10',
      inputTiers: [
        { cost: '0.000005', min: 0, max: 272001 },
        { cost: '0.00001', min: 272000 },
      ],
      outputTiers: [
        { cost: '0.00003', min: 0, max: 272001 },
        { cost: '0.000045', min: 272000 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000005', min: 0, max: 272001 },
        { cost: '0.000001', min: 272000 },
      ],
    },
  },
  {
    id: 'openai/gpt-5.4-mini',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'gateway'],
    name: 'GPT-5.4 Mini',
    description:
      'GPT-5.4 Mini brings the strengths of GPT-5.4 to a faster, more efficient model designed for high-volume workloads.',
    contextWindow: 400000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search', 'code_interpreter'],
    reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      none: openaiReasoningOptions('none'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
      xhigh: openaiReasoningOptions('xhigh'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.00000075',
      outputPerToken: '0.0000045',
      inputCacheReadPerToken: '0.000000075',
    },
  },
  {
    id: 'openai/gpt-5.4-nano',
    providerId: 'openai',
    providers: ['openai', 'gateway'],
    name: 'GPT-5.4 Nano',
    description:
      'GPT-5.4 Nano is designed for tasks where speed and cost matter most like classification, data extraction, ranking, and sub-agents.',
    contextWindow: 400000,
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
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
      none: openaiReasoningOptions('none'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.00000125',
      inputCacheReadPerToken: '0.00000002',
    },
  },
  {
    id: 'openai/gpt-5.4',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'gateway'],
    name: 'GPT-5.4',
    description:
      "GPT-5.4 is OpenAI's best general-purpose model, part of the GPT-5 flagship model family. It's their most intelligent model yet for both general and agentic tasks.",
    contextWindow: 200000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search', 'code_interpreter'],
    reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'none',
    providerOptionsByReasoning: {
      none: openaiReasoningOptions('none'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
      xhigh: openaiReasoningOptions('xhigh'),
    },
    defaultProviderOptions: openaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.0000025',
      outputPerToken: '0.000015',
      inputCacheReadPerToken: '0.00000025',
      webSearchPerRequest: '10',
      inputTiers: [
        { cost: '0.0000025', min: 0, max: 272001 },
        { cost: '0.000005', min: 272000 },
      ],
      outputTiers: [
        { cost: '0.000015', min: 0, max: 272001 },
        { cost: '0.0000225', min: 272000 },
      ],
      inputCacheReadTiers: [
        { cost: '0.00000025', min: 0, max: 272001 },
        { cost: '0.0000005', min: 272000 },
      ],
    },
  },
  {
    id: 'openai/gpt-5.3-codex',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT-5.3-Codex',
    description:
      'GPT-5.3-Codex advances both the frontier coding performance of GPT‑5.2-Codex and the reasoning and professional knowledge capabilities of GPT‑5.2, together in one model, which is also 25% faster. This enables it to take on long-running tasks that involve research, tool use, and complex execution.',
    contextWindow: 400000,
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
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
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
  {
    id: 'openai/gpt-5.2-codex',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT-5.2-Codex',
    description:
      'GPT‑5.2-Codex is a version of GPT‑5.2⁠ further optimized for agentic coding in Codex, including improvements on long-horizon work through context compaction, stronger performance on large code changes like refactors and migrations, improved performance in Windows environments, and significantly stronger cybersecurity capabilities.',
    contextWindow: 400000,
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
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
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
  {
    id: 'openai/gpt-5.2-chat',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT-5.2',
    description:
      "The model powering ChatGPT is gpt-5.2-chat-latest: this is OpenAI's best general-purpose model, part of the GPT-5 flagship model family.",
    contextWindow: 128000,
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
    reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      none: openaiReasoningOptions('none'),
      low: openaiReasoningOptions('low'),
      medium: openaiReasoningOptions('medium'),
      high: openaiReasoningOptions('high'),
      xhigh: openaiReasoningOptions('xhigh'),
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
    id: 'openai/gpt-5.1-instant',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT-5.1 Instant',
    description:
      'GPT-5.1 Instant (or GPT-5.1 chat) is a warmer and more conversational version of GPT-5-chat, with improved instruction following and adaptive reasoning for deciding when to think before responding.',
    contextWindow: 128000,
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
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT 5.1 Thinking',
    description:
      'An upgraded version of GPT-5 that adapts thinking time more precisely to the question to spend more time on complex questions and respond more quickly to simpler tasks.',
    contextWindow: 400000,
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
  {
    id: 'openai/gpt-5-chat',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT-5',
    description:
      'GPT-5 Chat points to the GPT-5 snapshot currently used in ChatGPT.',
    contextWindow: 128000,
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
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT-5 mini',
    description:
      'GPT-5 mini is a cost optimized model that excels at reasoning/chat tasks. It offers an optimal balance between speed, cost, and capability.',
    contextWindow: 400000,
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
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT-5 nano',
    description:
      'GPT-5 nano is a high throughput model that excels at simple instruction or classification tasks.',
    contextWindow: 400000,
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
  {
    id: 'openai/gpt-oss-120b',
    providerId: 'openai',
    providers: ['azure', 'gateway'],
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
    providers: ['azure', 'gateway', 'openrouter'],
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
  {
    id: 'openai/o4-mini',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'o4-mini',
    description:
      "OpenAI's o4-mini delivers fast, cost-efficient reasoning with exceptional performance for its size, particularly excelling in math (best-performing on AIME benchmarks), coding, and visual tasks.",
    contextWindow: 200000,
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
  {
    id: 'openai/o3',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'o3',
    description:
      "OpenAI's o3 is their most powerful reasoning model, setting new state-of-the-art benchmarks in coding, math, science, and visual perception. It excels at complex queries requiring multi-faceted analysis, with particular strength in analyzing images, charts, and graphics.",
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
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
    id: 'openai/gpt-4.1',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'GPT-4.1',
    description:
      "GPT 4.1 is OpenAI's flagship model for complex tasks. It is well suited for problem solving across domains.",
    contextWindow: 1047576,
    zeroDataRetention: true,
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
  {
    id: 'openai/o3-mini',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'o3-mini',
    description:
      "o3-mini is OpenAI's most recent small reasoning model, providing high intelligence at the same cost and latency targets of o1-mini.",
    contextWindow: 200000,
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
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'low',
    providerOptionsByReasoning: {
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
  {
    id: 'openai/o1',
    legacy: true,
    providerId: 'openai',
    providers: ['openai', 'azure', 'gateway'],
    name: 'o1',
    description:
      "o1 is OpenAI's flagship reasoning model, designed for complex problems that require deep thinking. It provides strong reasoning capabilities with improved accuracy for complex multi-step tasks.",
    contextWindow: 200000,
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
]
