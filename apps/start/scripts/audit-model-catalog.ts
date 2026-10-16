import {
  AI_CATALOG,
  getCatalogModelProviderRoute,
} from '../src/lib/shared/ai-catalog'

/** Gateway names the model creator independently of Rift's stable provider IDs. */
const GATEWAY_CREATOR_BY_PROVIDER: Readonly<Record<string, string>> = {
  xai: 'spacexai',
}

interface GatewayModel {
  readonly id: string
  readonly type: string
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
