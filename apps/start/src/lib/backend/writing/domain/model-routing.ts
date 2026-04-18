import { WRITING_DEFAULT_MODEL_ID } from '@/lib/shared/writing'

export const WRITING_GATEWAY_PROVIDER = 'vercel-ai-gateway' as const

export type ParsedWritingModelId = {
  readonly raw: string
  readonly provider: string
  readonly modelName: string
}

/**
 * Writing chat rows persist a compact `provider:model` identifier. This parser
 * keeps the boundary permissive enough for both gateway-backed ids such as
 * `vercel-ai-gateway:openai/gpt-5.1` and older direct-provider ids such as
 * `openai:gpt-5.1`.
 */
export function parseWritingModelId(
  modelId?: string,
): ParsedWritingModelId {
  const raw = modelId?.trim() || WRITING_DEFAULT_MODEL_ID
  const separator = raw.includes(':') ? ':' : '/'
  const [provider, ...rest] = raw.split(separator)
  const modelName = rest.join(separator)

  if (!provider || !modelName) {
    throw new Error(`Invalid writing model id "${raw}"`)
  }

  return { raw, provider, modelName }
}

/**
 * Resolves the provider/model pair used by the PI runtime.
 *
 * We prefer routing legacy direct-provider ids through Vercel AI Gateway when
 * `AI_GATEWAY_API_KEY` is configured, which keeps older persisted writing chat
 * rows working without requiring a data migration.
 */
export function resolveWritingRuntimeModelTarget(input: {
  readonly requestedModelId?: string
  readonly persistedModelId?: string
  readonly gatewayApiKey?: string
}): ParsedWritingModelId {
  const parsed = parseWritingModelId(input.requestedModelId || input.persistedModelId)
  const gatewayApiKey = input.gatewayApiKey?.trim()
  const gatewayModelName = toGatewayModelName(parsed.provider, parsed.modelName)

  if (gatewayApiKey && gatewayModelName) {
    return {
      raw: `${WRITING_GATEWAY_PROVIDER}:${gatewayModelName}`,
      provider: WRITING_GATEWAY_PROVIDER,
      modelName: gatewayModelName,
    }
  }

  return parsed
}

function toGatewayModelName(
  provider: string,
  modelName: string,
): string | undefined {
  if (provider === WRITING_GATEWAY_PROVIDER) {
    return normalizeGatewayModelName(modelName)
  }

  if (provider === 'openai' || provider === 'anthropic') {
    return normalizeGatewayModelName(`${provider}/${modelName}`)
  }

  return undefined
}

/**
 * PI's gateway registry does not always expose the exact same ids as the
 * direct-provider registry. Normalize a few legacy aliases so existing writing
 * chats can transparently move onto supported gateway model ids.
 */
function normalizeGatewayModelName(modelName: string): string {
  switch (modelName) {
    case 'openai/gpt-5.1':
      return 'openai/gpt-5.1-thinking'
    default:
      return modelName
  }
}
