import type { AiReasoningEffort } from '@/lib/shared/ai-catalog/types'
import type { OrgComplianceFlags } from '@/lib/shared/ai-catalog/compliance-map'
import type { ChatModeId } from '@/lib/shared/chat-modes'

export type OrgToolPolicy = {
  readonly providerNativeToolsEnabled: boolean
  readonly externalToolsEnabled: boolean
  readonly disabledToolKeys: readonly string[]
}

export const DEFAULT_ORG_TOOL_POLICY: OrgToolPolicy = {
  providerNativeToolsEnabled: true,
  externalToolsEnabled: true,
  disabledToolKeys: [],
}

export type OrgProviderKeyStatusSnapshot = {
  readonly syncedAt: number
  readonly hasAnyProviderKey: boolean
  readonly providers: {
    readonly openai: boolean
    readonly anthropic: boolean
  }
}

export const EMPTY_ORG_PROVIDER_KEY_STATUS: OrgProviderKeyStatusSnapshot = {
  syncedAt: 0,
  hasAnyProviderKey: false,
  providers: {
    openai: false,
    anthropic: false,
  },
}

export function toOrgProviderKeyStatusSnapshot(input: {
  readonly openai: boolean
  readonly anthropic: boolean
}): OrgProviderKeyStatusSnapshot {
  return {
    syncedAt: Date.now(),
    providers: {
      openai: input.openai,
      anthropic: input.anthropic,
    },
    hasAnyProviderKey: input.openai || input.anthropic,
  }
}

/**
 * Persisted organization policy snapshot used to evaluate model availability.
 * Arrays represent deny rules; missing IDs are considered allowed.
 */
export type OrgAiPolicy = {
  readonly organizationId: string
  readonly disabledProviderIds: readonly string[]
  readonly disabledModelIds: readonly string[]
  readonly complianceFlags: OrgComplianceFlags
  readonly toolPolicy: OrgToolPolicy
  readonly orgKnowledgeEnabled: boolean
  readonly enforcedModeId?: ChatModeId
  /**
   * Optional provider-key presence snapshot used to short-circuit BYOK key
   * resolution on chat requests when no org keys are configured.
   */
  readonly providerKeyStatus?: OrgProviderKeyStatusSnapshot
  readonly updatedAt: number
}

/** Result of policy evaluation for one model candidate. */
export type ModelAvailabilityDecision = {
  readonly allowed: boolean
  readonly deniedBy: readonly ('provider' | 'model' | 'compliance')[]
}

/**
 * Final model decision for a chat turn. `source` is included for telemetry and
 * message metadata consumers that need to explain why a model was chosen.
 */
export type EffectiveModelResolution = {
  readonly modelId: string
  readonly reasoningEffort?: AiReasoningEffort
  readonly source: 'thread' | 'request' | 'mode'
  /**
   * Optional org-scoped provider auth override. When present, runtime model
   * execution must use this key and must not fall back to system credentials.
   */
  readonly providerApiKeyOverride?: {
    readonly providerId: 'openai' | 'anthropic'
    readonly apiKey: string
  }
}
