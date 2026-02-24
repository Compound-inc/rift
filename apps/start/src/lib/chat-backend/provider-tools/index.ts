import type { ToolSet } from 'ai'
import type {
  CatalogProviderId,
  ProviderToolIdByProvider,
} from '@/lib/ai-catalog/provider-tools'
import { ANTHROPIC_PROVIDER_TOOL_REGISTRY } from './anthropic'
import { GOOGLE_PROVIDER_TOOL_REGISTRY } from './google'
import { OPENAI_PROVIDER_TOOL_REGISTRY } from './openai'
import { XAI_PROVIDER_TOOL_REGISTRY } from './xai'
import type { ProviderToolFactoryContext, ProviderToolRegistry } from './types'

const ALIBABA_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'alibaba'> = {
  byId: {},
}
const DEEPSEEK_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'deepseek'> = {
  byId: {},
}
const MISTRAL_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'mistral'> = {
  byId: {},
}
const MINIMAX_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'minimax'> = {
  byId: {},
}
const META_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'meta'> = {
  byId: {},
}
const MOONSHOTAI_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'moonshotai'> = {
  byId: {},
}
const ZAI_PROVIDER_TOOL_REGISTRY: ProviderToolRegistry<'zai'> = {
  byId: {},
}

type ProviderToolRegistries = {
  [P in CatalogProviderId]: ProviderToolRegistry<P>
}

const PROVIDER_TOOL_REGISTRIES: ProviderToolRegistries = {
  openai: OPENAI_PROVIDER_TOOL_REGISTRY,
  anthropic: ANTHROPIC_PROVIDER_TOOL_REGISTRY,
  google: GOOGLE_PROVIDER_TOOL_REGISTRY,
  alibaba: ALIBABA_PROVIDER_TOOL_REGISTRY,
  deepseek: DEEPSEEK_PROVIDER_TOOL_REGISTRY,
  meta: META_PROVIDER_TOOL_REGISTRY,
  mistral: MISTRAL_PROVIDER_TOOL_REGISTRY,
  minimax: MINIMAX_PROVIDER_TOOL_REGISTRY,
  moonshotai: MOONSHOTAI_PROVIDER_TOOL_REGISTRY,
  xai: XAI_PROVIDER_TOOL_REGISTRY,
  zai: ZAI_PROVIDER_TOOL_REGISTRY,
}

/**
 * Resolves catalog tool ids into concrete AI SDK provider tool instances.
 * Unknown ids and tools without runtime configuration are skipped safely.
 */
export function resolveProviderToolSet<TProviderId extends CatalogProviderId>(input: {
  readonly providerId: TProviderId
  readonly providerToolIds: readonly ProviderToolIdByProvider[TProviderId][]
  readonly context: ProviderToolFactoryContext
}): ToolSet {
  const registry = PROVIDER_TOOL_REGISTRIES[input.providerId]
  const tools: ToolSet = {}

  for (const toolId of input.providerToolIds) {
    const buildTool = registry.byId?.[toolId]
    const tool = buildTool
      ? buildTool(input.context)
      : registry.resolve?.(toolId, input.context)
    if (!tool) continue

    tools[toolId] = tool
  }

  return tools
}
