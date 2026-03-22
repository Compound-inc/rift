'use client'

import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { DataTable } from '@rift/ui/data-table'
import type { DataTableColumnDef } from '@rift/ui/data-table'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Badge } from '@rift/ui/badge'
import { Button } from '@rift/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rift/ui/dropdown-menu'
import { ArrowUpDown, MoreVertical } from 'lucide-react'
import { ContentPage } from '@/components/layout'
import type { SingularityOrganizationListItem } from '@/ee/singularity/shared/singularity-admin'
import { useSingularityOrgListPageLogic } from './singularity-org-list-page.logic'
import type { SingularityOrganizationListRow } from './singularity-org-list-page.logic'

function SortableHeader({
  label,
  onToggle,
}: {
  label: string
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      className="-ml-2 h-8 px-2"
      onClick={onToggle}
    >
      {label}
      <ArrowUpDown className="ml-1 size-3.5" aria-hidden />
    </Button>
  )
}

export function SingularityOrgListPage({
  organizations,
}: {
  organizations: Array<SingularityOrganizationListItem>
}) {
  const { rows, hasOrganizations } = useSingularityOrgListPageLogic(organizations)
  const columns = useMemo<Array<DataTableColumnDef<SingularityOrganizationListRow>>>(
    () => [
      {
        accessorKey: 'name',
        /**
         * Keep the organization identifier out of the visible table while still
         * searchable from the toolbar by extending this column's filter payload.
         */
        filterFn: (row, columnId, filterValue) => {
          const query = String(filterValue ?? '').trim().toLowerCase()
          if (query.length === 0) return true
          const name = String(row.getValue(columnId) ?? '').toLowerCase()
          const organizationId = row.original.organizationId.toLowerCase()
          return name.includes(query) || organizationId.includes(query)
        },
        header: ({ column }) => (
          <SortableHeader
            label="Organization"
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ row }) => {
          const organization = row.original
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={organization.logo ?? undefined} alt={organization.name} />
                <AvatarFallback>{organization.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground-primary">
                  {organization.name}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'planName',
        header: ({ column }) => (
          <SortableHeader
            label="Plan"
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ row }) => <Badge variant="outline">{row.original.planName}</Badge>,
      },
      {
        accessorKey: 'subscriptionStatusLabel',
        header: ({ column }) => (
          <SortableHeader
            label="Status"
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{row.original.subscriptionStatusLabel}</Badge>
            {row.original.isOverSeatLimit ? (
              <Badge variant="destructive">Over limit</Badge>
            ) : null}
            {row.original.usageSyncStatus === 'degraded' ? (
              <Badge variant="outline">Quota sync</Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'seatUsage',
        header: ({ column }) => (
          <SortableHeader
            label="Seats"
            onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
      },
      {
        id: 'actions',
        header: () => null,
        /**
         * Keep the trailing action control right-aligned and width-stable so
         * sorting/filtering does not cause action-button jitter.
         */
        meta: {
          headerClassName: 'w-10 whitespace-nowrap text-right pr-2',
          cellClassName: 'w-10 whitespace-nowrap text-right pr-2',
        },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSmall"
                    className="size-8 rounded-md"
                    aria-label={`Actions for ${row.original.name}`}
                  >
                    <MoreVertical className="size-4" aria-hidden />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" sideOffset={6} className="min-w-40">
                <DropdownMenuItem>
                  <Link
                    className="block w-full"
                    to="/singularity/orgs/$organizationId"
                    params={{ organizationId: row.original.organizationId }}
                  >
                    Open profile
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <ContentPage className="lg:pt-6">
      <DataTable
        data={rows}
        columns={columns}
        pageSize={50}
        filterColumn="name"
        filterPlaceholder="Filter organizations..."
        messages={{
          columns: 'Columns',
          noResults: hasOrganizations ? 'No organizations match the current filter.' : 'No organizations found.',
          loading: 'Loading organizations...',
          previous: 'Previous',
          next: 'Next',
          rowsSelected: 'row(s) selected.',
        }}
        tableWrapperClassName="border-border-base bg-surface-base/95"
      />
    </ContentPage>
  )
}
