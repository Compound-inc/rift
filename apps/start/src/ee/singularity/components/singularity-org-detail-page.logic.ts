'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import type { ManualBillingInterval } from '@/lib/backend/billing/services/workspace-billing/shared'
import {
  getPlanEffectiveFeatures,
  getWorkspacePlan,
  WORKSPACE_FEATURE_IDS,
} from '@/lib/shared/access-control'
import type {
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '@/lib/shared/access-control'
import type { SingularityOrganizationDetail } from '@/ee/singularity/shared/singularity-admin'
import {
  cancelSingularityInvitation,
  inviteSingularityOrganizationMember,
  removeSingularityOrganizationMember,
  setSingularityOrganizationPlan,
  updateSingularityOrganizationMemberRole,
} from '@/ee/singularity/frontend/singularity.functions'

type SingularityRole = 'admin' | 'member'

export type SingularityOrgDetailPageLogicResult = {
  inviteEmail: string
  inviteRole: SingularityRole
  selectedPlan: WorkspacePlanId
  selectedBillingInterval: ManualBillingInterval | null
  selectedSeatCount: string
  selectedUsageLimitUsd: string
  selectedOverrideReason: string
  selectedInternalNote: string
  selectedBillingReference: string
  selectedFeatureAccess: Record<WorkspaceFeatureId, boolean>
  isSeatCountValid: boolean
  isUsageLimitValid: boolean
  isPending: boolean
  activePlanName: string
  setInviteEmail: (value: string) => void
  setInviteRole: (value: SingularityRole) => void
  setSelectedPlan: (value: WorkspacePlanId) => void
  setSelectedBillingInterval: (value: ManualBillingInterval | null) => void
  setSelectedSeatCount: (value: string) => void
  setSelectedUsageLimitUsd: (value: string) => void
  setSelectedOverrideReason: (value: string) => void
  setSelectedInternalNote: (value: string) => void
  setSelectedBillingReference: (value: string) => void
  setSelectedFeatureAccess: (
    feature: WorkspaceFeatureId,
    value: boolean,
  ) => void
  resetSelectedOverridesToPlanDefaults: () => void
  handleInvite: () => Promise<void>
  handleRoleChange: (memberId: string, role: SingularityRole) => Promise<void>
  handleRemoveMember: (memberId: string) => Promise<void>
  handleCancelInvitation: (invitationId: string) => Promise<void>
  handleSetPlan: () => Promise<void>
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const maybeMessage = 'message' in error ? error.message : null
    const maybeCause = 'cause' in error ? error.cause : null
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
      if (typeof maybeCause === 'string' && maybeCause.trim().length > 0) {
        return `${maybeMessage} ${maybeCause}`
      }
      return maybeMessage
    }
  }

  return fallback
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildFeatureAccessState(
  organization: SingularityOrganizationDetail,
): Record<WorkspaceFeatureId, boolean> {
  return Object.fromEntries(
    WORKSPACE_FEATURE_IDS.map((featureId) => [
      featureId,
      Boolean(organization.effectiveFeatures[featureId]),
    ]),
  ) as Record<WorkspaceFeatureId, boolean>
}

function buildPlanDefaultFeatureAccess(
  planId: WorkspacePlanId,
): Record<WorkspaceFeatureId, boolean> {
  const defaults = getPlanEffectiveFeatures(planId)
  return Object.fromEntries(
    WORKSPACE_FEATURE_IDS.map((featureId) => [featureId, defaults[featureId]]),
  ) as Record<WorkspaceFeatureId, boolean>
}

export function useSingularityOrgDetailPageLogic(
  organization: SingularityOrganizationDetail,
): SingularityOrgDetailPageLogicResult {
  const router = useRouter()
  const inviteMemberFn = useServerFn(inviteSingularityOrganizationMember)
  const removeMemberFn = useServerFn(removeSingularityOrganizationMember)
  const updateMemberRoleFn = useServerFn(
    updateSingularityOrganizationMemberRole,
  )
  const cancelInvitationFn = useServerFn(cancelSingularityInvitation)
  const setPlanFn = useServerFn(setSingularityOrganizationPlan)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<SingularityRole>('member')
  const [selectedPlan, setSelectedPlan] = useState<WorkspacePlanId>(
    organization.planId,
  )
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<ManualBillingInterval | null>(
    organization.billingInterval ?? 'month',
  )
  /**
   * Keep the seat count as raw text so operators can edit naturally while we
   * still validate before submitting the override mutation.
   */
  const [selectedSeatCount, setSelectedSeatCount] = useState<string>(
    String(organization.seatCount),
  )
  const [selectedUsageLimitUsd, setSelectedUsageLimitUsd] = useState<string>(
    organization.usagePolicy.hasCustomMonthlyBudget
      && organization.usagePolicy.organizationMonthlyBudgetUsd != null
      ? String(organization.usagePolicy.organizationMonthlyBudgetUsd)
      : '',
  )
  const [selectedOverrideReason, setSelectedOverrideReason] = useState<string>(
    organization.manualPlanOverride.overrideReason ?? '',
  )
  const [selectedInternalNote, setSelectedInternalNote] = useState<string>(
    organization.manualPlanOverride.internalNote ?? '',
  )
  const [selectedBillingReference, setSelectedBillingReference] = useState<string>(
    organization.manualPlanOverride.billingReference ?? '',
  )
  const [selectedFeatureAccessState, setSelectedFeatureAccessState] = useState<
    Record<WorkspaceFeatureId, boolean>
  >(() => buildFeatureAccessState(organization))
  const [isPending, startTransition] = useTransition()

  const activePlanName = useMemo(
    () => getWorkspacePlan(organization.planId).name,
    [organization.planId],
  )
  const parsedSeatCount = Number.parseInt(selectedSeatCount, 10)
  const isSeatCountValid =
    Number.isFinite(parsedSeatCount) &&
    Number.isInteger(parsedSeatCount) &&
    parsedSeatCount >= 1
  const parsedUsageLimitUsd = selectedUsageLimitUsd.trim().length === 0
    ? null
    : Number(selectedUsageLimitUsd)
  const isUsageLimitValid =
    parsedUsageLimitUsd == null
    || (Number.isFinite(parsedUsageLimitUsd) && parsedUsageLimitUsd >= 0)

  /**
   * Wrap async mutations in a transition while still returning a promise that
   * callers such as dialogs can await for close/reset behavior.
   */
  const runTransitionAction = (action: () => Promise<void>): Promise<void> =>
    new Promise((resolve) => {
      startTransition(() => {
        void (async () => {
          try {
            await action()
          } finally {
            resolve()
          }
        })()
      })
    })

  const refreshRoute = async () => {
    await router.invalidate()
  }

  const handleInvite = () =>
    runTransitionAction(async () => {
      try {
        await inviteMemberFn({
          data: {
            organizationId: organization.organizationId,
            email: inviteEmail,
            role: inviteRole,
          },
        })
        setInviteEmail('')
        setInviteRole('member')
        toast.success('Invitation sent.')
        await refreshRoute()
      } catch (error) {
        toast.error(toErrorMessage(error, 'Failed to invite user.'))
      }
    })

  const handleRoleChange = (memberId: string, role: SingularityRole) =>
    runTransitionAction(async () => {
      try {
        await updateMemberRoleFn({
          data: {
            organizationId: organization.organizationId,
            memberId,
            role,
          },
        })
        toast.success('Member role updated.')
        await refreshRoute()
      } catch (error) {
        toast.error(toErrorMessage(error, 'Failed to update role.'))
      }
    })

  const handleRemoveMember = (memberId: string) =>
    runTransitionAction(async () => {
      try {
        await removeMemberFn({
          data: {
            organizationId: organization.organizationId,
            memberIdOrEmail: memberId,
          },
        })
        toast.success('Member removed.')
        await refreshRoute()
      } catch (error) {
        toast.error(toErrorMessage(error, 'Failed to remove member.'))
      }
    })

  const handleCancelInvitation = (invitationId: string) =>
    runTransitionAction(async () => {
      try {
        await cancelInvitationFn({
          data: { invitationId },
        })
        toast.success('Invitation cancelled.')
        await refreshRoute()
      } catch (error) {
        toast.error(toErrorMessage(error, 'Failed to cancel invitation.'))
      }
    })

  const handleSetPlan = () =>
    runTransitionAction(async () => {
      if (!isSeatCountValid) {
        toast.error('Seat count must be a whole number greater than or equal to 1.')
        return
      }
      if (!isUsageLimitValid) {
        toast.error('Usage limit must be empty or a number greater than or equal to 0.')
        return
      }

      try {
        await setPlanFn({
          data: {
            organizationId: organization.organizationId,
            planId: selectedPlan,
            seatCount: parsedSeatCount,
            billingInterval: selectedBillingInterval,
            monthlyUsageLimitUsd: parsedUsageLimitUsd,
            overrideReason: normalizeOptionalText(selectedOverrideReason),
            internalNote: normalizeOptionalText(selectedInternalNote),
            billingReference: normalizeOptionalText(selectedBillingReference),
            featureOverrides: selectedFeatureAccessState,
          },
        })
        toast.success('Plan override applied.')
        await refreshRoute()
      } catch (error) {
        toast.error(toErrorMessage(error, 'Failed to update plan.'))
      }
    })

  return {
    inviteEmail,
    inviteRole,
    selectedPlan,
    selectedBillingInterval,
    selectedSeatCount,
    selectedUsageLimitUsd,
    selectedOverrideReason,
    selectedInternalNote,
    selectedBillingReference,
    selectedFeatureAccess: selectedFeatureAccessState,
    isSeatCountValid,
    isUsageLimitValid,
    isPending,
    activePlanName,
    setInviteEmail,
    setInviteRole,
    setSelectedPlan,
    setSelectedBillingInterval,
    setSelectedSeatCount,
    setSelectedUsageLimitUsd,
    setSelectedOverrideReason,
    setSelectedInternalNote,
    setSelectedBillingReference,
    setSelectedFeatureAccess: (feature, value) => {
      setSelectedFeatureAccessState((current) => ({
        ...current,
        [feature]: value,
      }))
    },
    resetSelectedOverridesToPlanDefaults: () => {
      setSelectedUsageLimitUsd('')
      setSelectedFeatureAccessState(buildPlanDefaultFeatureAccess(selectedPlan))
    },
    handleInvite,
    handleRoleChange,
    handleRemoveMember,
    handleCancelInvitation,
    handleSetPlan,
  }
}
