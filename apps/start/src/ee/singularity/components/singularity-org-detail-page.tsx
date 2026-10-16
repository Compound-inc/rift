'use client'

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Gauge,
  RefreshCw,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@rift/utils'
import { toast } from 'sonner'
import { ContentPage } from '@/components/layout'
import {
  getWorkspacePlan,
  WORKSPACE_FEATURE_IDS,
} from '@/lib/shared/access-control'
import type { SingularityOrganizationDetail } from '../shared/singularity-admin'
import type { SingularityTab } from '../shared/singularity-search'
import { useSingularityOrgDetailPageLogic } from './singularity-org-detail-page.logic'
import {
  getOrganizationIssues,
  getSubscriptionStatusLabel,
  healthFilterLabels,
} from './singularity-org-list-page.logic'
import {
  billingIntervalLabels,
  formatSingularityCurrency,
  formatSingularityDate,
  singularityBillingSource,
  singularityUsageCap,
  workspaceFeatureLabels,
} from './singularity-format'
import {
  SingularityCopyButton,
  SingularityPanel,
  SingularityStatus,
} from './singularity-ui'
import { SingularityMemberDirectory } from './singularity-member-directory'
import { SingularityBillingEditor } from './singularity-billing-editor'
import { SingularityUsagePanel } from './singularity-usage-panel'

export function SingularityOrgDetailPage({
  organization,
  tab,
  memberQuery,
}: {
  organization: SingularityOrganizationDetail
  tab: SingularityTab
  memberQuery?: string
}) {
  const actions = useSingularityOrgDetailPageLogic(organization)
  const [refreshing, setRefreshing] = useState(false)
  const issues = getOrganizationIssues({
    ...organization,
    memberSearchText: '',
    usageSyncStatus: organization.usagePolicy.syncStatus,
    restrictedMemberCount: organization.members.filter(
      (member) => member.accessStatus.toLowerCase() !== 'active',
    ).length,
  })
  const occupiedSeats =
    organization.memberCount + organization.pendingInvitationCount
  // Membership and usage refreshes must not reset a contract draft. Only a new
  // billing snapshot remounts the editor and establishes its saved baseline.
  const billingRevision = JSON.stringify([
    organization.planId,
    organization.seatCount,
    organization.billingInterval,
    organization.effectiveFeatures,
    organization.manualPlanOverride,
    organization.usagePolicy.hasCustomMonthlyBudget,
    organization.usagePolicy.organizationMonthlyBudgetUsd,
  ])
  const profileLink = (nextTab: SingularityTab, label: string) => (
    <Link
      to="/singularity/orgs/$organizationId"
      params={{ organizationId: organization.organizationId }}
      search={{ tab: nextTab }}
      className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm text-foreground-info outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
    >
      {label}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  )
  return (
    <ContentPage className="pb-6 lg:pt-6">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="ghost" size="large" className="-ml-3 gap-2">
            <Link to="/singularity">
              <ArrowLeft className="size-4" aria-hidden />
              Organizations
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="large"
            className="gap-2"
            disabled={actions.isPending || refreshing}
            onClick={async () => {
              setRefreshing(true)
              try {
                await actions.handleRefresh()
                toast.success('Workspace refreshed.')
              } catch {
                toast.error('Could not refresh this workspace.')
              } finally {
                setRefreshing(false)
              }
            }}
          >
            <RefreshCw
              className={cn('size-4', refreshing && 'motion-safe:animate-spin')}
              aria-hidden
            />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <header className="flex items-start gap-4">
          <Avatar className="size-12 shrink-0 rounded-xl">
            <AvatarImage src={organization.logo ?? undefined} alt="" />
            <AvatarFallback className="rounded-xl text-sm">
              {organization.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground-strong">
                {organization.name}
              </h1>
              <SingularityStatus>
                {getWorkspacePlan(organization.planId).name}
              </SingularityStatus>
              <SingularityStatus warning={issues.includes('billing')}>
                {getSubscriptionStatusLabel(organization)}
              </SingularityStatus>
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm text-foreground-tertiary">
              <span className="truncate">{organization.slug}</span>
              <SingularityCopyButton
                value={organization.slug}
                label="Copy workspace slug"
              />
            </div>
          </div>
        </header>
        <nav
          aria-label="Organization sections"
          className="flex gap-1 overflow-x-auto border-b border-border-base"
        >
          {(
            [
              { id: 'overview', label: 'Overview' },
              {
                id: 'members',
                label: 'Members',
                count: organization.memberCount,
              },
              { id: 'billing', label: 'Billing & access' },
              { id: 'usage', label: 'Usage' },
            ] as const
          ).map((item) => (
            <Link
              key={item.id}
              to="/singularity/orgs/$organizationId"
              params={{ organizationId: organization.organizationId }}
              search={{ tab: item.id }}
              aria-current={tab === item.id ? 'page' : undefined}
              className={cn(
                'relative flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm sm:px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-strong',
                tab === item.id
                  ? 'border-b-2 border-accent-primary font-medium text-foreground-info'
                  : 'border-b-2 border-transparent text-foreground-tertiary hover:text-foreground-strong',
              )}
            >
              {item.label}
              {'count' in item && (
                <span className="rounded-md bg-surface-overlay px-1.5 py-0.5 text-[11px] tabular-nums text-foreground-tertiary">
                  {item.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
        {actions.needsRefresh && (
          <div
            role="alert"
            className="rounded-lg bg-surface-warning p-4 text-sm text-foreground-warning"
          >
            Your change was saved. Refresh this workspace to load its current
            state before making another change.
          </div>
        )}
        <div hidden={tab !== 'overview'} className="space-y-5">
          {issues.length > 0 ? (
            <div className="rounded-xl border border-border-base bg-surface-raised p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground-strong">
                <CircleAlert
                  className="size-4 text-foreground-warning"
                  aria-hidden
                />
                Needs attention
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                {issues.map((issue) => (
                  <div key={issue}>
                    {profileLink(
                      issue === 'access'
                        ? 'members'
                        : issue === 'sync'
                          ? 'usage'
                          : 'billing',
                      healthFilterLabels[issue],
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-foreground-tertiary">
              <CheckCircle2 className="size-4" aria-hidden />
              No workspace issues reported.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'People',
                icon: Users,
                value: String(organization.memberCount),
                detail: `${organization.pendingInvitationCount} pending invitations`,
                nextTab: 'members' as const,
                link: 'Manage people',
              },
              {
                title: 'Seat capacity',
                icon: CreditCard,
                value: `${occupiedSeats} / ${organization.seatCount}`,
                detail: 'Members and reserved invitations',
                nextTab: 'billing' as const,
                link: 'Manage contract',
              },
              {
                title: 'Cycle AI spend',
                icon: Gauge,
                value: formatSingularityCurrency(organization.aiSpendThisMonth),
                detail: `Cap · ${singularityUsageCap(organization)}`,
                nextTab: 'usage' as const,
                link: 'View usage',
              },
            ].map((metric) => (
              <div
                key={metric.title}
                className="min-w-0 rounded-xl border border-border-base bg-surface-raised p-5"
              >
                <div className="flex items-center justify-between text-xs text-foreground-tertiary">
                  {metric.title}
                  <metric.icon className="size-4" aria-hidden />
                </div>
                <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight text-foreground-strong">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-foreground-tertiary">
                  {metric.detail}
                </p>
                <div className="mt-3">
                  {profileLink(metric.nextTab, metric.link)}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <SingularityPanel title="Workspace details">
              <dl className="space-y-4">
                {[
                  {
                    label: 'Organization ID',
                    value: organization.organizationId,
                    copy: true,
                  },
                  { label: 'Slug', value: organization.slug, copy: true },
                  {
                    label: 'Billing source',
                    value: singularityBillingSource(organization),
                  },
                  {
                    label: 'Billing interval',
                    value: organization.billingInterval
                      ? billingIntervalLabels[organization.billingInterval]
                      : 'Not set',
                  },
                  {
                    label: 'Subscribed since',
                    value: formatSingularityDate(
                      organization.paidSubscriptionStartedAt,
                    ),
                  },
                  {
                    label: 'Next reset',
                    value: formatSingularityDate(organization.billingPeriodEnd),
                  },
                  {
                    label: 'Billing reference',
                    value:
                      organization.manualPlanOverride.billingReference ??
                      'None',
                  },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                  >
                    <dt className="text-xs text-foreground-tertiary">
                      {field.label}
                    </dt>
                    <dd className="flex min-w-0 items-center gap-1 break-all text-right text-sm text-foreground-strong">
                      {field.value}
                      {field.copy && (
                        <SingularityCopyButton
                          value={field.value}
                          label={`Copy ${field.label.toLowerCase()}`}
                        />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </SingularityPanel>
            <SingularityPanel
              title="Feature access"
              description="The effective access available to this workspace."
              action={profileLink('billing', 'Edit access')}
            >
              <dl className="space-y-4">
                {WORKSPACE_FEATURE_IDS.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center justify-between gap-4"
                  >
                    <dt className="text-sm text-foreground-primary">
                      {workspaceFeatureLabels[feature]}
                    </dt>
                    <dd className="flex items-center gap-1.5 text-xs text-foreground-tertiary">
                      {organization.effectiveFeatures[feature] ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <X className="size-3.5" aria-hidden />
                      )}
                      {organization.effectiveFeatures[feature]
                        ? 'Enabled'
                        : 'Disabled'}
                    </dd>
                  </div>
                ))}
              </dl>
            </SingularityPanel>
          </div>
          {(organization.manualPlanOverride.overrideReason ||
            organization.manualPlanOverride.internalNote) && (
            <SingularityPanel title="Internal context">
              {organization.manualPlanOverride.overrideReason && (
                <p className="break-words text-sm font-medium text-foreground-strong">
                  {organization.manualPlanOverride.overrideReason}
                </p>
              )}
              {organization.manualPlanOverride.internalNote && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground-tertiary">
                  {organization.manualPlanOverride.internalNote}
                </p>
              )}
            </SingularityPanel>
          )}
        </div>
        <div hidden={tab !== 'members'}>
          <SingularityMemberDirectory
            key={memberQuery ?? ''}
            initialQuery={memberQuery}
            organization={organization}
            actions={actions}
          />
        </div>
        <div hidden={tab !== 'billing'}>
          <SingularityBillingEditor
            key={billingRevision}
            organization={organization}
            actions={actions}
          />
        </div>
        <div hidden={tab !== 'usage'}>
          <SingularityUsagePanel
            organization={organization}
            actions={actions}
          />
        </div>
      </div>
    </ContentPage>
  )
}
