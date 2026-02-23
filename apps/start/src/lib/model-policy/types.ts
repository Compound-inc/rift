import type { OrgComplianceFlags } from '@/lib/ai-catalog/compliance-map'

export type OrgAiPolicy = {
  readonly orgWorkosId: string
  readonly disabledProviderIds: readonly string[]
  readonly disabledModelIds: readonly string[]
  readonly complianceFlags: OrgComplianceFlags
  readonly version: number
  readonly updatedAt: number
}

export type ModelAvailabilityDecision = {
  readonly allowed: boolean
  readonly deniedBy: readonly ('provider' | 'model' | 'tag')[]
}

export type EffectiveModelResolution = {
  readonly modelId: string
  readonly source: 'fixed'
}
