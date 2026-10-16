import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'
import type { AiModelCatalogEntry } from '../types'

type AnthropicEffort = NonNullable<AnthropicLanguageModelOptions['effort']>
type AnthropicThinkingPreset =
  | { readonly adaptive: true }
  | { readonly budgetTokens: number }

function isAdaptiveThinkingPreset(
  preset: AnthropicThinkingPreset,
): preset is { readonly adaptive: true } {
  return 'adaptive' in preset
}

/**
 * Shared base options for all Anthropic Messages API calls.
 */
function anthropicBaseOptions(): AnthropicLanguageModelOptions {
  return {
    sendReasoning: true,
    toolStreaming: true,
  } satisfies AnthropicLanguageModelOptions
}

/**
 * Builds Anthropic `thinking` options.
 *
 * We intentionally model thinking independently from effort so model entries
 * can opt into each capability explicitly.
 */
function anthropicThinkingOptions(
  preset: AnthropicThinkingPreset,
): NonNullable<AnthropicLanguageModelOptions['thinking']> {
  return isAdaptiveThinkingPreset(preset)
    ? { type: 'adaptive' }
    : { type: 'enabled', budgetTokens: preset.budgetTokens }
}

/**
 * Builds Anthropic provider options for reasoning-capable models.
 */
function anthropicReasoningProviderOptions(input: {
  readonly thinking: AnthropicThinkingPreset
  readonly effort?: AnthropicEffort
}): Record<string, unknown> {
  return {
    anthropic: {
      ...anthropicBaseOptions(),
      thinking: anthropicThinkingOptions(input.thinking),
      ...(input.effort ? { effort: input.effort } : {}),
    } satisfies AnthropicLanguageModelOptions,
  }
}

/**
 * Convenience helper for models that support thinking but not effort.
 */
function anthropicThinkingOnlyOptions(
  thinking: AnthropicThinkingPreset,
): Record<string, unknown> {
  return anthropicReasoningProviderOptions({ thinking })
}

/**
 * Convenience helper for models that support both thinking and effort.
 */
function anthropicEffortAndThinkingOptions(
  effort: AnthropicEffort,
  thinking: AnthropicThinkingPreset,
): Record<string, unknown> {
  return anthropicReasoningProviderOptions({ effort, thinking })
}

/**
 * Default provider options for models that do not use per-effort options
 */
function anthropicDefaultProviderOptions(): Record<string, unknown> {
  return { anthropic: anthropicBaseOptions() }
}

/**
 * Anthropic model catalog.
 *
 * Native tool support is pinned per model because Anthropic's newer web-search
 * version depends on code execution and needs a runtime fallback when org
 * policy or thread settings disable execution. We also pin code-execution
 * versions per model family because Anthropic's current support matrix differs
 * between the 20260120 and 20250825 tool revisions.
 */
export const ANTHROPIC_MODELS: readonly AiModelCatalogEntry<'anthropic'>[] = [
  // Chat models verified against https://ai-gateway.vercel.sh/v1/models on 2026-10-16.
  {
    id: 'anthropic/claude-haiku-5.5',
    providerId: 'anthropic',
    providers: ['gateway'],
    name: 'Claude Haiku 5.5',
    description:
      'Claude Haiku 5.5 brings adaptive reasoning to Anthropic’s low-cost Haiku family for everyday tasks, tool use, and scaled sub-agent deployments. It is the first Haiku with adjustable effort levels, letting developers balance reasoning depth and token usage for each task, with the option to turn thinking off for simpler requests.',
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
    providerToolIds: ['web_search_20250305'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultMaxOutputTokens: 128000,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'low',
        },
      },
      medium: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'medium',
        },
      },
      high: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'high',
        },
      },
      max: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'max',
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
          max: 100001,
        },
        {
          cost: '0.0000005',
          min: 100001,
        },
      ],
      outputTiers: [
        {
          cost: '0.0000005',
          min: 0,
          max: 100001,
        },
        {
          cost: '0.0000025',
          min: 100001,
        },
      ],
      inputCacheReadTiers: [
        {
          cost: '0.00000001',
          min: 0,
          max: 100001,
        },
        {
          cost: '0.00000005',
          min: 100001,
        },
      ],
      inputCacheWriteTiers: [
        {
          cost: '0.000000125',
          min: 0,
          max: 100001,
        },
        {
          cost: '0.000000625',
          min: 100001,
        },
      ],
    },
  },
  {
    id: 'anthropic/claude-sonnet-5.5',
    providerId: 'anthropic',
    providers: ['gateway'],
    name: 'Claude Sonnet 5.5',
    description:
      'Claude Sonnet 5.5 is a step-change improvement over Sonnet 5 for well-scoped everyday work like building features, fixing bugs, and creating polished documents, slides, and spreadsheets. It also writes more clearly than Sonnet 5.',
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
    providerToolIds: ['web_search_20250305'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultMaxOutputTokens: 128000,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'low',
        },
      },
      medium: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'medium',
        },
      },
      high: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'high',
        },
      },
      max: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'max',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.0000001',
      inputCacheWritePerToken: '0.0000025',
    },
  },
  {
    id: 'anthropic/claude-opus-5.5',
    providerId: 'anthropic',
    providers: ['gateway'],
    name: 'Claude Opus 5.5',
    description:
      'Claude Opus 5.5 is a step-change improvement over Opus 5 for agentic coding, long-running agentic tasks, knowledge work, communication, and vision. It is more token-efficient per completed task and reports progress, findings, and next steps in clear language.',
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
    providerToolIds: ['web_search_20250305'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultMaxOutputTokens: 128000,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'low',
        },
      },
      medium: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'medium',
        },
      },
      high: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'high',
        },
      },
      max: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'max',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000004',
      outputPerToken: '0.00002',
      inputCacheReadPerToken: '0.0000002',
      inputCacheWritePerToken: '0.000005',
    },
  },
  {
    id: 'anthropic/claude-fable-5.1',
    providerId: 'anthropic',
    providers: ['gateway'],
    name: 'Claude Fable 5.1',
    description:
      'Claude Fable 5.1 improves on Fable 5 across long-running agentic coding, knowledge work, and research, following instructions precisely over sessions that run unattended for hours.',
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
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultMaxOutputTokens: 128000,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'low',
        },
      },
      medium: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'medium',
        },
      },
      high: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'high',
        },
      },
      max: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'max',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00001',
      outputPerToken: '0.00005',
      inputCacheReadPerToken: '0.00000025',
      inputCacheWritePerToken: '0.0000125',
    },
  },
  {
    id: 'anthropic/claude-opus-5',
    providerId: 'anthropic',
    providers: ['gateway'],
    name: 'Claude Opus 5',
    description:
      "Claude Opus 5 is the latest model in Anthropic's Opus family and a step-change improvement over Opus 4.8. It delivers major gains over Opus 4.8 in agentic coding, professional knowledge work, and long-horizon reasoning, and it is stronger per token across effort levels.",
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
    providerToolIds: ['web_search_20250305'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'low',
        },
      },
      medium: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'medium',
        },
      },
      high: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'high',
        },
      },
      max: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'max',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000005',
      outputPerToken: '0.000025',
      inputCacheReadPerToken: '0.0000005',
      inputCacheWritePerToken: '0.00000625',
    },
  },
  {
    id: 'anthropic/claude-fable-5',
    providerId: 'anthropic',
    providers: ['gateway'],
    name: 'Claude Fable 5',
    description:
      'Claude Fable 5 is a Mythos-class model with robust safeguards. It can handle long-running, complex, and asynchronous tasks where previous models would have needed more frequent check-ins.',
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
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'low',
        },
      },
      medium: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'medium',
        },
      },
      high: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'high',
        },
      },
      max: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'max',
        },
      },
    },
    pricing: {
      inputPerToken: '0.00001',
      outputPerToken: '0.00005',
      inputCacheReadPerToken: '0.000001',
      inputCacheWritePerToken: '0.0000125',
    },
  },
  {
    id: 'anthropic/claude-sonnet-5',
    providerId: 'anthropic',
    providers: ['gateway'],
    name: 'Claude Sonnet 5',
    description:
      'Sonnet 5 is an upgrade to Sonnet 4.6, with gains across agentic coding and professional work. It builds on the strengths of previous Sonnet models, bringing top-tier intelligence at Sonnet pricing for coding, agents, and everyday professional work at scale.',
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
    providerToolIds: ['web_search_20250305'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'low',
        },
      },
      medium: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'medium',
        },
      },
      high: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'high',
        },
      },
      max: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'max',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000002',
      outputPerToken: '0.00001',
      inputCacheReadPerToken: '0.0000002',
      inputCacheWritePerToken: '0.0000025',
    },
  },
  {
    id: 'anthropic/claude-opus-4.8',
    providerId: 'anthropic',
    providers: ['gateway'],
    name: 'Claude Opus 4.8',
    description:
      "Opus 4.8 is a focused upgrade to Opus 4.7 and is Anthropic's best generally available model for coding, agentic tasks, and enterprise workflows. It builds on the strengths of previous Opus models with stronger performance on complex, multi-step coding tasks. Anthropic recommends using it on long-horizon coding and agentic tasks. It is also stronger on professional work, including document drafting, data analysis, and presentations.",
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
    providerToolIds: ['web_search_20250305'],
    skipDefaultProviderTools: true,
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultMaxOutputTokens: 128000,
    legacy: true,
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'low',
        },
      },
      medium: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'medium',
        },
      },
      high: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'high',
        },
      },
      max: {
        anthropic: {
          thinking: {
            type: 'adaptive',
          },
          effort: 'max',
        },
      },
    },
    pricing: {
      inputPerToken: '0.000005',
      outputPerToken: '0.000025',
      inputCacheReadPerToken: '0.0000005',
      inputCacheWritePerToken: '0.00000625',
    },
  },

  {
    id: 'anthropic/claude-opus-4.7',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-opus-4-7' },
    name: 'Claude Opus 4.7',
    description:
      'Opus 4.7 builds on the coding and agentic strengths of Opus 4.6 with stronger performance on complex, multi-step tasks and more reliable agentic execution. It also brings improved performance on knowledge work, from drafting documents to building presentations and analyzing data.',
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
    providerToolIds: [
      'web_search_20260209',
      'web_fetch_20260209',
      'code_execution_20260120',
    ],
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: anthropicEffortAndThinkingOptions('low', { adaptive: true }),
      medium: anthropicEffortAndThinkingOptions('medium', { adaptive: true }),
      high: anthropicEffortAndThinkingOptions('high', { adaptive: true }),
      max: anthropicEffortAndThinkingOptions('max', { adaptive: true }),
    },
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.000005',
      outputPerToken: '0.000025',
      inputCacheReadPerToken: '0.0000005',
      inputCacheWritePerToken: '0.00000625',
      webSearchPerRequest: '10',
      inputTiers: [
        { cost: '0.000005', min: 0, max: 200001 },
        { cost: '0.00001', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.000025', min: 0, max: 200001 },
        { cost: '0.0000375', min: 200001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000005', min: 0, max: 200001 },
        { cost: '0.000001', min: 200001 },
      ],
      inputCacheWriteTiers: [
        { cost: '0.00000625', min: 0, max: 200001 },
        { cost: '0.0000125', min: 200001 },
      ],
    },
  },
  {
    id: 'anthropic/claude-opus-4.6',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-opus-4-6' },
    name: 'Claude Opus 4.6',
    description:
      "Opus 4.6 is the world's best model for coding and professional work, built to power agents that take on whole categories of real-world work. It excels across the entire SDLC, breaking through on hard problems, identifying complex bugs, and demonstrating deeper codebase understanding.",
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
    providerToolIds: [
      'web_search_20260209',
      'web_fetch_20260209',
      'code_execution_20260120',
    ],
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: anthropicEffortAndThinkingOptions('low', { adaptive: true }),
      medium: anthropicEffortAndThinkingOptions('medium', { adaptive: true }),
      high: anthropicEffortAndThinkingOptions('high', { adaptive: true }),
      max: anthropicEffortAndThinkingOptions('max', { adaptive: true }),
    },
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.000005',
      outputPerToken: '0.000025',
      inputCacheReadPerToken: '0.0000005',
      inputCacheWritePerToken: '0.00000625',
      webSearchPerRequest: '10',
      inputTiers: [
        { cost: '0.000005', min: 0, max: 200001 },
        { cost: '0.00001', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.000025', min: 0, max: 200001 },
        { cost: '0.0000375', min: 200001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000005', min: 0, max: 200001 },
        { cost: '0.000001', min: 200001 },
      ],
      inputCacheWriteTiers: [
        { cost: '0.00000625', min: 0, max: 200001 },
        { cost: '0.0000125', min: 200001 },
      ],
    },
  },
  {
    id: 'anthropic/claude-opus-4.5',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-opus-4-5' },
    name: 'Claude Opus 4.5',
    description:
      "Claude Opus 4.5 is Anthropic's latest model in the Opus series, meant for demanding reasoning tasks and complex problem solving. This model has improvements in general intelligence and vision compared to previous iterations.",
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
    providerToolIds: [
      'web_search_20260209',
      'web_fetch_20260209',
      'code_execution_20260120',
    ],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: anthropicEffortAndThinkingOptions('low', { budgetTokens: 4000 }),
      medium: anthropicEffortAndThinkingOptions('medium', {
        budgetTokens: 10000,
      }),
      high: anthropicEffortAndThinkingOptions('high', { budgetTokens: 20000 }),
    },
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 128000,
    pricing: {
      inputPerToken: '0.000005',
      outputPerToken: '0.000025',
      inputCacheReadPerToken: '0.0000005',
      inputCacheWritePerToken: '0.00000625',
    },
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-sonnet-4-6' },
    name: 'Claude Sonnet 4.6',
    description:
      "Claude Sonnet 4.6 is Anthropic's most capable Sonnet model, with significant improvements in coding, computer use, long-context reasoning, and agent planning. Supports adaptive thinking for dynamic reasoning depth.",
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
    providerToolIds: [
      'web_search_20260209',
      'web_fetch_20260209',
      'code_execution_20260120',
    ],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: anthropicThinkingOnlyOptions({ adaptive: true }),
      medium: anthropicThinkingOnlyOptions({ adaptive: true }),
      high: anthropicThinkingOnlyOptions({ adaptive: true }),
    },
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.000003',
      outputPerToken: '0.000015',
      inputCacheReadPerToken: '0.0000003',
      inputCacheWritePerToken: '0.00000375',
      webSearchPerRequest: '10',
      inputTiers: [
        { cost: '0.000003', min: 0, max: 200001 },
        { cost: '0.000006', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.000015', min: 0, max: 200001 },
        { cost: '0.0000225', min: 200001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000003', min: 0, max: 200001 },
        { cost: '0.0000006', min: 200001 },
      ],
      inputCacheWriteTiers: [
        { cost: '0.00000375', min: 0, max: 200001 },
        { cost: '0.0000075', min: 200001 },
      ],
    },
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-sonnet-4-5' },
    name: 'Claude Sonnet 4.5',
    description:
      'Claude Sonnet 4.5 is the newest model in the Sonnet series, offering improvements and updates over Sonnet 4.',
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
    providerToolIds: [
      'web_search_20260209',
      'web_fetch_20260209',
      'code_execution_20260120',
    ],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: anthropicThinkingOnlyOptions({ budgetTokens: 4000 }),
      medium: anthropicThinkingOnlyOptions({ budgetTokens: 10000 }),
      high: anthropicThinkingOnlyOptions({ budgetTokens: 20000 }),
    },
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.000003',
      outputPerToken: '0.000015',
      inputCacheReadPerToken: '0.0000003',
      inputCacheWritePerToken: '0.00000375',
      webSearchPerRequest: '10',
      inputTiers: [
        { cost: '0.000003', min: 0, max: 200001 },
        { cost: '0.000006', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.000015', min: 0, max: 200001 },
        { cost: '0.0000225', min: 200001 },
      ],
      inputCacheReadTiers: [
        { cost: '0.0000003', min: 0, max: 200001 },
        { cost: '0.0000006', min: 200001 },
      ],
      inputCacheWriteTiers: [
        { cost: '0.00000375', min: 0, max: 200001 },
        { cost: '0.0000075', min: 200001 },
      ],
    },
  },
  {
    id: 'anthropic/claude-sonnet-4',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-sonnet-4-0' },
    name: 'Claude Sonnet 4',
    description:
      "Claude Sonnet 4 significantly improves on Sonnet 3.7's industry-leading capabilities, excelling in coding with a state-of-the-art 72.7% on SWE-bench. The model balances performance and efficiency for internal and external use cases.",
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
    providerToolIds: [
      'web_search_20250305',
      'web_fetch_20250910',
      'code_execution_20250825',
    ],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: anthropicThinkingOnlyOptions({ budgetTokens: 4000 }),
      medium: anthropicThinkingOnlyOptions({ budgetTokens: 8000 }),
      high: anthropicThinkingOnlyOptions({ budgetTokens: 16000 }),
    },
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.000003',
      outputPerToken: '0.000015',
      inputCacheReadPerToken: '0.0000003',
      inputCacheWritePerToken: '0.00000375',
      webSearchPerRequest: '10',
      inputTiers: [
        { cost: '0.000003', min: 0, max: 200001 },
        { cost: '0.000006', min: 200001 },
      ],
      outputTiers: [
        { cost: '0.000015', min: 0, max: 200001 },
        { cost: '0.0000225', min: 200001 },
      ],
    },
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-haiku-4-5' },
    name: 'Claude Haiku 4.5',
    description:
      "Claude Haiku 4.5 matches Sonnet 4's performance on coding, computer use, and agent tasks at substantially lower cost and faster speeds. It delivers near-frontier performance at a price point that works for scaled sub-agent deployments and free tier products.",
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
    providerToolIds: ['web_search_20250305', 'web_fetch_20250910'],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: anthropicThinkingOnlyOptions({ budgetTokens: 4000 }),
      medium: anthropicThinkingOnlyOptions({ budgetTokens: 8000 }),
      high: anthropicThinkingOnlyOptions({ budgetTokens: 16000 }),
    },
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 64000,
    pricing: {
      inputPerToken: '0.000001',
      outputPerToken: '0.000005',
      inputCacheReadPerToken: '0.0000001',
      inputCacheWritePerToken: '0.00000125',
      webSearchPerRequest: '10',
    },
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-3-7-sonnet-latest' },
    name: 'Claude 3.7 Sonnet',
    description:
      "Claude 3.7 Sonnet is Anthropic's most intelligent model to date and the first Claude model to offer extended thinking—the ability to solve complex problems with careful, step-by-step reasoning. State-of-the-art for coding, computer use, agentic capabilities, and content generation.",
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
    providerToolIds: [
      'web_search_20250305',
      'web_fetch_20250910',
      'code_execution_20250825',
    ],
    reasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    providerOptionsByReasoning: {
      low: anthropicThinkingOnlyOptions({ budgetTokens: 4000 }),
      medium: anthropicThinkingOnlyOptions({ budgetTokens: 8000 }),
      high: anthropicThinkingOnlyOptions({ budgetTokens: 16000 }),
    },
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 8192,
    pricing: {
      inputPerToken: '0.000003',
      outputPerToken: '0.000015',
      inputCacheReadPerToken: '0.0000003',
      inputCacheWritePerToken: '0.00000375',
    },
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-3-5-sonnet-latest' },
    name: 'Claude 3.5 Sonnet',
    description:
      'The upgraded Claude 3.5 Sonnet is now state-of-the-art for a variety of tasks including real-world software engineering, agentic capabilities and computer use. Delivers these advancements at the same price and speed as its predecessor.',
    contextWindow: 200000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: ['web_search_20250305', 'web_fetch_20250910'],
    reasoningEfforts: [],
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 8192,
    pricing: {
      inputPerToken: '0.000003',
      outputPerToken: '0.000015',
      inputCacheReadPerToken: '0.0000003',
      inputCacheWritePerToken: '0.00000375',
    },
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-3-5-haiku-latest' },
    name: 'Claude 3.5 Haiku',
    description:
      "Claude 3.5 Haiku is Anthropic's fastest, most compact model for near-instant responsiveness. It answers simple queries and requests with speed. Claude 3.5 Haiku can process images and return text outputs, and features a 200K context window.",
    contextWindow: 200000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    providerToolIds: [
      'web_search_20250305',
      'web_fetch_20250910',
      'code_execution_20250825',
    ],
    reasoningEfforts: [],
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 8192,
    pricing: {
      inputPerToken: '0.0000008',
      outputPerToken: '0.000004',
      inputCacheReadPerToken: '0.00000008',
      inputCacheWritePerToken: '0.000001',
    },
  },
  {
    id: 'anthropic/claude-3-haiku',
    legacy: true,
    providerId: 'anthropic',
    providers: ['anthropic', 'gateway'],
    providerModelIds: { anthropic: 'claude-3-haiku-20240307' },
    name: 'Claude 3 Haiku',
    description:
      "Claude 3 Haiku is Anthropic's fastest model yet, designed for enterprise workloads which often involve longer prompts. Haiku quickly analyzes large volumes of documents, such as quarterly filings, contracts, or legal cases, for half the cost of other models in its performance tier.",
    contextWindow: 200000,
    zeroDataRetention: true,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
      supportsFileInput: true,
      supportsPdfInput: true,
    },
    /** Claude 3 Haiku does not support web search or web fetch per Anthropic docs. */
    providerToolIds: [],
    skipDefaultProviderTools: true,
    reasoningEfforts: [],
    defaultProviderOptions: anthropicDefaultProviderOptions(),
    defaultMaxOutputTokens: 4096,
    pricing: {
      inputPerToken: '0.00000025',
      outputPerToken: '0.00000125',
      inputCacheReadPerToken: '0.00000003',
      inputCacheWritePerToken: '0.0000003',
    },
  },
]
