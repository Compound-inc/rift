'use client'

import { useMemo, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rift/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rift/ui/table'
import {
  ArrowRight,
  CircleAlert,
  Download,
  RefreshCw,
  Users,
} from 'lucide-react'
import { cn } from '@rift/utils'
import { toast } from 'sonner'
import { ContentPage } from '@/components/layout'
import type { SingularityUserListItem } from '../shared/singularity-admin'
import type { SingularityUserSearch } from './singularity-users-page.logic'
import {
  hasRestrictedMembership,
  selectSingularityUsers,
} from './singularity-users-page.logic'
import { downloadSingularityCsv } from './singularity-export'
import { formatSingularityDate } from './singularity-format'
import {
  SingularityEmpty,
  SingularityPagination,
  SingularitySearch,
  SingularityStatus,
} from './singularity-ui'
import { SingularityUserDialog } from './singularity-user-dialog'

export function SingularityUsersPage({
  users,
  search,
  onSearchChange,
}: {
  users: Array<SingularityUserListItem>
  search: SingularityUserSearch
  onSearchChange: (patch: SingularityUserSearch, replace?: boolean) => void
}) {
  const { rows, matching, page, pageCount, summary } = useMemo(
    () => selectSingularityUsers(users, search),
    [users, search],
  )
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const hasFilters = Boolean(search.q || search.status || search.role)
  const clearFilters = () =>
    onSearchChange({ q: undefined, status: undefined, role: undefined })
  const openUser = (userId: string) => onSearchChange({ user: userId })
  return (
    <ContentPage className="pb-6 lg:pt-7">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground-tertiary">
              <Users className="size-3.5" aria-hidden />
              Singularity
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground-strong">
              Users
            </h1>
            <p className="mt-1 text-sm text-foreground-tertiary">
              Find registered accounts across workspaces and manage their
              memberships.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="large"
              className="gap-2"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true)
                try {
                  await router.invalidate()
                  toast.success('Users refreshed.')
                } catch {
                  toast.error('Could not refresh users.')
                } finally {
                  setRefreshing(false)
                }
              }}
            >
              <RefreshCw
                className={cn(
                  'size-4',
                  refreshing && 'motion-safe:animate-spin',
                )}
                aria-hidden
              />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="large"
              className="gap-2"
              disabled={!matching.length}
              onClick={() =>
                downloadSingularityCsv('singularity-users.csv', [
                  [
                    'Name',
                    'Email',
                    'User ID',
                    'Email verified',
                    'Registered',
                    'Workspaces',
                  ],
                  ...matching.map((user) => [
                    user.name,
                    user.email,
                    user.userId,
                    user.emailVerified ? 'Yes' : 'No',
                    new Date(user.createdAt).toISOString(),
                    user.memberships
                      .map(
                        (membership) =>
                          `${membership.organizationName} (${membership.role}, ${membership.accessStatus})`,
                      )
                      .join('; '),
                  ]),
                ])
              }
            >
              <Download aria-hidden />
              Export
            </Button>
          </div>
        </header>
        <div
          aria-label="User account views"
          className="flex flex-wrap gap-2 rounded-xl border border-border-base bg-surface-raised p-2"
        >
          {[
            { label: 'All accounts', count: summary.total, status: undefined },
            {
              label: 'Restricted access',
              count: summary.restricted,
              status: 'restricted' as const,
            },
            {
              label: 'Unverified email',
              count: summary.unverified,
              status: 'unverified' as const,
            },
            {
              label: 'Without workspace',
              count: summary.noWorkspace,
              status: 'no_workspace' as const,
            },
          ].map((view) => (
            <Button
              key={view.label}
              type="button"
              variant="ghost"
              size="large"
              className={cn(
                'gap-2 text-sm',
                search.status === view.status &&
                  'bg-surface-info/25 text-foreground-info',
              )}
              aria-pressed={search.status === view.status}
              onClick={() => onSearchChange({ status: view.status })}
            >
              {view.label}
              <span className="rounded-md bg-surface-inverse/5 px-1.5 py-0.5 text-[11px] tabular-nums">
                {view.count}
              </span>
            </Button>
          ))}
        </div>
        <section aria-label="Global user directory" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SingularitySearch
              label="Search users"
              placeholder="Search name, email, user ID, or workspace…"
              value={search.q ?? ''}
              onChange={(q) => onSearchChange({ q: q || undefined }, true)}
            />
            <Select
              value={search.role ?? 'all'}
              onValueChange={(value) =>
                onSearchChange({
                  role:
                    value === 'all'
                      ? undefined
                      : (value as SingularityUserSearch['role']),
                })
              }
            >
              <SelectTrigger
                className="h-10 min-w-32"
                aria-label="Filter users by workspace role"
              >
                <SelectValue>
                  {search.role
                    ? search.role.charAt(0).toUpperCase() + search.role.slice(1)
                    : 'All roles'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={search.sort ?? 'name'}
              onValueChange={(value) =>
                onSearchChange({ sort: value as SingularityUserSearch['sort'] })
              }
            >
              <SelectTrigger className="h-10 min-w-36" aria-label="Sort users">
                <SelectValue>
                  {
                    {
                      name: 'Name A–Z',
                      recent: 'Newest accounts',
                      workspaces: 'Most workspaces',
                    }[search.sort ?? 'name']
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="recent">Newest accounts</SelectItem>
                <SelectItem value="workspaces">Most workspaces</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <div className="flex items-center justify-between gap-3 text-xs text-foreground-tertiary">
              <span role="status">
                {matching.length} matching account
                {matching.length === 1 ? '' : 's'}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-10 text-xs"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-border-base">
            {!rows.length ? (
              <SingularityEmpty
                title={
                  users.length
                    ? 'No matching users'
                    : 'No registered accounts yet'
                }
                description={
                  users.length
                    ? 'Try another name, email, or workspace, or clear the filters.'
                    : 'Registered accounts will appear here. Guest sessions are excluded.'
                }
                action={
                  hasFilters && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="large"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-raised">
                    <TableHead className="pl-5">User</TableHead>
                    <TableHead>Workspace memberships</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="py-3 pl-5">
                        <button
                          type="button"
                          onClick={() => openUser(user.userId)}
                          className="flex min-h-10 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                        >
                          <Avatar className="size-9 shrink-0">
                            <AvatarImage src={user.image ?? undefined} alt="" />
                            <AvatarFallback className="text-xs">
                              {user.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            <span className="block max-w-60 truncate font-medium text-foreground-strong">
                              {user.name}
                            </span>
                            <span className="mt-0.5 block max-w-60 truncate text-xs text-foreground-tertiary">
                              {user.email}
                            </span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell>
                        {!user.memberships.length ? (
                          <span className="text-xs text-foreground-tertiary">
                            No workspace
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {user.memberships.slice(0, 2).map((membership) => (
                              <Link
                                key={membership.memberId}
                                to="/singularity/orgs/$organizationId"
                                params={{
                                  organizationId: membership.organizationId,
                                }}
                                search={{ tab: 'members', member: user.email }}
                                className="flex min-h-7 items-center gap-2 rounded-sm text-xs outline-none hover:text-foreground-info focus-visible:ring-2 focus-visible:ring-border-strong"
                              >
                                <span className="max-w-44 truncate">
                                  {membership.organizationName}
                                </span>
                                <span className="text-foreground-tertiary">
                                  {membership.role}
                                </span>
                              </Link>
                            ))}
                            {user.memberships.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() => openUser(user.userId)}
                              >
                                +{user.memberships.length - 2} more workspaces
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1.5">
                          <SingularityStatus warning={!user.emailVerified}>
                            {user.emailVerified
                              ? 'Email verified'
                              : 'Email unverified'}
                          </SingularityStatus>
                          {hasRestrictedMembership(user) && (
                            <span className="inline-flex items-center gap-1 text-xs text-foreground-warning">
                              <CircleAlert className="size-3" aria-hidden />
                              Restricted access
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground-tertiary">
                        {formatSingularityDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="pr-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`View ${user.email}`}
                          onClick={() => openUser(user.userId)}
                        >
                          <ArrowRight className="size-4" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <SingularityPagination
            page={page}
            pageCount={pageCount}
            count={matching.length}
            pageSize={25}
            onPageChange={(nextPage) => onSearchChange({ page: nextPage })}
          />
        </section>
        <SingularityUserDialog
          user={users.find((user) => user.userId === search.user)}
          onClose={() => onSearchChange({ user: undefined })}
        />
      </div>
    </ContentPage>
  )
}
