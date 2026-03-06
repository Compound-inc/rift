'use client'

import { DataTable, type DataTableColumnDef } from '@rift/ui/data-table'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Badge } from '@rift/ui/badge'
import { Button } from '@rift/ui/button'
import { UserPlus } from 'lucide-react'

import { ContentPage } from '@/components/layout'
import { useMembersPageLogic, type MemberRow } from './members-page.logic'

const MEMBERS_COLUMNS: Array<DataTableColumnDef<MemberRow>> = [
  {
    accessorKey: 'name',
    header: 'User',
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
      <span className="text-content-muted">{row.getValue('email')}</span>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => (
      <Badge variant="outline" className="rounded-full px-2 py-0.5 capitalize">
        {String(row.getValue('role'))}
      </Badge>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="secondary" className="rounded-full px-2 py-0.5 capitalize">
        {String(row.getValue('status'))}
      </Badge>
    ),
  },
]

export function MembersPage() {
  const { data, isLoading } = useMembersPageLogic()

  return (
    <ContentPage
      title="Members"
      description="Manage organization members, permissions, and access status."
    >
      <DataTable
        data={data}
        isLoading={isLoading}
        columns={MEMBERS_COLUMNS}
        filterColumn="name"
        filterPlaceholder="Filter members..."
        messages={{
          columns: 'Columns',
          noResults: 'Unable to load the member directory.',
          loading: 'Loading members...',
          previous: 'Previous',
          next: 'Next',
          rowsSelected: 'row(s) selected.',
        }}
        tableWrapperClassName="border-border-default bg-bg-default/95"
        toolbarActionsRight={
          <Button variant="default" disabled>
            <UserPlus aria-hidden />
            Invite members
          </Button>
        }
      />
    </ContentPage>
  )
}
