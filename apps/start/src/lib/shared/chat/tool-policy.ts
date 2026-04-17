import { isAnthropicCodeExecutionToolId } from '@/lib/shared/ai-catalog/provider-tools/anthropic'
import {
  TOOL_CATALOG_BY_KEY,
  TOOL_KEYS_BY_MODEL_ID
  
} from '@/lib/shared/ai-catalog/tool-catalog'
import type {ToolCatalogEntry} from '@/lib/shared/ai-catalog/tool-catalog';
import type { ResolvedChatMode } from '@/lib/shared/chat-modes'
import { hasActiveOrgProviderKey } from '@/lib/shared/model-policy/provider-keys'
import type { OrgPolicy } from '@/lib/shared/model-policy/types'
import { canUseAdvancedProviderTools } from '@/utils/app-feature-flags'

export type ToolAvailabilityReason =
  | 'blocked_by_mode'
  | 'blocked_by_org_master_switch'
  | 'blocked_by_compliance'
  | 'blocked_by_org_policy'
  | 'blocked_by_thread_preference'
  | 'blocked_by_feature_flag'
  | 'blocked_by_external_tools_switch'

export type ResolvedToolAvailability = {
  readonly key: string
  readonly entry: ToolCatalogEntry
  readonly enabled: boolean
  readonly reasons: readonly ToolAvailabilityReason[]
}

export type ResolvedToolPolicy = {
  readonly availableToolKeys: readonly string[]
  readonly activeToolKeys: readonly string[]
  readonly toolEntries: readonly ResolvedToolAvailability[]
}

/**
 * Normalizes persisted tool-key arrays so downstream code can assume the values
 * are unique, trimmed, and stable across requests.
 */
export function normalizeStoredToolKeys(
  input: readonly string[] | undefined | null,
): readonly string[] {
  if (!input || input.length === 0) return []

  return [...new Set(input.map((value) => value.trim()).filter(Boolean))]
}

/**
 * Chat modes can restrict provider tools by provider/tool identifier without
 * changing the unified catalog keys. Resolution therefore needs both the
 * catalog entry and the effective mode definition.
 */
export function isToolAllowedByMode(input: {
  readonly entry: ToolCatalogEntry
  readonly mode?: ResolvedChatMode
}): boolean {
  const allowlist =
    input.mode?.definition.providerToolAllowlistByProvider?.[input.entry.providerId]
  if (!allowlist) return true
  if (allowlist.length === 0) return false
  return allowlist.includes(input.entry.providerToolId)
}

/**
 * Pure tool-policy resolver shared by the backend Effect service and the Zero
 * mutator layer. Keeping this logic in one place avoids policy drift between
 * request-time execution and client-driven thread preference updates.
 */
export function resolveToolPolicy(input: {
  readonly modelId: string
  readonly mode?: ResolvedChatMode
  readonly orgPolicy?: OrgPolicy
  readonly threadDisabledToolKeys?: readonly string[]
}): ResolvedToolPolicy {
  const modelToolKeys = TOOL_KEYS_BY_MODEL_ID.get(input.modelId) ?? []
  const normalizedThreadDisabled = normalizeStoredToolKeys(
    input.threadDisabledToolKeys,
  )
  const normalizedOrgDisabled = normalizeStoredToolKeys(
    input.orgPolicy?.toolPolicy.disabledToolKeys,
  )
  const toolEntries: ResolvedToolAvailability[] = []
  const activeToolKeys: string[] = []

  for (const toolKey of modelToolKeys) {
    const entry = TOOL_CATALOG_BY_KEY.get(toolKey)
    if (!entry) continue

    const reasons: ToolAvailabilityReason[] = []
    const requiresZdr =
      Boolean(input.orgPolicy?.complianceFlags.require_zdr) &&
      !hasActiveOrgProviderKey({
        providerId: entry.providerId,
        providerKeyStatus: input.orgPolicy?.providerKeyStatus,
      })

    if (!isToolAllowedByMode({ entry, mode: input.mode })) {
      reasons.push('blocked_by_mode')
    }
    if (
      entry.source === 'provider-native' &&
      input.orgPolicy &&
      !input.orgPolicy.toolPolicy.providerNativeToolsEnabled
    ) {
      reasons.push('blocked_by_org_master_switch')
    }
    if (
      entry.source === 'external' &&
      input.orgPolicy &&
      !input.orgPolicy.toolPolicy.externalToolsEnabled
    ) {
      reasons.push('blocked_by_external_tools_switch')
    }
    if (normalizedOrgDisabled.includes(toolKey)) {
      reasons.push('blocked_by_org_policy')
    }
    if (normalizedThreadDisabled.includes(toolKey)) {
      reasons.push('blocked_by_thread_preference')
    }
    if (
      requiresZdr &&
      entry.providerId === 'anthropic' &&
      isAnthropicCodeExecutionToolId(entry.providerToolId)
    ) {
      reasons.push('blocked_by_compliance')
    }
    if (entry.advanced && !canUseAdvancedProviderTools) {
      reasons.push('blocked_by_feature_flag')
    }

    const resolved = {
      key: toolKey,
      entry,
      enabled: reasons.length === 0,
      reasons,
    } satisfies ResolvedToolAvailability
    toolEntries.push(resolved)

    if (resolved.enabled) {
      activeToolKeys.push(toolKey)
    }
  }

  return {
    availableToolKeys: modelToolKeys,
    activeToolKeys,
    toolEntries,
  }
}

/**
 * Thread preferences are stored as disabled keys only. Unknown keys and keys
 * that are blocked by org-level policy are stripped before persistence so the
 * thread row stays canonical and compact.
 */
export function sanitizeThreadDisabledToolKeys(input: {
  readonly modelId: string
  readonly mode?: ResolvedChatMode
  readonly orgPolicy?: OrgPolicy
  readonly disabledToolKeys?: readonly string[]
}): readonly string[] {
  const resolved = resolveToolPolicy({
    modelId: input.modelId,
    mode: input.mode,
    orgPolicy: input.orgPolicy,
    threadDisabledToolKeys: input.disabledToolKeys,
  })

  return normalizeStoredToolKeys(input.disabledToolKeys).filter((toolKey) =>
    resolved.toolEntries.some(
      (entry) =>
        entry.key === toolKey &&
        !entry.reasons.includes('blocked_by_org_master_switch') &&
        !entry.reasons.includes('blocked_by_compliance') &&
        !entry.reasons.includes('blocked_by_org_policy') &&
        !entry.reasons.includes('blocked_by_external_tools_switch'),
    ),
  )
}
