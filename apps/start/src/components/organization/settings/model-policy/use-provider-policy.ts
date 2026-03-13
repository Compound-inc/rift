import { useCallback, useMemo, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { AI_CATALOG, AI_MODELS_BY_PROVIDER } from '@/lib/shared/ai-catalog'
import { TOOL_CATALOG } from '@/lib/shared/ai-catalog/tool-catalog'
import { evaluateModelAvailability } from '@/lib/shared/model-policy/policy-engine'
import { mutators, queries } from '@/integrations/zero'
import type { ProviderPolicyUpdateAction, PolicyPayload } from './types'

/**
 * Builds the page payload from the org policy row + static model catalog.
 * This keeps UI rendering deterministic while letting policy updates stream via Zero.
 */
function buildPolicyPayload(input: {
  policyRow?: {
    organizationId?: string
    disabledProviderIds?: readonly string[]
    disabledModelIds?: readonly string[]
    complianceFlags?: Record<string, boolean>
    providerNativeToolsEnabled?: boolean | null
    externalToolsEnabled?: boolean | null
    disabledToolKeys?: readonly string[]
    orgKnowledgeEnabled?: boolean | null
    enforcedModeId?: string | null
    updatedAt?: number
  } | null
}): PolicyPayload {
  const policy = {
    disabledProviderIds: [...(input.policyRow?.disabledProviderIds ?? [])],
    disabledModelIds: [...(input.policyRow?.disabledModelIds ?? [])],
    complianceFlags: { ...(input.policyRow?.complianceFlags ?? {}) },
    toolPolicy: {
      providerNativeToolsEnabled: input.policyRow?.providerNativeToolsEnabled ?? true,
      externalToolsEnabled: input.policyRow?.externalToolsEnabled ?? true,
      disabledToolKeys: [...(input.policyRow?.disabledToolKeys ?? [])],
    },
    enforcedModeId: input.policyRow?.enforcedModeId ?? undefined,
    updatedAt: input.policyRow?.updatedAt,
  }

  return {
    policy,
    providers: [...AI_MODELS_BY_PROVIDER.keys()].map((providerId) => ({
      id: providerId,
      disabled: policy.disabledProviderIds.includes(providerId),
    })),
    models: AI_CATALOG.map((model) => {
      const decision = evaluateModelAvailability({
        model,
        policy: {
          organizationId: input.policyRow?.organizationId ?? 'unknown-org',
          disabledProviderIds: policy.disabledProviderIds,
          disabledModelIds: policy.disabledModelIds,
          complianceFlags: policy.complianceFlags,
          toolPolicy: policy.toolPolicy,
          orgKnowledgeEnabled: input.policyRow?.orgKnowledgeEnabled ?? false,
          updatedAt: policy.updatedAt ?? Date.now(),
        },
      })
      return {
        id: model.id,
        name: model.name,
        providerId: model.providerId,
        description: model.description,
        zeroDataRetention: model.zeroDataRetention,
        disabled: !decision.allowed,
        deniedBy: [...decision.deniedBy],
      }
    }),
    tools: TOOL_CATALOG.map((tool) => ({
      key: tool.key,
      providerId: tool.providerId,
      advanced: tool.advanced,
      source: tool.source,
      disabled:
        !(
          tool.source === 'provider-native'
            ? policy.toolPolicy.providerNativeToolsEnabled
            : policy.toolPolicy.externalToolsEnabled
        ) ||
        policy.toolPolicy.disabledToolKeys.includes(tool.key),
    })),
  }
}

/** Zero-backed hook for loading and mutating org provider/model policy in realtime. */
export function useProviderPolicy() {
  const z = useZero()
  const [policyRow, policyResult] = useQuery(queries.orgPolicy.current())
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const payload = useMemo(() => buildPolicyPayload({ policyRow }), [policyRow])

  const update = useCallback(
    async (body: ProviderPolicyUpdateAction) => {
      setUpdating(true)
      setError(null)
      try {
        if (body.action === 'toggle_provider') {
          await z.mutate(
            mutators.orgPolicy.toggleProvider({
              providerId: body.providerId,
              disabled: body.disabled,
            }),
          ).client
        }
        if (body.action === 'toggle_model') {
          await z.mutate(
            mutators.orgPolicy.toggleModel({
              modelId: body.modelId,
              disabled: body.disabled,
            }),
          ).client
        }
        if (body.action === 'toggle_compliance_flag') {
          await z.mutate(
            mutators.orgPolicy.toggleComplianceFlag({
              flag: body.flag,
              enabled: body.enabled,
            }),
          ).client
        }
        if (body.action === 'set_enforced_mode') {
          await z.mutate(
            mutators.orgPolicy.setEnforcedMode({
              modeId: body.modeId,
            }),
          ).client
        }
        if (body.action === 'toggle_provider_native_tools') {
          await z.mutate(
            mutators.orgPolicy.toggleProviderNativeTools({
              enabled: body.enabled,
            }),
          ).client
        }
        if (body.action === 'toggle_external_tools') {
          await z.mutate(
            mutators.orgPolicy.toggleExternalTools({
              enabled: body.enabled,
            }),
          ).client
        }
        if (body.action === 'toggle_tool') {
          await z.mutate(
            mutators.orgPolicy.toggleTool({
              toolKey: body.toolKey,
              disabled: body.disabled,
            }),
          ).client
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to update policy'
        setError(message)
        toast.error(message)
      } finally {
        setUpdating(false)
      }
    },
    [z],
  )

  return {
    payload,
    loading: policyResult.type !== 'complete',
    error,
    updating,
    update,
  }
}
