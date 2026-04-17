import {
  AI_CATALOG,
  AI_CATALOG_BY_ID,
} from '@/lib/shared/ai-catalog'
import { isDeniedByComplianceFlags } from '@/lib/shared/ai-catalog/compliance-map'
import { hasActiveOrgProviderKeyForModel } from './provider-keys'
import type { AiModelCatalogEntry } from '@/lib/shared/ai-catalog/types'
import type {
  ModelAvailabilityDecision,
  OrgPolicy,
} from './types'

/** Default allow when no org policy exists yet. */
function emptyDecision(): ModelAvailabilityDecision {
  return { allowed: true, deniedBy: [] }
}

/**
 * Evaluates a single catalog model against org deny rules.
 * Denials are additive: provider, model, and compliance-tag checks can all apply.
 */
export function evaluateModelAvailability(input: {
  readonly model: AiModelCatalogEntry
  readonly policy?: OrgPolicy
}): ModelAvailabilityDecision {
  const { model, policy } = input
  if (!policy) return emptyDecision()

  const deniedBy: Array<'provider' | 'model' | 'compliance'> = []

  if (policy.disabledProviderIds.includes(model.providerId)) {
    deniedBy.push('provider')
  }
  if (policy.disabledModelIds.includes(model.id)) {
    deniedBy.push('model')
  }

  const bypassesZdrCompliance = hasActiveOrgProviderKeyForModel({
    providers: model.providers,
    providerKeyStatus: policy.providerKeyStatus,
  })

  if (
    !bypassesZdrCompliance &&
    isDeniedByComplianceFlags(model, policy.complianceFlags)
  ) {
    deniedBy.push('compliance')
  }

  return {
    allowed: deniedBy.length === 0,
    deniedBy,
  }
}

/** Returns catalog models visible to an org after policy filtering. */
export function listAllowedCatalogModels(policy?: OrgPolicy): readonly AiModelCatalogEntry[] {
  return AI_CATALOG.filter(
    (model) => evaluateModelAvailability({ model, policy }).allowed,
  )
}

/** Convenience lookup used by services that resolve/validate model IDs. */
export function getCatalogModelById(modelId: string): AiModelCatalogEntry | undefined {
  return AI_CATALOG_BY_ID.get(modelId)
}
