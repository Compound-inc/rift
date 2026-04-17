'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { mutators, queries } from '@/integrations/zero'
import {
  CHAT_PRODUCT_KEY,
  normalizeChatProductPolicy,
  resolveEffectiveChatOrgPolicy,
  serializeChatProductPolicy,
} from '@/lib/shared/model-policy/chat-product-policy'
import { normalizeOrgPolicy } from '@/lib/shared/model-policy/types'
import {
  readOrgProductPolicy,
  toMutableOrgProductPolicyInput,
  useOrgProductPolicy,
} from '@/lib/frontend/organizations/use-org-product-policy'
import type { ChatProductPolicySnapshot } from '@/lib/shared/model-policy/chat-product-policy'
import type { OrgPolicy } from '@/lib/shared/model-policy/types'

type OrgPolicyRow = {
  organizationId?: string
  complianceFlags?: Record<string, boolean>
  providerKeyStatus?: {
    syncedAt?: number
    hasAnyProviderKey?: boolean
    providers?: {
      openai?: boolean
      anthropic?: boolean
    }
  } | null
  orgKnowledgeEnabled?: boolean | null
  enforcedModeId?: string | null
  updatedAt?: number
}

function toNormalizedOrgPolicyRow(row?: OrgPolicyRow | null): OrgPolicy | undefined {
  return normalizeOrgPolicy({
    organizationId: row?.organizationId,
    complianceFlags: row?.complianceFlags,
    providerKeyStatus: row?.providerKeyStatus ?? undefined,
    orgKnowledgeEnabled: row?.orgKnowledgeEnabled,
    enforcedModeId: row?.enforcedModeId ?? undefined,
    updatedAt: row?.updatedAt,
  })
}

export function useChatProductPolicy() {
  const z = useZero()
  const [orgPolicyRow, orgPolicyResult] = useQuery(queries.orgPolicy.current())
  const productPolicyState = useOrgProductPolicy(CHAT_PRODUCT_KEY)

  const orgPolicy = useMemo(
    () => toNormalizedOrgPolicyRow((orgPolicyRow as OrgPolicyRow | null | undefined) ?? null),
    [orgPolicyRow],
  )

  const chatPolicy = useMemo<ChatProductPolicySnapshot>(
    () =>
      normalizeChatProductPolicy({
        productPolicy: productPolicyState.policy,
        legacyOrgPolicy: orgPolicy,
      }),
    [orgPolicy, productPolicyState.policy],
  )

  const effectivePolicy = useMemo(
    () =>
      resolveEffectiveChatOrgPolicy({
        orgPolicy,
        productPolicy: productPolicyState.policy,
      }),
    [orgPolicy, productPolicyState.policy],
  )

  const setChatPolicy = useCallback(
    async (nextPolicy: ChatProductPolicySnapshot) => {
      await productPolicyState.setPolicy(serializeChatProductPolicy(nextPolicy))
    },
    [productPolicyState],
  )

  const updateComplianceFlag = useCallback(
    async (input: { readonly flag: string; readonly enabled: boolean }) => {
      await z.mutate(
        mutators.orgPolicy.toggleComplianceFlag({
          flag: input.flag,
          enabled: input.enabled,
        }),
      ).client
    },
    [z],
  )

  const setEnforcedMode = useCallback(
    async (modeId: string | null) => {
      await z.mutate(
        mutators.orgPolicy.setEnforcedMode({
          modeId,
        }),
      ).client
    },
    [z],
  )

  return {
    orgPolicy,
    effectivePolicy,
    chatPolicy,
    loading:
      orgPolicyResult.type !== 'complete' || productPolicyState.loading,
    saving: productPolicyState.saving,
    error: productPolicyState.error,
    setChatPolicy,
    updateComplianceFlag,
    setEnforcedMode,
  }
}

export { readOrgProductPolicy, toMutableOrgProductPolicyInput }
