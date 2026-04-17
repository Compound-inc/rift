import type { AiReasoningEffort } from '@/lib/shared/ai-catalog/types'
import type { OrgComplianceFlags } from '@/lib/shared/ai-catalog/compliance-map'
import { isChatModeId } from '@/lib/shared/chat-modes'
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
export type OrgPolicy = {
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

/**
 * Normalizes partially populated policy-like objects into the canonical
 * in-memory org policy snapshot used across chat and settings surfaces.
 */
export function normalizeOrgPolicy(input?: {
  readonly organizationId?: string
  readonly disabledProviderIds?: readonly string[]
  readonly disabledModelIds?: readonly string[]
  readonly complianceFlags?: OrgComplianceFlags
  readonly toolPolicy?: Partial<OrgToolPolicy>
  readonly orgKnowledgeEnabled?: boolean | null
  readonly enforcedModeId?: ChatModeId | string | null
  readonly providerKeyStatus?: {
    readonly syncedAt?: number
    readonly hasAnyProviderKey?: boolean
    readonly providers?: {
      readonly openai?: boolean
      readonly anthropic?: boolean
    }
  }
  readonly updatedAt?: number
} | null): OrgPolicy | undefined {
  if (!input?.organizationId) {
    return undefined
  }

  const enforcedModeId =
    typeof input.enforcedModeId === 'string' && isChatModeId(input.enforcedModeId)
      ? (input.enforcedModeId as ChatModeId)
      : undefined

  return {
    organizationId: input.organizationId,
    disabledProviderIds: input.disabledProviderIds ?? [],
    disabledModelIds: input.disabledModelIds ?? [],
    complianceFlags: input.complianceFlags ?? {},
    toolPolicy: {
      providerNativeToolsEnabled:
        input.toolPolicy?.providerNativeToolsEnabled ??
        DEFAULT_ORG_TOOL_POLICY.providerNativeToolsEnabled,
      externalToolsEnabled:
        input.toolPolicy?.externalToolsEnabled ??
        DEFAULT_ORG_TOOL_POLICY.externalToolsEnabled,
      disabledToolKeys:
        input.toolPolicy?.disabledToolKeys ??
        DEFAULT_ORG_TOOL_POLICY.disabledToolKeys,
    },
    orgKnowledgeEnabled: input.orgKnowledgeEnabled ?? false,
    enforcedModeId,
    providerKeyStatus: input.providerKeyStatus
        ? {
          syncedAt: input.providerKeyStatus.syncedAt ?? 0,
          hasAnyProviderKey:
            (input.providerKeyStatus.hasAnyProviderKey ??
              (Boolean(input.providerKeyStatus.providers?.openai) ||
                Boolean(input.providerKeyStatus.providers?.anthropic))),
          providers: {
            openai: Boolean(input.providerKeyStatus.providers?.openai),
            anthropic: Boolean(input.providerKeyStatus.providers?.anthropic),
          },
        }
      : undefined,
    updatedAt: input.updatedAt ?? Date.now(),
  }
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
