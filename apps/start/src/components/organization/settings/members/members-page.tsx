'use client'

import { useMemo } from 'react'
import { cn } from '@rift/utils'
import { DataTable, type DataTableColumnDef } from '@rift/ui/data-table'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Badge } from '@rift/ui/badge'

import { ContentPage } from '@/components/layout'
import { MEMBERS_DIRECTORY_PAGE_SIZE } from '@/integrations/zero/queries/org-settings.queries'
import { useMembersPageLogic, type MemberRow } from './members-page.logic'
import { InviteMembersDialog } from './invite-members-dialog'

/** Maps member role to Badge variant and optional custom classes for visual hierarchy. */
function getRoleBadgeProps(role: string): {
  variant: 'default' | 'secondary' | 'outline'
  className?: string
} {
  const normalized = role.toLowerCase()
  switch (normalized) {
    case 'owner':
      return { variant: 'default' }
    case 'admin':
      return { variant: 'outline', className: 'border-content-info/40 bg-bg-info/25 text-content-info' }
    case 'member':
      return { variant: 'outline' }
    default:
      return { variant: 'secondary' }
  }
}

function getStatusBadgeProps(status: MemberRow['status']): {
  variant: 'default' | 'secondary' | 'outline'
  className?: string
} {
  switch (status) {
    case 'pending':
      return {
        variant: 'outline',
        className: 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-400',
      }
    case 'active':
      return {
        variant: 'outline',
        className: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
      }
    case 'inactive':
    default:
      return { variant: 'secondary' }
  }
}

const MEMBERS_COLUMNS: Array<DataTableColumnDef<MemberRow>> = [
  {
    accessorKey: 'name',
    header: () => <span className="pl-11">User</span>,
    cell: ({ row }) => {
      const member = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={member.avatarUrl} alt={member.name} />
            <AvatarFallback>{member.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-content-default">{member.name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <span className="text-content-subtle">{row.getValue('email')}</span>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => {
      const role = String(row.getValue('role'))
      const { variant, className } = getRoleBadgeProps(role)
      return (
        <Badge variant={variant} className={cn('capitalize', className)}>
          {role}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as MemberRow['status']
      const { variant, className } = getStatusBadgeProps(status)
      return (
        <Badge
          variant={variant}
          className={cn('rounded-full px-2 py-0.5 capitalize', className)}
        >
          {status}
        </Badge>
      )
    },
  },
]

export function MembersPage() {
  const {
    data,
    isLoading,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
  } = useMembersPageLogic()

  const serverPagination = useMemo(
    () => ({
      hasNextPage,
      hasPreviousPage,
      onNextPage: nextPage,
      onPreviousPage: previousPage,
    }),
    [hasNextPage, hasPreviousPage, nextPage, previousPage],
  )

  return (
    <ContentPage
      title="Members"
      description="Manage organization members, pending invitations, permissions, and access status."
    >
      <DataTable
        data={data}
        isLoading={isLoading}
        columns={MEMBERS_COLUMNS}
        pageSize={MEMBERS_DIRECTORY_PAGE_SIZE}
        serverPagination={serverPagination}
        filterColumn="name"
        filterPlaceholder="Filter members..."
        messages={{
          columns: 'Columns',
          noResults: 'No members or pending invitations found.',
          loading: 'Loading members and invitations...',
          previous: 'Previous',
          next: 'Next',
          rowsSelected: 'row(s) selected.',
        }}
        tableWrapperClassName="border-border-default bg-bg-default/95"
        toolbarActionsRight={<InviteMembersDialog />}
      />
    </ContentPage>
  )
}
