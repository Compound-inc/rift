import { getCatalogModel, getCatalogModelProviderRoute } from './index'
import type { StreamingToolsVerification } from './streaming-tools-verification'

/** Synthetic certificates for unit tests of provider/tool construction. These
 * are never imported by application code or written to the live evidence file.
 */
export function verifiedToolFixture(
  modelId: string,
  providerId?: string,
): StreamingToolsVerification | undefined {
  const model = getCatalogModel(modelId)
  const routeProvider =
    providerId ??
    (model?.providerId === 'openrouter' ? 'openrouter' : 'gateway')
  const route = getCatalogModelProviderRoute({
    modelId,
    providerId: routeProvider,
  })
  if (!model?.capabilities.supportsTools || !route) return undefined
  return {
    modelId,
    providerId: routeProvider,
    routeModelId: route.modelId,
    toolKeys: [
      ...model.providerToolIds.map((id) => `${model.providerId}.${id}`),
      'rift.documents',
    ],
    runtimeToolNames: [
      ...model.providerToolIds,
      'web_search_20250305',
      'web_fetch_20250910',
      'create_document',
      'read_document',
      'update_document',
    ],
    verifiedAt: '2026-10-30T00:00:00.000Z',
  }
}
