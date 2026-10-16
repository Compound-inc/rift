import type { XaiLanguageModelResponsesOptions } from '@ai-sdk/xai'
import type { AiModelCatalogEntry } from '../types'

/**
 * Shared base options for xAI Responses API.
 */
function xaiBaseOptions(): XaiLanguageModelResponsesOptions {
  return { store: false } satisfies XaiLanguageModelResponsesOptions
}

/**
 * XAI default provider options.
 */
function xaiDefaultProviderOptions(): Record<string, unknown> {
  return { xai: xaiBaseOptions() }
}

export const XAI_MODELS: readonly AiModelCatalogEntry<'xai'>[] = [
  // Canonical Gateway IDs verified against the live catalog on 2026-10-16.
  {
    id: 'spacexai/grok-4.7',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.7',
    description:
      'Grok 4.7 is SpaceXAI’s advanced AI model for coding and professional knowledge work, built to tackle complex, multi-hour tasks with improved self-verification and long-context handling. It strengthens software engineering, document creation, and presentation workflows while maintaining Grok 4.6’s speed and pricing.',
    contextWindow: 500000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search', 'code_execution'],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
      xhigh: {
        xai: {
          store: false,
          reasoningEffort: 'xhigh',
        },
      },
    },
    defaultMaxOutputTokens: 500000,
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.000006',
      inputCacheReadPerToken: '0.0000005',
      inputTiers: [
        {
          cost: '0.000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000004',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.000006',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000012',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000005',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000001',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-4.6',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.6',
    description:
      'Grok 4.6 builds on Grok 4.5 with a particular focus on long-running agents and more ambitious interactive and visual work. It stays with complex tasks across many steps, whether researching a topic, analyzing information, working across a codebase, or turning an idea into a polished application or work artifact.',
    contextWindow: 500000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    legacy: true,
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
      xhigh: {
        xai: {
          store: false,
          reasoningEffort: 'xhigh',
        },
      },
    },
    defaultMaxOutputTokens: 500000,
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.000006',
      inputCacheReadPerToken: '0.0000005',
      inputTiers: [
        {
          cost: '0.000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000004',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.000006',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000012',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000005',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000001',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-4.5',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.5',
    description:
      "SpaceXAI's smartest model with frontier performance on coding, knowledge work, and STEM.",
    contextWindow: 500000,
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
    legacy: true,
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
    },
    defaultMaxOutputTokens: 500000,
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.000006',
      inputCacheReadPerToken: '0.0000003',
      inputTiers: [
        {
          cost: '0.000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000004',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.000006',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000012',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000003',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000006',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-build-0.1',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok Build 0.1',
    description:
      "xAI's fast coding model trained specifically for agentic coding.",
    contextWindow: 256000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: [],
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      none: {
        xai: {
          store: false,
          reasoningEffort: 'none',
        },
      },
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
    },
    defaultMaxOutputTokens: 256000,
    pricing: {
      inputPerToken: '0.000001',
      outputPerToken: '0.000002',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        {
          cost: '0.000001',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000002',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000004',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000004',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-4.20-multi-agent-beta',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.20 Multi Agent Beta',
    description:
      'Multiple agents collaborate in parallel to perform deep research tasks.',
    contextWindow: 2000000,
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
    legacy: true,
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      none: {
        xai: {
          store: false,
          reasoningEffort: 'none',
        },
      },
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
    },
    defaultMaxOutputTokens: 2000000,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.0000025',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        {
          cost: '0.00000125',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000025',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000005',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000004',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-4.20-non-reasoning-beta',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.20 Beta Non-Reasoning',
    description:
      'Grok 4.20 Beta is the newest flagship model from xAI with industry-leading speed and agentic tool calling capabilities. It combines the lowest hallucination rate on the market with strict prompt adherance, delivering consistently precise and truthful responses.',
    contextWindow: 2000000,
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
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    legacy: true,
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      none: {
        xai: {
          store: false,
          reasoningEffort: 'none',
        },
      },
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
    },
    defaultMaxOutputTokens: 2000000,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.0000025',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        {
          cost: '0.00000125',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000025',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000005',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000004',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-4.20-reasoning-beta',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.20 Beta Reasoning',
    description:
      'Grok 4.20 Beta is the newest flagship model from xAI with industry-leading speed and agentic tool calling capabilities. It combines the lowest hallucination rate on the market with strict prompt adherance, delivering consistently precise and truthful responses.',
    contextWindow: 2000000,
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
    legacy: true,
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      none: {
        xai: {
          store: false,
          reasoningEffort: 'none',
        },
      },
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
    },
    defaultMaxOutputTokens: 2000000,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.0000025',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        {
          cost: '0.00000125',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000025',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000005',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000004',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-4.20-multi-agent',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.20 Multi-Agent',
    description:
      'Multiple agents collaborate in parallel to perform deep research tasks.',
    contextWindow: 2000000,
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
    legacy: true,
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      none: {
        xai: {
          store: false,
          reasoningEffort: 'none',
        },
      },
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
    },
    defaultMaxOutputTokens: 2000000,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.0000025',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        {
          cost: '0.00000125',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000025',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000005',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000004',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-4.20-non-reasoning',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.20 Non-Reasoning',
    description:
      'Grok 4.20 Beta is the newest flagship model from xAI with industry-leading speed and agentic tool calling capabilities. It combines the lowest hallucination rate on the market with strict prompt adherence, delivering consistently precise and truthful responses.',
    contextWindow: 2000000,
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
    reasoningEfforts: ['none', 'low', 'medium', 'high'],
    legacy: true,
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      none: {
        xai: {
          store: false,
          reasoningEffort: 'none',
        },
      },
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
    },
    defaultMaxOutputTokens: 2000000,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.0000025',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        {
          cost: '0.00000125',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000025',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000005',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000004',
          min: 200001,
        },
      ],
    },
  },
  {
    id: 'spacexai/grok-4.20-reasoning',
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.20 Reasoning',
    description:
      'Grok 4.20 Beta is the newest flagship model from xAI with industry-leading speed and agentic tool calling capabilities. It combines the lowest hallucination rate on the market with strict prompt adherence, delivering consistently precise and truthful responses.',
    contextWindow: 2000000,
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
    legacy: true,
    defaultReasoningEffort: 'high',
    providerOptionsByReasoning: {
      none: {
        xai: {
          store: false,
          reasoningEffort: 'none',
        },
      },
      low: {
        xai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
      medium: {
        xai: {
          store: false,
          reasoningEffort: 'medium',
        },
      },
      high: {
        xai: {
          store: false,
          reasoningEffort: 'high',
        },
      },
    },
    defaultMaxOutputTokens: 2000000,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.0000025',
      inputCacheReadPerToken: '0.0000002',
      inputTiers: [
        {
          cost: '0.00000125',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000025',
          min: 200001,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000025',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.000005',
          min: 200001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.0000002',
          min: 0,
          max: 200001,
        },
        {
          cost: '0.0000004',
          min: 200001,
        },
      ],
    },
  },

  {
    id: 'xai/grok-4.3',
    legacy: true,
    providerModelIds: { gateway: 'spacexai/grok-4.3' },
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.3',
    description:
      'Grok 4.3 matches the scale of Grok 4.20 with an improved architecture and a December 2025 knowledge cutoff.',
    contextWindow: 1000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search', 'code_execution'],
    reasoningEfforts: [],
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.00000125',
      outputPerToken: '0.0000025',
      inputCacheReadPerToken: '0.0000002',
      webSearchPerRequest: '5',
      inputTiers: [
        { cost: '0.00000125', min: 0, max: 200001 },
        { cost: '0.0000025', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.0000025', min: 0, max: 200001 },
        { cost: '0.000005', min: 200001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000002', min: 0, max: 200001 },
        { cost: '0.0000004', min: 200001 },
      ],
    },
  },
  {
    id: 'xai/grok-4.1-fast-reasoning',
    providerModelIds: { gateway: 'spacexai/grok-4.1-fast-reasoning' },
    legacy: true,
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.1 Fast Reasoning',
    description:
      'Fast Grok 4.1 model with reasoning enabled and server-side tool support.',
    contextWindow: 2000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: false,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search', 'code_execution'],
    reasoningEfforts: [],
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 30000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000005',
      inputTiers: [
        { cost: '0.0000002', min: 0, max: 128001 },
        { cost: '0.0000004', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.0000005', min: 0, max: 128001 },
        { cost: '0.000001', min: 128001 },
      ],
    },
  },
  {
    id: 'xai/grok-4.1-fast-non-reasoning',
    providerModelIds: { gateway: 'spacexai/grok-4.1-fast-non-reasoning' },
    legacy: true,
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4.1 Fast Non-Reasoning',
    description: 'Fast Grok 4.1 model tuned for low-latency responses.',
    contextWindow: 2000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search'],
    reasoningEfforts: [],
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 30000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000005',
      inputTiers: [
        { cost: '0.0000002', min: 0, max: 128001 },
        { cost: '0.0000004', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.0000005', min: 0, max: 128001 },
        { cost: '0.000001', min: 128001 },
      ],
    },
  },
  {
    id: 'xai/grok-code-fast-1',
    legacy: true,
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok Code Fast 1',
    description:
      'Code-focused Grok model for engineering workflows with reasoning.',
    contextWindow: 256000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: false,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['code_execution', 'web_search'],
    reasoningEfforts: [],
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 256000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000015',
      inputCacheReadPerToken: '0.00000002',
    },
  },
  {
    id: 'xai/grok-4-fast-reasoning',
    legacy: true,
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4 Fast Reasoning',
    description:
      'Grok 4 fast variant with reasoning and tool support. Large context with implicit caching.',
    contextWindow: 2000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search', 'code_execution'],
    reasoningEfforts: [],
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 256000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000005',
      inputTiers: [
        { cost: '0.0000002', min: 0, max: 128001 },
        { cost: '0.0000004', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.0000005', min: 0, max: 128001 },
        { cost: '0.000001', min: 128001 },
      ],
    },
  },
  {
    id: 'xai/grok-4-fast-non-reasoning',
    legacy: true,
    providerId: 'xai',
    providers: ['gateway'],
    name: 'Grok 4 Fast Non-Reasoning',
    description:
      'Grok 4 fast variant tuned for low-latency responses without reasoning.',
    contextWindow: 2000000,
    zeroDataRetention: false,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: false,
    },
    providerToolIds: ['web_search', 'x_search'],
    reasoningEfforts: [],
    defaultProviderOptions: xaiDefaultProviderOptions(),
    defaultMaxOutputTokens: 256000,
    pricing: {
      inputPerToken: '0.0000002',
      outputPerToken: '0.0000005',
      inputCacheReadPerToken: '0.00000005',
      inputTiers: [
        { cost: '0.0000002', min: 0, max: 128001 },
        { cost: '0.0000004', min: 128001 },
      ],
      outputTiers: [
        { cost: '0.0000005', min: 0, max: 128001 },
        { cost: '0.000001', min: 128001 },
      ],
    },
  },
]
