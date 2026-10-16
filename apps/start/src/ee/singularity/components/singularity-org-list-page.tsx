'use client'

import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
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
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Download,
  RefreshCw,
  Users,
} from 'lucide-react'
import { cn } from '@rift/utils'
import { toast } from 'sonner'
import { ContentPage } from '@/components/layout'
import { WORKSPACE_PLANS } from '@/lib/shared/access-control'
import type { SingularityOrganizationListItem } from '../shared/singularity-admin'
import type { SingularityDirectorySearch } from '../shared/singularity-search'
import {
  healthFilterLabels,
  SINGULARITY_PAGE_SIZE,
  useSingularityOrgListPageLogic,
} from './singularity-org-list-page.logic'
import {
  SingularityCopyButton,
  SingularityEmpty,
  SingularityPagination,
  SingularitySearch,
  SingularityStatus,
} from './singularity-ui'
import { downloadSingularityCsv } from './singularity-export'

export function SingularityOrgListPage({
  organizations,
  search,
  onSearchChange,
}: {
  organizations: Array<SingularityOrganizationListItem>
  search: SingularityDirectorySearch
  onSearchChange: (patch: SingularityDirectorySearch, replace?: boolean) => void
}) {
  const { rows, matching, summary, page, pageCount } =
    useSingularityOrgListPageLogic(organizations, search)
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const hasFilters = Boolean(search.q || search.plan || search.health)
  const clearFilters = () =>
    onSearchChange({ q: undefined, plan: undefined, health: undefined })
  return (
    <ContentPage className="pb-6 lg:pt-7">
      <div className="space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground-tertiary">
              <Building2 className="size-3.5" aria-hidden /> Singularity
            </div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground-strong">
              Organizations
            </h1>
            <p className="mt-1 text-sm text-foreground-tertiary">
              Manage workspace access, contracts, and usage.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                  toast.success('Directory refreshed.')
                } catch {
                  toast.error('Could not refresh the directory.')
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
              disabled={matching.length === 0}
              onClick={() =>
                downloadSingularityCsv('singularity-organizations.csv', [
                  [
                    'Organization',
                    'ID',
                    'Slug',
                    'Plan',
                    'Status',
                    'Members',
                    'Pending invitations',
                    'Seats',
                    'Issues',
                  ],
                  ...matching.map((row) => [
                    row.name,
                    row.organizationId,
                    row.slug,
                    row.planName,
                    row.subscriptionStatusLabel,
                    row.memberCount,
                    row.pendingInvitationCount,
                    row.seatCount,
                    row.issues
                      .map((issue) => healthFilterLabels[issue])
                      .join('; '),
                  ]),
                ])
              }
            >
              <Download className="size-4" aria-hidden />
              Export
            </Button>
          </div>
        </header>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border-base bg-surface-raised lg:grid-cols-4">
          {[
            {
              label: 'Organizations',
              value: summary.organizations,
              icon: Building2,
              selected: !search.plan && !search.health,
              patch: { plan: undefined, health: undefined },
            },
            {
              label: 'Paid workspaces',
              value: summary.paid,
              icon: ArrowUpRight,
              selected: search.plan === 'paid' && !search.health,
              patch: { plan: 'paid' as const, health: undefined },
            },
            { label: 'Members', value: summary.members, icon: Users },
            {
              label: 'Needs attention',
              value: summary.attention,
              icon: CircleAlert,
              selected: search.health === 'attention',
              patch: { health: 'attention' as const, plan: undefined },
            },
          ].map((metric) => {
            const content = (
              <>
                <div className="flex items-center justify-between gap-2 text-xs text-foreground-tertiary">
                  <span>{metric.label}</span>
                  <metric.icon className="size-4" aria-hidden />
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground-strong">
                    {metric.value.toLocaleString()}
                  </span>
                  {metric.patch && (
                    <ArrowRight
                      className="size-3.5 text-foreground-tertiary"
                      aria-hidden
                    />
                  )}
                </div>
              </>
            )
            const classes = cn(
              'border-border-base p-4 text-left sm:p-5 [&:nth-child(odd)]:border-r [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0 lg:[&:not(:last-child)]:border-r',
              metric.selected && 'bg-surface-info/15',
              metric.patch &&
                'outline-none transition-colors hover:bg-surface-inverse/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-strong',
            )
            return metric.patch ? (
              <button
                key={metric.label}
                type="button"
                className={classes}
                aria-pressed={metric.selected}
                onClick={() => onSearchChange(metric.patch)}
              >
                {content}
              </button>
            ) : (
              <div key={metric.label} className={classes}>
                {content}
              </div>
            )
          })}
        </div>
        <section aria-label="Organization directory" className="space-y-3">
          <div className="flex flex-col gap-2 xl:flex-row">
            <SingularitySearch
              label="Search organizations"
              value={search.q ?? ''}
              onChange={(q) => onSearchChange({ q: q || undefined }, true)}
              placeholder="Search workspaces, IDs, people or emails…"
            />
            <div className="flex flex-wrap gap-2">
              <Select
                value={search.plan ?? 'all'}
                onValueChange={(value) =>
                  onSearchChange({
                    plan:
                      value === 'all'
                        ? undefined
                        : (value as SingularityDirectorySearch['plan']),
                  })
                }
              >
                <SelectTrigger
                  className="h-10 min-w-32 flex-1"
                  aria-label="Filter by plan"
                >
                  <SelectValue>
                    {search.plan === 'paid'
                      ? 'Paid plans'
                      : search.plan
                        ? WORKSPACE_PLANS.find(
                            (plan) => plan.id === search.plan,
                          )?.name
                        : 'All plans'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="paid">Paid plans</SelectItem>
                  {WORKSPACE_PLANS.filter(
                    (plan) =>
                      plan.id !== 'self_hosted' ||
                      organizations.some((org) => org.planId === 'self_hosted'),
                  ).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={search.health ?? 'all'}
                onValueChange={(value) =>
                  onSearchChange({
                    health:
                      value === 'all'
                        ? undefined
                        : (value as SingularityDirectorySearch['health']),
                  })
                }
              >
                <SelectTrigger
                  className="h-10 min-w-40 flex-1"
                  aria-label="Filter by health"
                >
                  <SelectValue>
                    {search.health
                      ? healthFilterLabels[search.health]
                      : 'All health states'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All health states</SelectItem>
                  {Object.entries(healthFilterLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={search.sort ?? 'name'}
                onValueChange={(value) =>
                  onSearchChange({
                    sort: value as SingularityDirectorySearch['sort'],
                  })
                }
              >
                <SelectTrigger
                  className="h-10 min-w-36 flex-1"
                  aria-label="Sort organizations"
                >
                  <SelectValue>
                    {
                      {
                        name: 'Name A–Z',
                        members: 'Most members',
                        seats: 'Seat utilization',
                        attention: 'Most issues',
                      }[search.sort ?? 'name']
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name A–Z</SelectItem>
                  <SelectItem value="members">Most members</SelectItem>
                  <SelectItem value="seats">Seat utilization</SelectItem>
                  <SelectItem value="attention">Most issues</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasFilters && (
            <div className="flex items-center justify-between gap-3 text-xs text-foreground-tertiary">
              <span role="status">
                {matching.length} matching organization
                {matching.length !== 1 ? 's' : ''}
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
            {rows.length === 0 ? (
              <SingularityEmpty
                title={
                  organizations.length
                    ? 'No matching organizations'
                    : 'No organizations yet'
                }
                description={
                  organizations.length
                    ? 'Try a different name, email, or ID, or clear the filters to see every workspace.'
                    : 'Organizations will appear here as workspaces are created.'
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
                  <TableRow className="bg-surface-raised hover:bg-surface-raised">
                    <TableHead className="pl-5">Organization</TableHead>
                    <TableHead>Plan & billing</TableHead>
                    <TableHead>Seat capacity</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.organizationId} className="group">
                      <TableCell className="py-3 pl-5">
                        <Link
                          to="/singularity/orgs/$organizationId"
                          params={{ organizationId: row.organizationId }}
                          className="flex min-h-10 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                        >
                          <Avatar className="size-9 shrink-0">
                            <AvatarImage src={row.logo ?? undefined} alt="" />
                            <AvatarFallback className="text-xs">
                              {row.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="max-w-64 truncate font-medium text-foreground-strong group-hover:text-foreground-info">
                              {row.name}
                            </div>
                            <div className="mt-0.5 max-w-64 truncate text-xs text-foreground-tertiary">
                              {row.slug}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.planName}</div>
                        <div className="mt-1 text-xs text-foreground-tertiary">
                          {row.subscriptionStatusLabel}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="tabular-nums">
                          {row.memberCount + row.pendingInvitationCount}{' '}
                          <span className="text-foreground-tertiary">
                            / {row.seatCount}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-foreground-tertiary">
                          {row.memberCount}{' '}
                          {row.memberCount === 1 ? 'member' : 'members'}
                          {row.pendingInvitationCount > 0 &&
                            ` · ${row.pendingInvitationCount} invited`}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.issues.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {row.issues.map((issue) => (
                              <Link
                                key={issue}
                                to="/singularity/orgs/$organizationId"
                                params={{ organizationId: row.organizationId }}
                                search={{
                                  tab:
                                    issue === 'access'
                                      ? 'members'
                                      : issue === 'sync'
                                        ? 'usage'
                                        : 'billing',
                                }}
                                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                              >
                                <SingularityStatus warning>
                                  <CircleAlert className="size-3" aria-hidden />
                                  {healthFilterLabels[issue]}
                                </SingularityStatus>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-foreground-tertiary">
                            <CheckCircle2 className="size-3.5" aria-hidden />
                            Healthy
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-3">
                        <div className="flex justify-end">
                          <SingularityCopyButton
                            value={row.organizationId}
                            label="Copy organization ID"
                          />
                          <Button asChild variant="ghost" size="icon">
                            <Link
                              to="/singularity/orgs/$organizationId"
                              params={{ organizationId: row.organizationId }}
                              aria-label={`Open ${row.name}`}
                            >
                              <ArrowRight className="size-4" aria-hidden />
                            </Link>
                          </Button>
                        </div>
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
            pageSize={SINGULARITY_PAGE_SIZE}
            onPageChange={(nextPage) => onSearchChange({ page: nextPage })}
          />
        </section>
      </div>
    </ContentPage>
  )
}
