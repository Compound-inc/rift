import { useCallback, useMemo, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { AI_CATALOG, AI_MODELS_BY_PROVIDER } from '@/lib/ai-catalog'
import { evaluateModelAvailability } from '@/lib/model-policy/policy-engine'
import { mutators, queries } from '@/integrations/zero'
import type { ProviderPolicyUpdateAction, PolicyPayload } from './types'

/**
 * Builds the page payload from the org policy row + static model catalog.
 * This keeps UI rendering deterministic while letting policy updates stream via Zero.
 */
function buildPolicyPayload(input: {
  policyRow?: {
    orgWorkosId?: string
    disabledProviderIds?: readonly string[]
    disabledModelIds?: readonly string[]
    complianceFlags?: Record<string, boolean>
    updatedAt?: number
  } | null
}): PolicyPayload {
  const policy = {
    disabledProviderIds: [...(input.policyRow?.disabledProviderIds ?? [])],
    disabledModelIds: [...(input.policyRow?.disabledModelIds ?? [])],
    complianceFlags: { ...(input.policyRow?.complianceFlags ?? {}) },
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
          orgWorkosId: input.policyRow?.orgWorkosId ?? 'unknown-org',
          disabledProviderIds: policy.disabledProviderIds,
          disabledModelIds: policy.disabledModelIds,
          complianceFlags: policy.complianceFlags,
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update policy')
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
