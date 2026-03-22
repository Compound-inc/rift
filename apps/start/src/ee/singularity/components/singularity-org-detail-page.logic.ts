'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { getWorkspacePlan } from '@/lib/shared/access-control'
import type { WorkspacePlanId } from '@/lib/shared/access-control'
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
  isPending: boolean
  activePlanName: string
  setInviteEmail: (value: string) => void
  setInviteRole: (value: SingularityRole) => void
  setSelectedPlan: (value: WorkspacePlanId) => void
  handleInvite: () => void
  handleRoleChange: (memberId: string, role: SingularityRole) => void
  handleRemoveMember: (memberId: string) => void
  handleCancelInvitation: (invitationId: string) => void
  handleSetPlan: () => void
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
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
  const [isPending, startTransition] = useTransition()

  const activePlanName = useMemo(
    () => getWorkspacePlan(organization.planId).name,
    [organization.planId],
  )

  const refreshRoute = async () => {
    await router.invalidate()
  }

  const handleInvite = () => {
    startTransition(() => {
      void (async () => {
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
      })()
    })
  }

  const handleRoleChange = (memberId: string, role: SingularityRole) => {
    startTransition(() => {
      void (async () => {
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
      })()
    })
  }

  const handleRemoveMember = (memberId: string) => {
    startTransition(() => {
      void (async () => {
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
      })()
    })
  }

  const handleCancelInvitation = (invitationId: string) => {
    startTransition(() => {
      void (async () => {
        try {
          await cancelInvitationFn({
            data: { invitationId },
          })
          toast.success('Invitation cancelled.')
          await refreshRoute()
        } catch (error) {
          toast.error(toErrorMessage(error, 'Failed to cancel invitation.'))
        }
      })()
    })
  }

  const handleSetPlan = () => {
    startTransition(() => {
      void (async () => {
        try {
          await setPlanFn({
            data: {
              organizationId: organization.organizationId,
              planId: selectedPlan,
            },
          })
          toast.success('Plan override applied.')
          await refreshRoute()
        } catch (error) {
          toast.error(toErrorMessage(error, 'Failed to update plan.'))
        }
      })()
    })
  }

  return {
    inviteEmail,
    inviteRole,
    selectedPlan,
    isPending,
    activePlanName,
    setInviteEmail,
    setInviteRole,
    setSelectedPlan,
    handleInvite,
    handleRoleChange,
    handleRemoveMember,
    handleCancelInvitation,
    handleSetPlan,
  }
}
