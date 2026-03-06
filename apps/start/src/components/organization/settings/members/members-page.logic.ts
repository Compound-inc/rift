'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import {
  getDefaultAuthDisplayName,
  normalizeEmailAddress,
} from '@/components/auth/auth-shared'
import { authClient } from '@/lib/auth/auth-client'
import { queries } from '@/integrations/zero'
import { MEMBERS_DIRECTORY_PAGE_SIZE } from '@/integrations/zero/queries/org-settings.queries'

export type MemberRow = {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'pending'
  avatarUrl?: string
  /** Set only for active members; used for "View profile" link. */
  userId?: string
}

export type OrgMemberDirectoryEntry = {
  id: string
  organizationId: string
  userId: string
  role: string
  user?: {
    id: string
    name: string
    email: string
    image?: string | null
  } | null
}

export type OrgDirectoryRow = {
  id: string
  members?: Array<OrgMemberDirectoryEntry>
  invitations?: Array<OrgInvitationDirectoryEntry>
}

export type OrgInvitationDirectoryEntry = {
  id: string
  organizationId: string
  email: string
  role: string
  status: string
}

const ROLE_PRIORITY: Record<string, number> = {
  owner: 0,
  admin: 1,
  member: 2,
}

function sortMembers(left: MemberRow, right: MemberRow): number {
  const leftPriority = ROLE_PRIORITY[left.role.toLowerCase()] ?? Number.MAX_SAFE_INTEGER
  const rightPriority = ROLE_PRIORITY[right.role.toLowerCase()] ?? Number.MAX_SAFE_INTEGER

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority
  }

  return left.name.localeCompare(right.name)
}

/**
 * Transforms active organization memberships into stable table rows.
 */
function toActiveMemberRows(members: Array<OrgMemberDirectoryEntry>): Array<MemberRow> {
  return members
    .map((member) => {
      const user = member.user
      const fallbackName = user?.email?.trim() || 'Unknown user'
      const name = user?.name?.trim() || fallbackName

      return {
        id: member.id,
        name,
        email: user?.email?.trim() || 'Unknown email',
        role: member.role,
        status: 'active' as const,
        avatarUrl: user?.image ?? undefined,
        userId: member.userId ?? member.user?.id,
      } satisfies MemberRow
    })
    .sort(sortMembers)
}

/**
 * Pending invitations do not have a user record yet, so we derive the same row
 * shape from the invitation payload and keep the email as the primary identity.
 */
function toPendingInvitationRows(
  invitations: Array<OrgInvitationDirectoryEntry>,
  activeMembers: Array<OrgMemberDirectoryEntry>,
): Array<MemberRow> {
  const activeEmails = new Set(
    activeMembers
      .map((member) => member.user?.email)
      .filter((value): value is string => Boolean(value))
      .map(normalizeEmailAddress),
  )

  return invitations
    .map((invitation) => {
      const email = normalizeEmailAddress(invitation.email)
      return {
        id: invitation.id,
        name: getDefaultAuthDisplayName(email),
        email,
        role: invitation.role,
        status: 'pending' as const,
      } satisfies MemberRow
    })
    .filter((invitation) => !activeEmails.has(invitation.email))
    .sort(sortMembers)
}

export type MembersPageLogicResult = {
  data: Array<MemberRow>
  isLoading: boolean
  hasNextPage: boolean
  hasPreviousPage: boolean
  nextPage: () => void
  previousPage: () => void
  onUpdateRole: (memberId: string, role: string) => Promise<void>
  onRemoveMember: (memberId: string) => Promise<void>
  onCancelInvitation: (invitationId: string) => Promise<void>
  actionInProgressId: string | null
}

export function useMembersPageLogic(): MembersPageLogicResult {
  const [isPending, startTransition] = useTransition()
  const [pageIndex, setPageIndex] = React.useState(0)
  const [cursors, setCursors] = React.useState<Array<string | null>>([])

  const queryArgs = React.useMemo(() => {
    if (pageIndex === 0) return {}
    const cursorId = cursors[pageIndex - 1]
    return cursorId ? { cursor: { id: cursorId } } : {}
  }, [pageIndex, cursors])

  const [directory, directoryResult] = useQuery(
    queries.orgSettings.membersDirectory(queryArgs),
  )

  const rawMembers = React.useMemo(
    () => (directory as OrgDirectoryRow | undefined | null)?.members ?? [],
    [directory],
  )
  const rawInvitations = React.useMemo(
    () => (directory as OrgDirectoryRow | undefined | null)?.invitations ?? [],
    [directory],
  )

  const activeRows = React.useMemo(() => toActiveMemberRows(rawMembers), [rawMembers])
  const pendingInvitationRows = React.useMemo(
    () => toPendingInvitationRows(rawInvitations, rawMembers),
    [rawInvitations, rawMembers],
  )

  /**
   * The Zero query still pages the canonical `member` relation. To avoid a
   * second query while surfacing pending invites, page 1 reserves visible rows
   * for invitations and advances the member cursor only past the active members
   * that were actually rendered on that first page.
   */
  const visibleActiveRows = React.useMemo(() => {
    if (pageIndex !== 0) {
      return activeRows
    }

    const remainingSlots = Math.max(
      MEMBERS_DIRECTORY_PAGE_SIZE - pendingInvitationRows.length,
      0,
    )
    return activeRows.slice(0, remainingSlots)
  }, [activeRows, pageIndex, pendingInvitationRows.length])

  const serverData = React.useMemo(() => {
    if (pageIndex !== 0) {
      return visibleActiveRows
    }

    return [...pendingInvitationRows, ...visibleActiveRows]
  }, [pageIndex, pendingInvitationRows, visibleActiveRows])

  const [optimisticRemovedIds, setOptimisticRemovedIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [optimisticRoleUpdates, setOptimisticRoleUpdates] = React.useState<Map<string, string>>(
    () => new Map(),
  )

  const data = React.useMemo(() => {
    return serverData
      .filter((row) => !optimisticRemovedIds.has(row.id))
      .map((row) => {
        const overriddenRole = optimisticRoleUpdates.get(row.id)
        if (overriddenRole == null) return row
        return { ...row, role: overriddenRole }
      })
  }, [serverData, optimisticRemovedIds, optimisticRoleUpdates])

  React.useEffect(() => {
    setOptimisticRoleUpdates((prev) => {
      if (prev.size === 0) return prev
      const next = new Map(prev)
      for (const [memberId, role] of prev) {
        const row = serverData.find((r) => r.id === memberId)
        if (row != null && row.role === role) {
          next.delete(memberId)
        }
      }
      return next.size === prev.size ? prev : next
    })
  }, [serverData])

  const isLoading = directoryResult.type !== 'complete' || isPending

  const hasNextPage =
    pageIndex === 0
      ? rawMembers.length > visibleActiveRows.length
      : rawMembers.length >= MEMBERS_DIRECTORY_PAGE_SIZE
  const hasPreviousPage = pageIndex > 0

  const nextCursor = React.useMemo(() => {
    if (!hasNextPage) {
      return null
    }

    return visibleActiveRows[visibleActiveRows.length - 1]?.id ?? null
  }, [hasNextPage, visibleActiveRows])

  React.useEffect(() => {
    setCursors((current) => {
      if (current[pageIndex] === nextCursor) {
        return current
      }

      const next = current.slice(0, pageIndex)
      next[pageIndex] = nextCursor
      return next
    })
  }, [nextCursor, pageIndex])

  const nextPage = React.useCallback(() => {
    if (hasNextPage) {
      startTransition(() => setPageIndex((p) => p + 1))
    }
  }, [hasNextPage, startTransition])

  const previousPage = React.useCallback(() => {
    if (hasPreviousPage) {
      startTransition(() => setPageIndex((p) => p - 1))
    }
  }, [hasPreviousPage, startTransition])

  const [actionInProgressId, setActionInProgressId] = React.useState<string | null>(null)

  const onUpdateRole = React.useCallback(async (memberId: string, role: string) => {
    setActionInProgressId(memberId)
    setOptimisticRoleUpdates((prev) => new Map(prev).set(memberId, role))
    try {
      const { error } = await authClient.organization.updateMemberRole({ memberId, role })
      if (error) {
        setOptimisticRoleUpdates((prev) => {
          const next = new Map(prev)
          next.delete(memberId)
          return next
        })
        toast.error(error.message ?? 'Failed to update role.')
        return
      }
      toast.success('Role updated.')
    } catch (err) {
      setOptimisticRoleUpdates((prev) => {
        const next = new Map(prev)
        next.delete(memberId)
        return next
      })
      toast.error(err instanceof Error ? err.message : 'Failed to update role.')
    } finally {
      setActionInProgressId(null)
    }
  }, [])

  const onRemoveMember = React.useCallback(async (memberId: string) => {
    setActionInProgressId(memberId)
    setOptimisticRemovedIds((prev) => new Set(prev).add(memberId))
    try {
      const { error } = await authClient.organization.removeMember({ memberIdOrEmail: memberId })
      if (error) {
        setOptimisticRemovedIds((prev) => {
          const next = new Set(prev)
          next.delete(memberId)
          return next
        })
        toast.error(error.message ?? 'Failed to remove member.')
        return
      }
      toast.success('Member removed.')
    } catch (err) {
      setOptimisticRemovedIds((prev) => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
      toast.error(err instanceof Error ? err.message : 'Failed to remove member.')
    } finally {
      setActionInProgressId(null)
    }
  }, [])

  const onCancelInvitation = React.useCallback(async (invitationId: string) => {
    setActionInProgressId(invitationId)
    setOptimisticRemovedIds((prev) => new Set(prev).add(invitationId))
    try {
      const { error } = await authClient.organization.cancelInvitation({ invitationId })
      if (error) {
        setOptimisticRemovedIds((prev) => {
          const next = new Set(prev)
          next.delete(invitationId)
          return next
        })
        toast.error(error.message ?? 'Failed to cancel invitation.')
        return
      }
      toast.success('Invitation cancelled.')
    } catch (err) {
      setOptimisticRemovedIds((prev) => {
        const next = new Set(prev)
        next.delete(invitationId)
        return next
      })
      toast.error(err instanceof Error ? err.message : 'Failed to cancel invitation.')
    } finally {
      setActionInProgressId(null)
    }
  }, [])

  return {
    data,
    isLoading,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    onUpdateRole,
    onRemoveMember,
    onCancelInvitation,
    actionInProgressId,
  }
}
