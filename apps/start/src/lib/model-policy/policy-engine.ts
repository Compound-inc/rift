import {
  AI_CATALOG,
  AI_CATALOG_BY_ID,
} from '@/lib/ai-catalog'
import { deniedTagsFromComplianceFlags } from '@/lib/ai-catalog/compliance-map'
import type { AiModelCatalogEntry } from '@/lib/ai-catalog/types'
import type {
  ModelAvailabilityDecision,
  OrgAiPolicy,
} from './types'

function emptyDecision(): ModelAvailabilityDecision {
  return { allowed: true, deniedBy: [] }
}

export function evaluateModelAvailability(input: {
  readonly model: AiModelCatalogEntry
  readonly policy?: OrgAiPolicy
}): ModelAvailabilityDecision {
  const { model, policy } = input
  if (!policy) return emptyDecision()

  const deniedBy: Array<'provider' | 'model' | 'tag'> = []

  if (policy.disabledProviderIds.includes(model.providerId)) {
    deniedBy.push('provider')
  }
  if (policy.disabledModelIds.includes(model.id)) {
    deniedBy.push('model')
  }

  const deniedTags = deniedTagsFromComplianceFlags(policy.complianceFlags)
  if (model.tags.some((tag) => deniedTags.has(tag))) {
    deniedBy.push('tag')
  }

  return {
    allowed: deniedBy.length === 0,
    deniedBy,
  }
}

export function listAllowedCatalogModels(policy?: OrgAiPolicy): readonly AiModelCatalogEntry[] {
  return AI_CATALOG.filter(
    (model) => evaluateModelAvailability({ model, policy }).allowed,
  )
}

export function getCatalogModelById(modelId: string): AiModelCatalogEntry | undefined {
  return AI_CATALOG_BY_ID.get(modelId)
}
