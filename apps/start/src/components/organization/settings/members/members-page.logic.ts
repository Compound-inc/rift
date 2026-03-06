'use client'

import * as React from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@/integrations/zero'

export type MemberRow = {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'pending'
  avatarUrl?: string
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
}

function sortMembers(left: MemberRow, right: MemberRow): number {
  const rolePriority: Record<string, number> = {
    owner: 0,
    admin: 1,
    member: 2,
  }

  const leftPriority = rolePriority[left.role.toLowerCase()] ?? Number.MAX_SAFE_INTEGER
  const rightPriority = rolePriority[right.role.toLowerCase()] ?? Number.MAX_SAFE_INTEGER

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority
  }

  return left.name.localeCompare(right.name)
}

/**
 * Transforms raw directory entries into table rows and sorts them.
 */
function toMemberRows(members: Array<OrgMemberDirectoryEntry>): Array<MemberRow> {
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
      } satisfies MemberRow
    })
    .sort(sortMembers)
}

export type MembersPageLogicResult = {
  data: Array<MemberRow>
  isLoading: boolean
}

/**
 * Fetches the org members directory
 */
export function useMembersPageLogic(): MembersPageLogicResult {
  const [directory, directoryResult] = useQuery(queries.orgSettings.membersDirectory())

  const data = React.useMemo<Array<MemberRow>>(() => {
    const members = (directory as OrgDirectoryRow | undefined | null)?.members ?? []
    return toMemberRows(members)
  }, [directory])

  const isLoading = directoryResult.type !== 'complete'

  return { data, isLoading }
}
