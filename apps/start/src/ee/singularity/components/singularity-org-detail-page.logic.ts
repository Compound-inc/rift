'use client'

import { useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/components/auth/auth-shared'
import type {
  SingularityOrganizationDetail,
  SingularityUsageResetMode,
} from '../shared/singularity-admin'
import {
  cancelSingularityInvitation,
  inviteSingularityOrganizationMember,
  removeSingularityOrganizationMember,
  resetSingularityOrganizationUsage,
  setSingularityOrganizationPlan,
  updateSingularityOrganizationMemberRole,
} from '../frontend/singularity.functions'
import {
  buildSingularityPlanInput,
  validateSingularityPlanDraft,
} from './singularity-plan-draft'
import type { SingularityPlanDraft } from './singularity-plan-draft'

type SingularityRole = 'admin' | 'member'

export function useSingularityOrgDetailPageLogic(
  organization: SingularityOrganizationDetail,
) {
  const router = useRouter()
  const invite = useServerFn(inviteSingularityOrganizationMember)
  const remove = useServerFn(removeSingularityOrganizationMember)
  const updateRole = useServerFn(updateSingularityOrganizationMemberRole)
  const cancelInvitation = useServerFn(cancelSingularityInvitation)
  const setPlan = useServerFn(setSingularityOrganizationPlan)
  const resetUsage = useServerFn(resetSingularityOrganizationUsage)
  const [isPending, setIsPending] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const actionInFlight = useRef(false)
  const requiresRefresh = useRef(false)

  /**
   * The ref closes the same-tick double-submit window. Pending lasts through
   * invalidation, and callers receive success explicitly before closing dialogs.
   */
  const runAction = async (
    action: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> => {
    if (actionInFlight.current) return false
    if (requiresRefresh.current) {
      toast.error('Refresh this workspace before making another change.')
      return false
    }
    actionInFlight.current = true
    setIsPending(true)
    try {
      await action()
      toast.success(success)
      try {
        await router.invalidate()
      } catch {
        requiresRefresh.current = true
        setNeedsRefresh(true)
        toast.error(
          'Change saved, but the page could not refresh. Refresh before making another change.',
        )
      }
      return true
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The change could not be saved. Try again.',
      )
      return false
    } finally {
      actionInFlight.current = false
      setIsPending(false)
    }
  }

  return {
    isPending,
    needsRefresh,
    handleRefresh: async () => {
      await router.invalidate()
      requiresRefresh.current = false
      setNeedsRefresh(false)
    },
    handleInvite: async (email: string, role: SingularityRole) => {
      const normalizedEmail = normalizeEmailAddress(email)
      if (
        !isValidEmailAddress(normalizedEmail) ||
        normalizedEmail.length > 320
      ) {
        toast.error('Enter a valid email address.')
        return false
      }
      if (
        organization.members.some(
          (member) => normalizeEmailAddress(member.email) === normalizedEmail,
        ) ||
        organization.invitations.some(
          (invitation) =>
            normalizeEmailAddress(invitation.email) === normalizedEmail &&
            invitation.status === 'pending',
        )
      ) {
        toast.error(
          'This person is already a member or has a pending invitation.',
        )
        return false
      }
      if (
        organization.memberCount + organization.pendingInvitationCount >=
        organization.seatCount
      ) {
        toast.error(
          'Increase seat capacity in Billing before inviting another member.',
        )
        return false
      }
      return runAction(
        () =>
          invite({
            data: {
              organizationId: organization.organizationId,
              email: normalizedEmail,
              role,
            },
          }),
        'Invitation sent.',
      )
    },
    handleRoleChange: (memberId: string, role: SingularityRole) => {
      const member = organization.members.find(
        (entry) => entry.memberId === memberId,
      )
      if (
        !member ||
        member.role.toLowerCase() === 'owner' ||
        member.role === role
      )
        return Promise.resolve(false)
      return runAction(
        () =>
          updateRole({
            data: {
              organizationId: organization.organizationId,
              memberId,
              role,
            },
          }),
        'Member role updated.',
      )
    },
    handleRemoveMember: (memberId: string) => {
      const member = organization.members.find(
        (entry) => entry.memberId === memberId,
      )
      // Ownership stays protected in the UI as well as Better Auth's server checks.
      if (
        !member ||
        (member.role.toLowerCase() === 'owner' &&
          organization.members.filter(
            (entry) => entry.role.toLowerCase() === 'owner',
          ).length <= 1)
      )
        return Promise.resolve(false)
      return runAction(
        () =>
          remove({
            data: {
              organizationId: organization.organizationId,
              memberIdOrEmail: memberId,
            },
          }),
        'Member removed.',
      )
    },
    handleCancelInvitation: (invitationId: string) =>
      runAction(
        () => cancelInvitation({ data: { invitationId } }),
        'Invitation canceled.',
      ),
    handleSetPlan: (draft: SingularityPlanDraft) => {
      const errors = Object.values(validateSingularityPlanDraft(draft))
      if (errors.length) {
        toast.error(errors[0])
        return Promise.resolve(false)
      }
      return runAction(
        () =>
          setPlan({
            data: buildSingularityPlanInput(organization.organizationId, draft),
          }),
        'Plan override applied.',
      )
    },
    handleResetUsage: (mode: SingularityUsageResetMode) =>
      runAction(
        () =>
          resetUsage({
            data: { organizationId: organization.organizationId, mode },
          }),
        mode === 'fresh_cycle'
          ? 'Usage cycle restarted.'
          : 'Current cycle usage reset.',
      ),
  }
}

export type SingularityOrgActions = ReturnType<
  typeof useSingularityOrgDetailPageLogic
>
