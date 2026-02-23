import type { AiModelCatalogEntry } from '../types'

export const OPENAI_MODELS: readonly AiModelCatalogEntry[] = [
  {
    id: 'openai/gpt-4o-mini',
    providerId: 'openai',
    name: 'GPT-4o Mini',
    description: 'Fast and cost-efficient model for general chat.',
    contextWindow: 128000,
    tags: ['fast', 'economical'],
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      supportsImageInput: true,
    },
  },
  {
    id: 'openai/chatgpt-5.2',
    providerId: 'openai',
    name: 'ChatGPT 5.2',
    description: 'High-quality large model for complex tasks.',
    contextWindow: 200000,
    tags: ['reasoning', 'multimodal', 'collects_data'],
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: true,
      supportsImageInput: true,
    },
  },
]
