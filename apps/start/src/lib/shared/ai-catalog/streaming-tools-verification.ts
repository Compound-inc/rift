import evidence from './streaming-tools-verification.json'
import { getCatalogModel, getCatalogModelProviderRoute } from './index'
import type { AiModelRouteProviderId } from './types'

/** Successful live streams, recorded by scripts/verify-streaming-tools.ts.
 * Generic tools metadata and mocked SDK tests are not compatibility evidence.
 * A certificate applies only to its route and tested tool set; Gateway results
 * must never authorize a direct BYOK or OpenRouter request.
 */
export type StreamingToolsVerification = {
  modelId: string
  providerId: AiModelRouteProviderId
  routeModelId: string
  toolKeys: string[]
  runtimeToolNames: string[]
  verifiedAt: string
}

export const STREAMING_TOOLS_VERIFICATIONS: readonly StreamingToolsVerification[] =
  evidence

export function getStreamingToolsVerification(
  modelId: string,
  providerId?: AiModelRouteProviderId,
): StreamingToolsVerification | undefined {
  const routeProvider =
    providerId ??
    (getCatalogModel(modelId)?.providerId === 'openrouter'
      ? 'openrouter'
      : 'gateway')
  const route = getCatalogModelProviderRoute({
    modelId,
    providerId: routeProvider,
  })
  return STREAMING_TOOLS_VERIFICATIONS.find(
    (record) =>
      record.modelId === modelId &&
      record.providerId === routeProvider &&
      record.routeModelId === route?.modelId,
  )
}
