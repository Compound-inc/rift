import type { AiModelCatalogEntry } from '../types'

export const GOOGLE_MODELS: readonly AiModelCatalogEntry[] = [
  {
    id: 'google/gemini-2.5-flash',
    providerId: 'google',
    name: 'Gemini 2.5 Flash',
    description: 'Low-latency multimodal model for general use.',
    contextWindow: 1000000,
    tags: ['fast', 'multimodal'],
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
    },
  },
]
