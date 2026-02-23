import { ANTHROPIC_MODELS } from './providers/anthropic'
import { GOOGLE_MODELS } from './providers/google'
import { OPENAI_MODELS } from './providers/openai'
import type { AiModelCatalogEntry } from './types'

export const AI_CATALOG: readonly AiModelCatalogEntry[] = [
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GOOGLE_MODELS,
]

export const AI_CATALOG_BY_ID = new Map(AI_CATALOG.map((model) => [model.id, model]))

export const AI_MODELS_BY_PROVIDER = AI_CATALOG.reduce(
  (acc, model) => {
    const current = acc.get(model.providerId)
    if (current) {
      current.push(model)
    } else {
      acc.set(model.providerId, [model])
    }
    return acc
  },
  new Map<string, AiModelCatalogEntry[]>(),
)

export const CHAT_FIXED_MODEL_ID = 'openai/gpt-4o-mini'

export function getCatalogModel(modelId: string): AiModelCatalogEntry | undefined {
  return AI_CATALOG_BY_ID.get(modelId)
}
