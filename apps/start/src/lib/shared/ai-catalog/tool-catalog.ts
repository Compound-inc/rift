import { AI_CATALOG } from './index'
import {
  getProviderToolDefinition
  
} from './provider-tools'
import type {CatalogProviderId} from './provider-tools';

export type ToolCatalogEntry = {
  readonly key: string
  readonly providerId: CatalogProviderId | 'rift'
  readonly providerToolId: string
  readonly advanced: boolean
  readonly category:
    | 'search'
    | 'files'
    | 'code'
    | 'computer'
    | 'location'
    | 'video'
    | 'remote'
    | 'other'
  readonly source: 'provider-native' | 'external' | 'built-in'
  readonly sortOrder: number
}

function getCategory(input: {
  readonly providerToolId: string
}): ToolCatalogEntry['category'] {
  const text = input.providerToolId.toLowerCase()
  if (text.includes('search')) return 'search'
  if (text.includes('file')) return 'files'
  if (text.includes('code') || text.includes('interpreter')) return 'code'
  if (text.includes('computer') || text.includes('editor')) return 'computer'
  if (text.includes('maps')) return 'location'
  if (text.includes('video')) return 'video'
  if (text.includes('mcp')) return 'remote'
  return 'other'
}

function buildToolCatalog(): readonly ToolCatalogEntry[] {
  const entries: ToolCatalogEntry[] = []
  const seen = new Set<string>()

  for (const model of AI_CATALOG) {
    for (const providerToolId of model.providerToolIds) {
      const key = `${model.providerId}.${providerToolId}`
      if (seen.has(key)) continue
      seen.add(key)

      const definition = getProviderToolDefinition(
        model.providerId,
        providerToolId,
      )
      if (!definition) continue

      entries.push({
        key,
        providerId: model.providerId,
        providerToolId,
        advanced: definition.advanced,
        category: getCategory({
          providerToolId,
        }),
        source: 'provider-native',
        sortOrder: entries.length + 1,
      })
    }
  }

  entries.push({ key: 'rift.documents', providerId: 'rift', providerToolId: 'documents', advanced: false, category: 'files', source: 'built-in', sortOrder: entries.length + 1 })
  return entries
}

export const TOOL_CATALOG = buildToolCatalog()

export const TOOL_CATALOG_BY_KEY = new Map(
  TOOL_CATALOG.map((entry) => [entry.key, entry]),
)

export const TOOL_KEYS_BY_PROVIDER = TOOL_CATALOG.reduce(
  (acc, entry) => {
    const current = acc.get(entry.providerId) ?? []
    current.push(entry.key)
    acc.set(entry.providerId, current)
    return acc
  },
  new Map<ToolCatalogEntry['providerId'], string[]>(),
)

/**
 * Request-path tool resolution needs an O(1) model lookup so the orchestrator
 * can filter tools without rebuilding provider catalogs on every request.
 */
export const TOOL_KEYS_BY_MODEL_ID = new Map(
  AI_CATALOG.map((model) => [
    model.id,
    model.providerToolIds
      .map((providerToolId) => `${model.providerId}.${providerToolId}`)
      .concat(model.capabilities.supportsTools ? ['rift.documents'] : []),
  ]),
)
