import {
  AI_CATALOG,
  getCatalogModelProviderRoute,
} from '../src/lib/shared/ai-catalog'

import { STREAMING_TOOLS_VERIFICATIONS } from '../src/lib/shared/ai-catalog/streaming-tools-verification'
import { DECLARED_TOOL_KEYS_BY_MODEL_ID } from '../src/lib/shared/ai-catalog/tool-catalog'

/** Gateway names the model creator independently of Rift's stable provider IDs. */
const GATEWAY_CREATOR_BY_PROVIDER: Readonly<Record<string, string>> = {
  xai: 'spacexai',
}

interface GatewayModel {
  readonly id: string
  readonly type: string
  readonly supported_parameters?: readonly string[]
  readonly modalities?: { readonly output?: readonly string[] }
}

/** Mirrors the picker scope and the explicit exclusions requested for Rift. */
function isIncludedChatModel(model: GatewayModel): boolean {
  return (
    model.type === 'language' &&
    model.modalities?.output?.length === 1 &&
    model.modalities.output[0] === 'text' &&
    !/-(batch|fast|highspeed|ultraspeed|lightning)$/.test(model.id) &&
    !(model.id.startsWith('openai/') && model.id.endsWith('-pro')) &&
    !/transcribe|realtime|gpt-live|safeguard/.test(model.id)
  )
}

const response = await fetch('https://ai-gateway.vercel.sh/v1/models')
if (!response.ok) {
  throw new Error(`Gateway model audit failed: HTTP ${response.status}`)
}
const { data: models } = (await response.json()) as { data: GatewayModel[] }
const gatewayIds = new Set(models.map((model) => model.id))
const catalogRoutes = new Set(
  AI_CATALOG.map(
    (model) =>
      getCatalogModelProviderRoute({ modelId: model.id, providerId: 'gateway' })
        ?.modelId,
  ).filter((id): id is string => Boolean(id)),
)
const providers = [...new Set(AI_CATALOG.map((model) => model.providerId))]
let missingCount = 0

for (const provider of providers) {
  // The Auto Router uses OpenRouter directly, rather than a Gateway model ID.
  if (provider === 'openrouter') continue
  const creator = GATEWAY_CREATOR_BY_PROVIDER[provider] ?? provider
  const available = models.filter(
    (model) => model.id.startsWith(`${creator}/`) && isIncludedChatModel(model),
  )
  if (available.length === 0) {
    // An empty result previously hid the xAI namespace change from the audit.
    console.error(
      `${provider}: no matching Gateway chat models; verify the creator namespace`,
    )
    missingCount += 1
    continue
  }
  const missing = available.filter((model) => !catalogRoutes.has(model.id))
  console.log(
    `${provider}: ${available.length - missing.length}/${available.length} eligible Gateway chat models covered`,
  )
  for (const model of missing) console.error(`  Missing: ${model.id}`)
  missingCount += missing.length
}

// Tools and streaming are separate Gateway capabilities. Catch models that
// cannot accept tools at all here. A generic tools parameter is not proof of
// streaming-tool compatibility; that must be verified for the model route.
const gatewayById = new Map(models.map((model) => [model.id, model]))
for (const model of AI_CATALOG) {
  const route = getCatalogModelProviderRoute({
    modelId: model.id,
    providerId: 'gateway',
  })
  const parameters = route
    ? gatewayById.get(route.modelId)?.supported_parameters
    : undefined
  if (
    model.capabilities.supportsTools &&
    parameters &&
    !parameters.includes('tools')
  ) {
    console.error(
      `Catalog enables tools on a Gateway route without tool support: ${model.id}`,
    )
    missingCount += 1
  }
}

// A generic tools parameter is never a substitute for live combined-request
// evidence. Reject stale or malformed certificates instead of silently keeping
// a route enabled after its model ID or declared tool set changes.
for (const record of STREAMING_TOOLS_VERIFICATIONS) {
  const route = getCatalogModelProviderRoute({
    modelId: record.modelId,
    providerId: record.providerId,
  })
  const declared = DECLARED_TOOL_KEYS_BY_MODEL_ID.get(record.modelId) ?? []
  if (
    route?.modelId !== record.routeModelId ||
    !Number.isFinite(Date.parse(record.verifiedAt)) ||
    record.runtimeToolNames.length === 0 ||
    record.toolKeys.length === 0 ||
    record.toolKeys.some((key) => !declared.includes(key))
  ) {
    console.error(
      `Invalid streaming-tool evidence: ${record.providerId}/${record.modelId}`,
    )
    missingCount += 1
  }
}
console.log(
  `${STREAMING_TOOLS_VERIFICATIONS.length} verified streaming/tool routes; unverified combinations remain disabled`,
)

// Catch stale routes among the default choices without dropping saved legacy IDs.
for (const model of AI_CATALOG) {
  if (model.legacy || !model.providers.includes('gateway')) continue
  const route = getCatalogModelProviderRoute({
    modelId: model.id,
    providerId: 'gateway',
  })
  if (route && !gatewayIds.has(route.modelId)) {
    console.error(
      `Current model has an unlisted Gateway route: ${model.id} -> ${route.modelId}`,
    )
    missingCount += 1
  }
}

if (missingCount > 0) process.exitCode = 1
