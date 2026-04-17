import {
  EMPTY_ORG_PROVIDER_KEY_STATUS,
  normalizeOrgPolicy,
  DEFAULT_ORG_TOOL_POLICY,
} from '@/lib/shared/model-policy/types'
import {
  normalizeOrgProductPolicy,
  serializeOrgProductPolicy,
} from '@/lib/shared/org-product-policy'
import type { OrgPolicy, OrgToolPolicy } from '@/lib/shared/model-policy/types'
import type { OrgProductPolicy } from '@/lib/shared/org-product-policy'

export const CHAT_PRODUCT_KEY = 'chat' as const

const PROVIDER_NATIVE_TOOLS_SETTING_KEY = 'providerNativeToolsEnabled'
const EXTERNAL_TOOLS_SETTING_KEY = 'externalToolsEnabled'

export type ChatProductPolicySnapshot = {
  readonly disabledProviderIds: readonly string[]
  readonly disabledModelIds: readonly string[]
  readonly toolPolicy: OrgToolPolicy
}

/**
 * Reads the generic org-product-policy row into the chat-specific subset used
 * by model/tool policy resolution. Legacy org-policy fields remain as a
 * fallback so deploys stay safe while production data is backfilled.
 */
export function normalizeChatProductPolicy(input?: {
  readonly productPolicy?: OrgProductPolicy | null
  readonly legacyOrgPolicy?: OrgPolicy | null
}): ChatProductPolicySnapshot {
  const hasProductPolicy = Boolean(input?.productPolicy)
  const productPolicy = normalizeOrgProductPolicy(input?.productPolicy)
  const legacyPolicy = input?.legacyOrgPolicy

  const providerNativeToolsEnabled = (() => {
    const value = productPolicy.settings[PROVIDER_NATIVE_TOOLS_SETTING_KEY]
    return typeof value === 'boolean'
      ? value
      : (legacyPolicy?.toolPolicy.providerNativeToolsEnabled ??
          DEFAULT_ORG_TOOL_POLICY.providerNativeToolsEnabled)
  })()

  const externalToolsEnabled = (() => {
    const value = productPolicy.settings[EXTERNAL_TOOLS_SETTING_KEY]
    return typeof value === 'boolean'
      ? value
      : (legacyPolicy?.toolPolicy.externalToolsEnabled ??
          DEFAULT_ORG_TOOL_POLICY.externalToolsEnabled)
  })()

  return {
    disabledProviderIds: hasProductPolicy
      ? productPolicy.disabledProviderIds
      : (legacyPolicy?.disabledProviderIds ?? []),
    disabledModelIds: hasProductPolicy
      ? productPolicy.disabledModelIds
      : (legacyPolicy?.disabledModelIds ?? []),
    toolPolicy: {
      providerNativeToolsEnabled,
      externalToolsEnabled,
      disabledToolKeys: hasProductPolicy
        ? productPolicy.disabledToolKeys
        : (legacyPolicy?.toolPolicy.disabledToolKeys ??
            DEFAULT_ORG_TOOL_POLICY.disabledToolKeys),
    },
  }
}

export function serializeChatProductPolicy(
  policy: ChatProductPolicySnapshot,
): OrgProductPolicy {
  return normalizeOrgProductPolicy({
    settings: {
      [PROVIDER_NATIVE_TOOLS_SETTING_KEY]:
        policy.toolPolicy.providerNativeToolsEnabled,
      [EXTERNAL_TOOLS_SETTING_KEY]: policy.toolPolicy.externalToolsEnabled,
    },
    disabledProviderIds: policy.disabledProviderIds,
    disabledModelIds: policy.disabledModelIds,
    disabledToolKeys: policy.toolPolicy.disabledToolKeys,
  })
}

/**
 * Merges global org policy with chat product restrictions into the effective
 * policy shape consumed by chat runtime and settings views.
 */
export function resolveEffectiveChatOrgPolicy(input: {
  readonly orgPolicy?: OrgPolicy | null
  readonly productPolicy?: OrgProductPolicy | null
}): OrgPolicy | undefined {
  const basePolicy = normalizeOrgPolicy(input.orgPolicy)
  const chatPolicy = normalizeChatProductPolicy({
    productPolicy: input.productPolicy,
    legacyOrgPolicy: basePolicy,
  })

  if (!basePolicy?.organizationId) {
    return undefined
  }

  return {
    organizationId: basePolicy.organizationId,
    disabledProviderIds: chatPolicy.disabledProviderIds,
    disabledModelIds: chatPolicy.disabledModelIds,
    complianceFlags: {
      ...basePolicy.complianceFlags,
      ...normalizeOrgProductPolicy(input.productPolicy).complianceFlags,
    },
    toolPolicy: chatPolicy.toolPolicy,
    orgKnowledgeEnabled: basePolicy.orgKnowledgeEnabled,
    enforcedModeId: basePolicy.enforcedModeId,
    providerKeyStatus:
      basePolicy.providerKeyStatus ?? EMPTY_ORG_PROVIDER_KEY_STATUS,
    updatedAt: basePolicy.updatedAt,
  }
}

export function serializeSparseChatProductPolicy(
  policy: ChatProductPolicySnapshot,
): Partial<OrgProductPolicy> {
  return serializeOrgProductPolicy(serializeChatProductPolicy(policy))
}
