import { ALIBABA_MODELS } from './providers/alibaba'
import { ANTHROPIC_MODELS } from './providers/anthropic'
import { DEEPSEEK_MODELS } from './providers/deepseek'
import { GOOGLE_MODELS } from './providers/google'
import { META_MODELS } from './providers/meta'
import { MISTRAL_MODELS } from './providers/mistral'
import { MINIMAX_MODELS } from './providers/minimax'
import { MOONSHOTAI_MODELS } from './providers/moonshotai'
import { OPENAI_MODELS } from './providers/openai'
import { XAI_MODELS } from './providers/xai'
import { ZAI_MODELS } from './providers/zai'
import type { AiModelCatalogEntry } from './types'

/**
 * Global model catalog. This is append-only in practice so policy/state can
 * reference stable model IDs over time.
 */
export const AI_CATALOG: readonly AiModelCatalogEntry[] = [
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...GOOGLE_MODELS,
  ...ALIBABA_MODELS,
  ...DEEPSEEK_MODELS,
  ...META_MODELS,
  ...MISTRAL_MODELS,
  ...MINIMAX_MODELS,
  ...MOONSHOTAI_MODELS,
  ...XAI_MODELS,
  ...ZAI_MODELS,
]

/** O(1) catalog lookup for request-path model resolution. */
export const AI_CATALOG_BY_ID = new Map(AI_CATALOG.map((model) => [model.id, model]))

/** Grouped provider view used by org settings when toggling provider-level policy. */
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

/**
 * Default chat model used as fallback when a thread has no stored model
 * and a request does not provide an explicit override.
 */
export const CHAT_DEFAULT_MODEL_ID = 'openai/gpt-4o-mini'

/** Returns a catalog row by ID, or undefined when the ID is unknown. */
export function getCatalogModel(modelId: string): AiModelCatalogEntry | undefined {
  return AI_CATALOG_BY_ID.get(modelId)
}
