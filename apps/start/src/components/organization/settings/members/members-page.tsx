'use client'

import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@rift/utils'
import { DataTable, type DataTableColumnDef } from '@rift/ui/data-table'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Badge } from '@rift/ui/badge'
import { Button } from '@rift/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@rift/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@rift/ui/tooltip'
import { MoreVertical, UserIcon } from 'lucide-react'

import { ContentPage } from '@/components/layout'
import { useAppAuth } from '@/lib/auth/use-auth'
import { MEMBERS_DIRECTORY_PAGE_SIZE } from '@/integrations/zero/queries/org-settings.queries'
import { useMembersPageLogic, type MemberRow } from './members-page.logic'
import { InviteMembersDialog } from './invite-members-dialog'
import { m } from '@/paraglide/messages.js'

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
      return { variant: 'outline', className: 'border-foreground-info/40 bg-surface-info/25 text-foreground-info' }
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
    case 'restricted':
      return {
        variant: 'outline',
        className: 'border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-400',
      }
    default:
      return { variant: 'secondary' }
  }
}

const SELECTABLE_ROLES: Array<{ value: string; label: () => string }> = [
  { value: 'admin', label: () => m.org_members_role_admin() },
  { value: 'member', label: () => m.org_members_role_member() },
]

type MemberRowActionsProps = {
  row: MemberRow
  data: Array<MemberRow>
  currentUserId: string | null
  onUpdateRole: (memberId: string, role: string) => Promise<void>
  onRemoveMember: (memberId: string) => Promise<void>
  onCancelInvitation: (invitationId: string) => Promise<void>
  actionInProgressId: string | null
}

function MemberRowActions({
  row,
  data,
  currentUserId,
  onUpdateRole,
  onRemoveMember,
  onCancelInvitation,
  actionInProgressId,
}: MemberRowActionsProps) {
  const navigate = useNavigate()
  const member = row
  const isActive = member.status === 'active'
  const isCurrentUser = currentUserId != null && member.userId === currentUserId
  const isLastOwner =
    isActive &&
    member.role.toLowerCase() === 'owner' &&
    data.filter((r) => r.role.toLowerCase() === 'owner').length === 1
  const canDemote = isActive && !isLastOwner
  const actionInProgress = actionInProgressId === member.id

  if (isCurrentUser) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="iconSmall"
        className="size-8 rounded-md opacity-50"
        aria-label={m.org_members_actions_aria({ name: member.name })}
        disabled
      >
        <MoreVertical className="size-4" aria-hidden />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="iconSmall"
            className="size-8 rounded-md"
            aria-label={m.org_members_actions_aria({ name: member.name })}
            disabled={actionInProgress}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-40">
        {isActive && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{m.org_members_change_role()}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={
                  member.role.toLowerCase() === 'owner'
                    ? 'admin'
                    : member.role.toLowerCase()
                }
                onValueChange={(role) => void onUpdateRole(member.id, role)}
              >
                {SELECTABLE_ROLES.map((r) => (
                  <DropdownMenuRadioItem
                    key={r.value}
                    value={r.value}
                    disabled={!canDemote}
                  >
                    {r.label()}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {isActive && member.userId && (
          <DropdownMenuItem
            onClick={() => {
              const userId = member.userId!
              ;(navigate as unknown as (opts: { to: string; params: { userId: string } }) => void)({
                to: '/user/$userId',
                params: { userId },
              })
            }}
            className="cursor-pointer"
          >
            <UserIcon className="size-4" aria-hidden />
            {m.org_members_view_profile()}
          </DropdownMenuItem>
        )}
        {isActive && (
          <DropdownMenuItem
            variant="destructive"
            disabled={isLastOwner || actionInProgress}
            onClick={() => void onRemoveMember(member.id)}
          >
            {m.org_members_remove_member()}
          </DropdownMenuItem>
        )}
        {!isActive && (
          <DropdownMenuItem
            variant="destructive"
            disabled={actionInProgress}
            onClick={() => void onCancelInvitation(member.id)}
          >
            {m.org_members_cancel_invitation()}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const MEMBERS_COLUMNS_BASE: Array<DataTableColumnDef<MemberRow>> = [
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
          <span className="font-medium text-foreground-primary">{member.name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <span className="text-foreground-tertiary">{row.getValue('email')}</span>
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
      const member = row.original
      const status = member.status
      const { variant, className } = getStatusBadgeProps(status)
      const badge = (
        <Badge
          variant={variant}
          className={cn('w-fit rounded-full px-2 py-0.5 capitalize', className)}
        >
          {status}
        </Badge>
      )

      const tooltipContent =
        status === 'restricted'
          ? member.statusDetail ?? 'Access is restricted.'
          : status === 'pending'
            ? 'Invitation has not been accepted yet.'
            : null

      if (tooltipContent) {
        return (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex cursor-help">{badge}</span>} />
            <TooltipContent side="top" sideOffset={4} className="first-letter:uppercase">
              {tooltipContent}
            </TooltipContent>
          </Tooltip>
        )
      }

      return badge
    },
  },
]

export function MembersPage() {
  const { user } = useAppAuth()
  const {
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

  const currentUserId = user?.id ?? null

  const columns = useMemo<Array<DataTableColumnDef<MemberRow>>>(
    () => [
      ...MEMBERS_COLUMNS_BASE,
      {
        id: 'actions',
        header: () => null,
        meta: {
          headerClassName: 'w-10 whitespace-nowrap text-right pr-2',
          cellClassName: 'w-10 whitespace-nowrap text-right pr-2',
        },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <MemberRowActions
              row={row.original}
              data={data}
              currentUserId={currentUserId}
              onUpdateRole={onUpdateRole}
              onRemoveMember={onRemoveMember}
              onCancelInvitation={onCancelInvitation}
              actionInProgressId={actionInProgressId}
            />
          </div>
        ),
      },
    ],
    [
      data,
      currentUserId,
      onUpdateRole,
      onRemoveMember,
      onCancelInvitation,
      actionInProgressId,
    ],
  )

  return (
    <ContentPage
      title="Members"
      description="Manage organization members, pending invitations, permissions, and access status."
    >
      <DataTable
        data={data}
        isLoading={isLoading}
        columns={columns}
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
        tableWrapperClassName="border-border-base bg-surface-base/95"
        toolbarActionsRight={<InviteMembersDialog />}
      />
    </ContentPage>
  )
}
