import {
  getAnthropicProviderToolDefinition,
  type AnthropicProviderToolId,
} from './anthropic'
import { GOOGLE_PROVIDER_TOOLS } from './google'
import { OPENAI_PROVIDER_TOOLS } from './openai'
import { XAI_PROVIDER_TOOLS } from './xai'
import type { GoogleProviderToolId } from './google'
import type { OpenAiProviderToolId } from './openai'
import type { XaiProviderToolId } from './xai'
import type { ProviderToolDefinition } from './types'

/** DeepSeek has no built-in provider tools in the SDK; tool use is user-defined only. */
const DEEPSEEK_PROVIDER_TOOLS = [] as const satisfies readonly ProviderToolDefinition[]
type DeepseekProviderToolId = (typeof DEEPSEEK_PROVIDER_TOOLS)[number]['id']

/** Mistral has no built-in provider tools in the SDK; tool use is user-defined only. */
const MISTRAL_PROVIDER_TOOLS = [] as const satisfies readonly ProviderToolDefinition[]
type MistralProviderToolId = (typeof MISTRAL_PROVIDER_TOOLS)[number]['id']

/** Moonshot AI has no built-in provider tools in the SDK; tool use is user-defined only. */
const MOONSHOTAI_PROVIDER_TOOLS = [] as const satisfies readonly ProviderToolDefinition[]
type MoonshotaiProviderToolId = (typeof MOONSHOTAI_PROVIDER_TOOLS)[number]['id']

/** MiniMax has no built-in provider tools in the SDK; tool use is user-defined only. */
const MINIMAX_PROVIDER_TOOLS = [] as const satisfies readonly ProviderToolDefinition[]
type MinimaxProviderToolId = (typeof MINIMAX_PROVIDER_TOOLS)[number]['id']

/** Alibaba (Qwen) has no built-in provider tools in the SDK; tool use is user-defined only. */
const ALIBABA_PROVIDER_TOOLS = [] as const satisfies readonly ProviderToolDefinition[]
type AlibabaProviderToolId = (typeof ALIBABA_PROVIDER_TOOLS)[number]['id']

/** Meta (Llama) has no built-in provider tools in the SDK; tool use is user-defined only. */
const META_PROVIDER_TOOLS = [] as const satisfies readonly ProviderToolDefinition[]
type MetaProviderToolId = (typeof META_PROVIDER_TOOLS)[number]['id']

/** GLM (Zhipu AI / zai) has no built-in provider tools in the SDK; tool use is user-defined only. */
const ZAI_PROVIDER_TOOLS = [] as const satisfies readonly ProviderToolDefinition[]
type ZaiProviderToolId = (typeof ZAI_PROVIDER_TOOLS)[number]['id']

export const PROVIDER_TOOLS = {
  openai: OPENAI_PROVIDER_TOOLS,
  google: GOOGLE_PROVIDER_TOOLS,
  alibaba: ALIBABA_PROVIDER_TOOLS,
  deepseek: DEEPSEEK_PROVIDER_TOOLS,
  meta: META_PROVIDER_TOOLS,
  mistral: MISTRAL_PROVIDER_TOOLS,
  minimax: MINIMAX_PROVIDER_TOOLS,
  moonshotai: MOONSHOTAI_PROVIDER_TOOLS,
  xai: XAI_PROVIDER_TOOLS,
  zai: ZAI_PROVIDER_TOOLS,
} as const

export type CatalogProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'alibaba'
  | 'deepseek'
  | 'meta'
  | 'mistral'
  | 'minimax'
  | 'moonshotai'
  | 'xai'
  | 'zai'

export type ProviderToolIdByProvider = {
  readonly openai: OpenAiProviderToolId
  readonly anthropic: AnthropicProviderToolId
  readonly google: GoogleProviderToolId
  readonly alibaba: AlibabaProviderToolId
  readonly deepseek: DeepseekProviderToolId
  readonly meta: MetaProviderToolId
  readonly mistral: MistralProviderToolId
  readonly minimax: MinimaxProviderToolId
  readonly moonshotai: MoonshotaiProviderToolId
  readonly xai: XaiProviderToolId
  readonly zai: ZaiProviderToolId
}

export type CatalogProviderToolId = ProviderToolIdByProvider[CatalogProviderId]

export function getProviderToolDefinition<TProviderId extends CatalogProviderId>(
  providerId: TProviderId,
  toolId: ProviderToolIdByProvider[TProviderId],
): ProviderToolDefinition | undefined {
  if (providerId === 'anthropic') {
    return getAnthropicProviderToolDefinition(toolId as AnthropicProviderToolId)
  }

  if (providerId === 'openai') {
    return OPENAI_PROVIDER_TOOLS.find(
      (tool) => tool.id === toolId,
    ) as ProviderToolDefinition | undefined
  }

  if (providerId === 'google') {
    return GOOGLE_PROVIDER_TOOLS.find(
      (tool) => tool.id === toolId,
    ) as ProviderToolDefinition | undefined
  }

  if (providerId === 'mistral') {
    return undefined
  }

  if (providerId === 'moonshotai') {
    return undefined
  }

  if (providerId === 'xai') {
    return XAI_PROVIDER_TOOLS.find(
      (tool) => tool.id === toolId,
    ) as ProviderToolDefinition | undefined
  }

  if (providerId === 'deepseek') {
    return undefined
  }

  if (providerId === 'minimax') {
    return undefined
  }

  if (providerId === 'alibaba') {
    return undefined
  }

  if (providerId === 'zai') {
    return undefined
  }

  if (providerId === 'meta') {
    return undefined
  }

  return undefined
}
