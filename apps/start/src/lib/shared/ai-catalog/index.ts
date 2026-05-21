import { ALIBABA_MODELS } from './providers/alibaba'
import { ANTHROPIC_MODELS } from './providers/anthropic'
import { DEEPSEEK_MODELS } from './providers/deepseek'
import { GOOGLE_MODELS } from './providers/google'
import { META_MODELS } from './providers/meta'
import { MISTRAL_MODELS } from './providers/mistral'
import { MINIMAX_MODELS } from './providers/minimax'
import { MOONSHOTAI_MODELS } from './providers/moonshotai'
import { OPENAI_MODELS } from './providers/openai'
import { OPENROUTER_MODELS } from './providers/openrouter'
import { XAI_MODELS } from './providers/xai'
import { XIAOMI_MODELS } from './providers/xiaomi'
import { ZAI_MODELS } from './providers/zai'
import type { AiModelCatalogEntry } from './types'
import type {
  CatalogProviderId,
  ProviderToolIdByProvider,
} from './provider-tools'

export {
  DEFAULT_CONTEXT_WINDOW_MODE,
  resolveContextWindowForMode,
  resolveModelContextWindow,
} from './context-window'
export type { ResolvedModelContextWindow } from './context-window'
export type { AiContextWindowMode } from './types'

const DEFAULT_PROVIDER_TOOL_IDS_BY_PROVIDER = {
  openai: ['web_search', 'code_interpreter'],
  anthropic: ['web_search_20250305', 'web_fetch_20250910'],
  google: ['google_search', 'url_context', 'code_execution'],
} as const satisfies Partial<{
  [P in CatalogProviderId]: readonly ProviderToolIdByProvider[P][]
}>

function withDefaultProviderTools<TProviderId extends CatalogProviderId>(
  model: AiModelCatalogEntry<TProviderId>,
): AiModelCatalogEntry<TProviderId> {
  const defaultToolIds =
    DEFAULT_PROVIDER_TOOL_IDS_BY_PROVIDER[
      model.providerId as keyof typeof DEFAULT_PROVIDER_TOOL_IDS_BY_PROVIDER
    ]
  if (
    !defaultToolIds ||
    model.providerToolIds.length > 0 ||
    model.skipDefaultProviderTools
  ) {
    return model
  }

  return {
    ...model,
    providerToolIds: [
      ...defaultToolIds,
    ] as unknown as AiModelCatalogEntry<TProviderId>['providerToolIds'],
  }
}

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
  ...OPENROUTER_MODELS,
  ...XAI_MODELS,
  ...XIAOMI_MODELS,
  ...ZAI_MODELS,
].map((model) => withDefaultProviderTools(model as AiModelCatalogEntry))

/** O(1) catalog lookup for request-path model resolution. */
export const AI_CATALOG_BY_ID = new Map(
  AI_CATALOG.map((model) => [model.id, model]),
)

/** Grouped provider view used by org settings when toggling provider-level policy. */
export const AI_MODELS_BY_PROVIDER = AI_CATALOG.reduce((acc, model) => {
  const current = acc.get(model.providerId)
  if (current) {
    current.push(model)
  } else {
    acc.set(model.providerId, [model])
  }
  return acc
}, new Map<string, AiModelCatalogEntry[]>())

/** Returns a catalog row by ID, or undefined when the ID is unknown. */
export function getCatalogModel(
  modelId: string,
): AiModelCatalogEntry | undefined {
  return AI_CATALOG_BY_ID.get(modelId)
}

export function getCatalogModelProviderRoute(input: {
  readonly modelId: string
  readonly providerId: string
}): { providerId: string; modelId: string } | undefined {
  const model = AI_CATALOG_BY_ID.get(input.modelId)
  if (!model?.providers?.includes(input.providerId)) return undefined

  const overriddenModelId = model.providerModelIds?.[input.providerId]
  if (overriddenModelId) {
    return {
      providerId: input.providerId,
      modelId: overriddenModelId,
    }
  }

  const isGatewayLike =
    input.providerId === 'gateway' || input.providerId === 'openrouter'
  return {
    providerId: input.providerId,
    modelId: isGatewayLike
      ? input.modelId
      : input.modelId.replace(/^[^/]+\//, ''),
  }
}

export { getProviderIcon, PROVIDER_ICONS } from './provider-icons'
export type { ProviderIconComponent } from './provider-icons'
