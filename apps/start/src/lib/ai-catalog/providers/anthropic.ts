import type { AiModelCatalogEntry } from '../types'

export const ANTHROPIC_MODELS: readonly AiModelCatalogEntry[] = [
  {
    id: 'anthropic/claude-3-5-haiku',
    providerId: 'anthropic',
    name: 'Claude 3.5 Haiku',
    description: 'Low-latency model for lightweight tasks.',
    contextWindow: 200000,
    tags: ['fast'],
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
    },
  },
  {
    id: 'anthropic/claude-3-7-sonnet',
    providerId: 'anthropic',
    name: 'Claude 3.7 Sonnet',
    description: 'Balanced model for analysis and generation.',
    contextWindow: 200000,
    tags: ['reasoning', 'collects_data'],
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
    },
  },
]
