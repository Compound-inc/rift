'use client'

import * as React from 'react'
import { DataTable, type DataTableColumnDef } from '@rift/ui/data-table'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Badge } from '@rift/ui/badge'
import { Button } from '@rift/ui/button'
import { UserPlus } from 'lucide-react'

import { ContentPage } from '@/components/layout'

type MemberRow = {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'pending'
}

const MEMBERS_COLUMNS: Array<DataTableColumnDef<MemberRow>> = [
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) => {
      const member = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={undefined} alt={member.name} />
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

/**
 * Members settings page scaffold.
 * The first implementation intentionally renders an empty table while preserving
 * the final structure (toolbar, controls, pagination, and columns) so data can
 * be connected later without replacing UI primitives.
 */
export function MembersPage() {
  const data = React.useMemo<Array<MemberRow>>(() => [], [])

  return (
    <ContentPage
      title="Members"
      description="Manage organization members, permissions, and access status."
    >
      <DataTable
        data={data}
        columns={MEMBERS_COLUMNS}
        filterColumn="name"
        filterPlaceholder="Filter members..."
        messages={{
          columns: 'Columns',
          noResults: 'No members found.',
          loading: 'Loading members...',
          previous: 'Previous',
          next: 'Next',
          rowsSelected: 'row(s) selected.',
        }}
        tableWrapperClassName="border-border-default bg-bg-default/95"
        toolbarActionsRight={
          <Button variant="default">
            <UserPlus aria-hidden />
            Invite members
          </Button>
        }
      />
    </ContentPage>
  )
}
