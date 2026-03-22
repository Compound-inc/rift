'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { copyToClipboard } from '@rift/utils'
import {
  getDefaultAuthDisplayName,
  normalizeEmailAddress,
} from '@/components/auth/auth-shared'
import { ContentPage } from '@/components/layout'
import { DataTable } from '@rift/ui/data-table'
import type { DataTableColumnDef } from '@rift/ui/data-table'
import { Form } from '@rift/ui/form'
import { FormDialog } from '@rift/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Badge } from '@rift/ui/badge'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import { Switch } from '@rift/ui/switch'
import { Textarea } from '@rift/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@rift/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rift/ui/select'
import { MoreVertical, UserPlus } from 'lucide-react'
import {
  WORKSPACE_FEATURE_IDS,
  WORKSPACE_PLANS,
} from '@/lib/shared/access-control'
import type { WorkspaceFeatureId } from '@/lib/shared/access-control'
import type { SingularityOrganizationDetail } from '@/ee/singularity/shared/singularity-admin'
import { useSingularityOrgDetailPageLogic } from './singularity-org-detail-page.logic'

type DirectoryRow = {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'restricted' | 'pending'
  avatarUrl?: string
  statusDetail?: string
  memberId?: string
  invitationId?: string
}

const usdCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const mediumDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const billingIntervalLabels: Record<string, string> = {
  month: 'Monthly',
  year: 'Yearly',
  custom: 'Custom',
}

const workspaceFeatureLabels: Record<WorkspaceFeatureId, string> = {
  byok: 'BYOK',
  providerPolicy: 'Provider policy',
  compliancePolicy: 'Compliance policy',
  toolPolicy: 'Tool policy',
  verifiedDomains: 'Verified domains',
  singleSignOn: 'Single sign-on',
  directoryProvisioning: 'Directory provisioning',
}

function formatCurrencyAmount(amount: number): string {
  return usdCurrencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatOptionalCurrencyAmount(amount: number | null): string {
  return amount == null ? 'Plan default' : formatCurrencyAmount(amount)
}

function formatDateLabel(timestamp: number | null): string {
  if (timestamp == null || !Number.isFinite(timestamp)) {
    return 'Not available'
  }

  return mediumDateFormatter.format(new Date(timestamp))
}

function formatBillingPeriodLabel(
  startTimestamp: number | null,
  endTimestamp: number | null,
): string {
  if (
    startTimestamp != null
    && Number.isFinite(startTimestamp)
    && endTimestamp != null
    && Number.isFinite(endTimestamp)
  ) {
    return `${formatDateLabel(startTimestamp)} - ${formatDateLabel(endTimestamp)}`
  }

  if (endTimestamp != null && Number.isFinite(endTimestamp)) {
    return `Ends ${formatDateLabel(endTimestamp)}`
  }

  return 'Not available'
}

function formatBillingIntervalLabel(interval: string | null): string {
  if (!interval) {
    return 'Not set'
  }

  return billingIntervalLabels[interval] ?? interval
}

function formatSingularityBillingSource(input: {
  planId: SingularityOrganizationDetail['planId']
  billingProvider: string
  providerSubscriptionId: string | null
  hasManualPlanOverride: boolean
}): string | null {
  if (input.planId === 'free' && !input.hasManualPlanOverride) {
    return null
  }

  if (input.billingProvider === 'stripe' || input.providerSubscriptionId) {
    return 'Stripe'
  }

  return 'Manual contract'
}

function formatSingularitySubscriptionStatus(
  organization: SingularityOrganizationDetail,
): string {
  if (
    organization.planId === 'free'
    && Object.keys(organization.manualPlanOverride.featureOverrides).length === 0
    && !organization.manualPlanOverride.overrideReason
    && !organization.manualPlanOverride.internalNote
    && !organization.manualPlanOverride.billingReference
  ) {
    return 'Free tier'
  }

  switch (organization.subscriptionStatus.toLowerCase()) {
    case 'active':
      return 'Active'
    case 'trialing':
      return 'Trialing'
    case 'past_due':
      return 'Past due'
    case 'canceled':
      return 'Canceled'
    case 'inactive':
      return 'Inactive'
    default:
      return organization.subscriptionStatus
  }
}

function formatUsageCapLabel(
  organization: SingularityOrganizationDetail,
): string {
  if (
    organization.planId === 'free'
    && Object.keys(organization.manualPlanOverride.featureOverrides).length === 0
    && !organization.manualPlanOverride.overrideReason
    && !organization.manualPlanOverride.internalNote
    && !organization.manualPlanOverride.billingReference
  ) {
    return 'Free tier'
  }

  return formatOptionalCurrencyAmount(
    organization.usagePolicy.organizationMonthlyBudgetUsd,
  )
}

function hasManualContractState(
  organization: SingularityOrganizationDetail,
): boolean {
  return (
    Object.keys(organization.manualPlanOverride.featureOverrides).length > 0
    || Boolean(organization.manualPlanOverride.overrideReason)
    || Boolean(organization.manualPlanOverride.internalNote)
    || Boolean(organization.manualPlanOverride.billingReference)
  )
}

/**
 * Subscription tenure is shown in coarse units so operators can compare orgs
 * quickly without mentally converting from exact dates.
 */
function formatSubscriptionAge(timestamp: number | null): string {
  if (timestamp == null || !Number.isFinite(timestamp)) {
    return 'Not subscribed'
  }

  const startedAt = new Date(timestamp)
  const now = new Date()
  let months =
    (now.getFullYear() - startedAt.getFullYear()) * 12
    + (now.getMonth() - startedAt.getMonth())

  if (now.getDate() < startedAt.getDate()) {
    months -= 1
  }

  if (months <= 0) {
    return 'Less than 1 month'
  }

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12

  if (years === 0) {
    return `${months} month${months === 1 ? '' : 's'}`
  }

  if (remainingMonths === 0) {
    return `${years} year${years === 1 ? '' : 's'}`
  }

  return `${years}y ${remainingMonths}mo`
}

/**
 * The overview metrics use self-contained tiles instead of row dividers so the
 * layout stays balanced when the grid wraps across breakpoints.
 */
function SummaryMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-light/80 bg-surface-overlay/70 px-4 py-3">
      <dt className="text-[11px] font-medium text-foreground-tertiary">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-semibold leading-5 text-foreground-strong">
        {value}
      </dd>
    </div>
  )
}

/**
 * Smaller cards on the rail borrow the layered Form surface so side content
 * still feels part of the same settings system.
 */
function LayeredSideCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-surface-strong bg-transparent">
      <div className="relative bg-surface-strong/50">
        <div className="relative z-10 flex flex-col space-y-5 rounded-b-2xl bg-surface-raised p-5 shadow-[0_2px_12px_rgb(0,0,0,0.05)]">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground-strong">
              {title}
            </h2>
            {description ? (
              <p className="text-sm text-foreground-tertiary">{description}</p>
            ) : null}
          </div>
          {children}
        </div>
        <div className="relative z-0 -mt-3 rounded-b-xl border-t border-border-faint bg-surface-strong px-5 pb-3 pt-5"></div>
      </div>
    </section>
  )
}

function getStatusBadgeClassName(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    case 'free tier':
      return 'border-slate-500/30 bg-surface-overlay text-foreground-secondary'
    case 'pending':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    case 'restricted':
    case 'revoked':
    case 'past due':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400'
    default:
      return ''
  }
}

function getRoleBadgeClassName(role: string): string {
  switch (role.toLowerCase()) {
    case 'owner':
      return 'border-accent-primary bg-accent-primary text-white'
    case 'admin':
      return 'border-foreground-info/30 bg-surface-info/15 text-foreground-info'
    default:
      return ''
  }
}

function buildDirectoryRows(
  organization: SingularityOrganizationDetail,
): Array<DirectoryRow> {
  const activeEmails = new Set(
    organization.members
      .map((member) => member.email)
      .filter((email): email is string => Boolean(email))
      .map(normalizeEmailAddress),
  )

  const memberRows: Array<DirectoryRow> = organization.members.map(
    (member) => ({
      id: `member:${member.memberId}`,
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      role: member.role,
      status:
        member.accessStatus.toLowerCase() === 'active'
          ? 'active'
          : 'restricted',
      avatarUrl: member.image ?? undefined,
      statusDetail: member.accessReason ?? undefined,
    }),
  )

  const invitationRows: Array<DirectoryRow> = organization.invitations
    .map((invitation) => {
      const email = normalizeEmailAddress(invitation.email)

      return {
        id: `invitation:${invitation.invitationId}`,
        invitationId: invitation.invitationId,
        name: getDefaultAuthDisplayName(email),
        email,
        role: invitation.role,
        status: 'pending' as const,
        statusDetail:
          invitation.status.toLowerCase() === 'pending'
            ? 'Invitation has not been accepted yet.'
            : invitation.status,
      }
    })
    .filter((invitation) => !activeEmails.has(invitation.email))

  return [...memberRows, ...invitationRows].sort((left, right) => {
    const statusOrder = { active: 0, restricted: 1, pending: 2 }
    const roleOrder = { owner: 0, admin: 1, member: 2 }

    const byStatus = statusOrder[left.status] - statusOrder[right.status]
    if (byStatus !== 0) return byStatus

    const leftRole =
      roleOrder[left.role.toLowerCase() as keyof typeof roleOrder] ?? 3
    const rightRole =
      roleOrder[right.role.toLowerCase() as keyof typeof roleOrder] ?? 3
    if (leftRole !== rightRole) return leftRole - rightRole

    return left.name.localeCompare(right.name)
  })
}

async function handleCopyMetadata(value: string) {
  try {
    await copyToClipboard(value)
  } catch {
    // Clipboard can be unavailable in some contexts; copy actions are best-effort.
  }
}

/**
 * The singularity invite flow mirrors the organization members page by moving
 * invites into a focused dialog triggered from the table toolbar.
 */
function SingularityInviteDialog({
  inviteEmail,
  inviteRole,
  isPending,
  setInviteEmail,
  setInviteRole,
  onInvite,
}: {
  inviteEmail: string
  inviteRole: 'admin' | 'member'
  isPending: boolean
  setInviteEmail: (value: string) => void
  setInviteRole: (value: 'admin' | 'member') => void
  onInvite: () => Promise<void>
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="default" type="button">
          <UserPlus aria-hidden />
          Invite members
        </Button>
      }
      title="Invite member"
      description="Send an invitation to join this organization."
      buttonText="Send invitation"
      submitButtonDisabled={isPending || inviteEmail.trim().length === 0}
      handleSubmit={onInvite}
      helpText="Members appear in the table immediately after the invite is created."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Email address</Label>
          <Input
            type="email"
            placeholder="person@company.com"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            autoComplete="email"
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select
            value={inviteRole}
            onValueChange={(value) =>
              setInviteRole(value === 'admin' ? 'admin' : 'member')
            }
          >
            <SelectTrigger
              className="w-full"
              aria-label="Invite role"
              disabled={isPending}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormDialog>
  )
}

function DirectoryRowActions({
  row,
  data,
  isPending,
  onUpdateRole,
  onRemoveMember,
  onCancelInvitation,
}: {
  row: DirectoryRow
  data: Array<DirectoryRow>
  isPending: boolean
  onUpdateRole: (memberId: string, role: 'admin' | 'member') => Promise<void>
  onRemoveMember: (memberId: string) => Promise<void>
  onCancelInvitation: (invitationId: string) => Promise<void>
}) {
  const isActiveMember = row.memberId != null
  const isOwner = row.role.toLowerCase() === 'owner'
  const ownerCount = data.filter(
    (entry) => entry.memberId && entry.role.toLowerCase() === 'owner',
  ).length
  const isLastOwner = isActiveMember && isOwner && ownerCount === 1

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="iconSmall"
            className="size-8 rounded-md"
            aria-label={`Actions for ${row.name}`}
            disabled={isPending}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-40">
        {isActiveMember ? (
          <>
            {!isOwner ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={
                      row.role.toLowerCase() === 'admin' ? 'admin' : 'member'
                    }
                    onValueChange={(role) =>
                      void onUpdateRole(
                        row.memberId!,
                        role === 'admin' ? 'admin' : 'member',
                      )
                    }
                  >
                    <DropdownMenuRadioItem value="admin">
                      Admin
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="member">
                      Member
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            <DropdownMenuItem
              variant="destructive"
              disabled={isLastOwner}
              onClick={() => void onRemoveMember(row.memberId!)}
            >
              Remove member
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => void onCancelInvitation(row.invitationId!)}
          >
            Cancel invitation
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SingularityOrgDetailPage({
  organization,
}: {
  organization: SingularityOrganizationDetail
}) {
  const subscriptionStatusLabel = formatSingularitySubscriptionStatus(
    organization,
  )
  const billingSourceLabel = formatSingularityBillingSource({
    planId: organization.planId,
    billingProvider: organization.billingProvider,
    providerSubscriptionId: organization.providerSubscriptionId,
    hasManualPlanOverride: hasManualContractState(organization),
  })
  const {
    inviteEmail,
    inviteRole,
    selectedPlan,
    selectedBillingInterval,
    selectedSeatCount,
    selectedUsageLimitUsd,
    selectedOverrideReason,
    selectedInternalNote,
    selectedBillingReference,
    selectedFeatureAccess,
    isSeatCountValid,
    isUsageLimitValid,
    isPending,
    activePlanName,
    setInviteEmail,
    setInviteRole,
    setSelectedPlan,
    setSelectedBillingInterval,
    setSelectedSeatCount,
    setSelectedUsageLimitUsd,
    setSelectedOverrideReason,
    setSelectedInternalNote,
    setSelectedBillingReference,
    setSelectedFeatureAccess,
    resetSelectedOverridesToPlanDefaults,
    handleInvite,
    handleRoleChange,
    handleRemoveMember,
    handleCancelInvitation,
    handleSetPlan,
  } = useSingularityOrgDetailPageLogic(organization)

  const directoryRows = useMemo(
    () => buildDirectoryRows(organization),
    [organization],
  )
  const hasPlanChanged = selectedPlan !== organization.planId
  const parsedSeatCount = Number.parseInt(selectedSeatCount, 10)
  const hasSeatCountChanged =
    isSeatCountValid && parsedSeatCount !== organization.seatCount
  const hasBillingIntervalChanged =
    (selectedBillingInterval ?? null) !== (organization.billingInterval ?? null)
  const hasUsageLimitChanged =
    selectedUsageLimitUsd.trim()
    !== (
      organization.usagePolicy.hasCustomMonthlyBudget
      && organization.usagePolicy.organizationMonthlyBudgetUsd != null
        ? String(organization.usagePolicy.organizationMonthlyBudgetUsd)
        : ''
    )
  const hasOverrideReasonChanged =
    selectedOverrideReason.trim() !== (organization.manualPlanOverride.overrideReason ?? '')
  const hasInternalNoteChanged =
    selectedInternalNote.trim() !== (organization.manualPlanOverride.internalNote ?? '')
  const hasBillingReferenceChanged =
    selectedBillingReference.trim() !== (organization.manualPlanOverride.billingReference ?? '')
  const hasFeatureOverridesChanged = WORKSPACE_FEATURE_IDS.some(
    (featureId) =>
      selectedFeatureAccess[featureId] !== organization.effectiveFeatures[featureId],
  )
  const hasOverrideChanges =
    hasPlanChanged
    || hasSeatCountChanged
    || hasBillingIntervalChanged
    || hasUsageLimitChanged
    || hasOverrideReasonChanged
    || hasInternalNoteChanged
    || hasBillingReferenceChanged
    || hasFeatureOverridesChanged

  const directoryColumns = useMemo<Array<DataTableColumnDef<DirectoryRow>>>(
    () => [
      {
        accessorKey: 'name',
        filterFn: (row, columnId, filterValue) => {
          const query = String(filterValue ?? '')
            .trim()
            .toLowerCase()
          if (query.length === 0) return true

          const name = String(row.getValue(columnId) ?? '').toLowerCase()
          const email = row.original.email.toLowerCase()
          return name.includes(query) || email.includes(query)
        },
        header: () => <span className="pl-11">User</span>,
        cell: ({ row }) => {
          const person = row.original
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage src={person.avatarUrl} alt={person.name} />
                <AvatarFallback>{person.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground-primary">
                  {person.name}
                </div>
                <div className="truncate text-sm text-foreground-tertiary">
                  {person.email}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => {
          const person = row.original
          const canEditRole =
            person.memberId != null && person.role.toLowerCase() !== 'owner'

          return (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={getRoleBadgeClassName(person.role)}
              >
                {person.role}
              </Badge>
              {canEditRole ? (
                <Select
                  value={person.role === 'admin' ? 'admin' : 'member'}
                  onValueChange={(value) =>
                    void handleRoleChange(
                      person.memberId!,
                      value === 'admin' ? 'admin' : 'member',
                    )
                  }
                >
                  <SelectTrigger
                    className="h-8 min-w-28 bg-surface-overlay"
                    size="sm"
                    aria-label={`Update ${person.name}'s role`}
                    disabled={isPending}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const person = row.original

          return (
            <div className="space-y-1">
              <Badge
                variant="outline"
                className={getStatusBadgeClassName(person.status)}
              >
                {person.status}
              </Badge>
              {person.statusDetail ? (
                <div className="text-xs text-foreground-tertiary">
                  {person.statusDetail}
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: () => null,
        meta: {
          headerClassName: 'w-10 whitespace-nowrap text-right pr-2',
          cellClassName: 'w-10 whitespace-nowrap text-right pr-2',
        },
        cell: ({ row }) => {
          return (
            <div className="flex justify-end">
              <DirectoryRowActions
                row={row.original}
                data={directoryRows}
                isPending={isPending}
                onUpdateRole={handleRoleChange}
                onRemoveMember={handleRemoveMember}
                onCancelInvitation={handleCancelInvitation}
              />
            </div>
          )
        },
      },
    ],
    [
      handleCancelInvitation,
      directoryRows,
      handleRemoveMember,
      handleRoleChange,
      isPending,
    ],
  )

  return (
    <ContentPage
      className="lg:pt-6"
      title={
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <div className="truncate text-2xl font-semibold text-foreground-strong">
              Workspace summary
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Form
          title={
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-10 shrink-0">
                <AvatarImage
                  src={organization.logo ?? undefined}
                  alt={organization.name}
                />
                <AvatarFallback>
                  {organization.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <span className="block max-w-full truncate text-base font-semibold text-foreground-strong">
                  {organization.name}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-foreground-tertiary">
                    {activePlanName}
                  </span>
                  <Badge
                    variant="outline"
                    className={getStatusBadgeClassName(
                      subscriptionStatusLabel,
                    )}
                  >
                    {subscriptionStatusLabel}
                  </Badge>
                </div>
              </div>
            </div>
          }
          description=""
          contentSlot={
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric
                label="Members"
                value={`${organization.memberCount} active`}
              />
              <SummaryMetric
                label="Pending invites"
                value={
                  organization.pendingInvitationCount === 0
                    ? 'None'
                    : organization.pendingInvitationCount
                }
              />
              <SummaryMetric
                label="Seats"
                value={`${organization.memberCount}/${organization.seatCount}`}
              />
              <SummaryMetric label="Plan" value={activePlanName} />
              <SummaryMetric
                label="Billing"
                value={
                  billingSourceLabel == null
                    ? 'Free tier'
                    : `${billingSourceLabel} · ${formatBillingIntervalLabel(
                        organization.billingInterval,
                      )}`
                }
              />
              <SummaryMetric
                label="Usage cap"
                value={formatUsageCapLabel(organization)}
              />
              <SummaryMetric
                label="AI spend this month"
                value={formatCurrencyAmount(organization.aiSpendThisMonth)}
              />
              <SummaryMetric
                label="AI spend all time"
                value={formatCurrencyAmount(organization.aiSpendAllTime)}
              />
              <SummaryMetric
                label="Billing period"
                value={formatBillingPeriodLabel(
                  organization.billingPeriodStart,
                  organization.billingPeriodEnd,
                )}
              />
              <SummaryMetric
                label="Subscription source"
                value={billingSourceLabel ?? 'Not applicable'}
              />
              <SummaryMetric
                label="Subscribed since"
                value={
                  organization.paidSubscriptionStartedAt == null ? (
                    'Not subscribed'
                  ) : (
                    <div className="space-y-0.5">
                      <div>{formatDateLabel(organization.paidSubscriptionStartedAt)}</div>
                      <div className="text-xs font-normal text-foreground-tertiary">
                        {formatSubscriptionAge(
                          organization.paidSubscriptionStartedAt,
                        )}
                      </div>
                    </div>
                  )
                }
              />
            </dl>
          }
          helpText=""
          forceActions
          secondaryButtonText="Copy slug"
          onSecondaryClick={() => {
            void handleCopyMetadata(organization.slug)
          }}
          buttonText="Copy org ID"
          buttonVariant="ghost"
          handleSubmit={() => handleCopyMetadata(organization.organizationId)}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <DataTable
              data={directoryRows}
              columns={directoryColumns}
              pageSize={50}
              filterColumn="name"
              filterPlaceholder="Filter members..."
              toolbarActionsRight={
                <SingularityInviteDialog
                  inviteEmail={inviteEmail}
                  inviteRole={inviteRole}
                  isPending={isPending}
                  setInviteEmail={setInviteEmail}
                  setInviteRole={setInviteRole}
                  onInvite={handleInvite}
                />
              }
              messages={{
                columns: 'Columns',
                noResults: 'No members or pending invitations found.',
                loading: 'Loading members and invitations...',
                previous: 'Previous',
                next: 'Next',
                rowsSelected: 'row(s) selected.',
              }}
            />
          </div>

          <aside className="space-y-5">
            <LayeredSideCard
              title="Plan Override"
              description="Configure manual subscriptions, usage caps, and feature access for workspaces billed outside Stripe."
            >
              <div className="space-y-5">
                <div className="grid gap-3 rounded-xl border border-border-light/70 bg-surface-overlay/60 p-4">
                  <SummaryMetric
                    label="Current source"
                    value={billingSourceLabel ?? 'Not applicable'}
                  />
                  <SummaryMetric
                    label="Current cap"
                    value={formatUsageCapLabel(organization)}
                  />
                  <SummaryMetric
                    label="Quota sync"
                    value={
                      organization.usagePolicy.syncStatus === 'degraded'
                        ? 'Needs attention'
                        : 'Healthy'
                    }
                  />
                  <SummaryMetric
                    label="Override notes"
                    value={organization.manualPlanOverride.overrideReason ?? 'None'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-plan-override">Override plan</Label>
                  <Select
                    value={selectedPlan}
                    onValueChange={(value) =>
                      setSelectedPlan(value as typeof selectedPlan)
                    }
                  >
                    <SelectTrigger
                      id="org-plan-override"
                      className="w-full bg-surface-overlay"
                      aria-label="Select plan override"
                      disabled={isPending}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start" alignItemWithTrigger={false}>
                      {WORKSPACE_PLANS.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-billing-interval">Billing interval</Label>
                  <Select
                    value={selectedBillingInterval ?? 'custom'}
                    onValueChange={(value) => setSelectedBillingInterval(value)}
                  >
                    <SelectTrigger
                      id="org-billing-interval"
                      className="w-full bg-surface-overlay"
                      aria-label="Select billing interval"
                      disabled={isPending}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start" alignItemWithTrigger={false}>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-seat-override">Override seats</Label>
                  <Input
                    id="org-seat-override"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={selectedSeatCount}
                    onChange={(event) =>
                      setSelectedSeatCount(event.target.value)
                    }
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-usage-limit-override">
                    Monthly usage cap (USD)
                  </Label>
                  <Input
                    id="org-usage-limit-override"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={selectedUsageLimitUsd}
                    onChange={(event) =>
                      setSelectedUsageLimitUsd(event.target.value)
                    }
                    disabled={isPending}
                  />
                  <p className="text-xs text-foreground-tertiary">
                    Leave empty to use the plan-derived default. Current effective
                    cap:{' '}
                    {formatUsageCapLabel(organization)}
                  </p>
                  {organization.usagePolicy.syncStatus === 'degraded'
                    && organization.usagePolicy.syncError ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Quota sync is degraded: {organization.usagePolicy.syncError}
                      </p>
                    ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-billing-reference">Billing reference</Label>
                  <Input
                    id="org-billing-reference"
                    value={selectedBillingReference}
                    onChange={(event) =>
                      setSelectedBillingReference(event.target.value)
                    }
                    placeholder="Contract, PO, invoice, or CRM reference"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-override-reason">Override reason</Label>
                  <Input
                    id="org-override-reason"
                    value={selectedOverrideReason}
                    onChange={(event) =>
                      setSelectedOverrideReason(event.target.value)
                    }
                    placeholder="Why this workspace differs from default billing"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-internal-note">Internal note</Label>
                  <Textarea
                    id="org-internal-note"
                    value={selectedInternalNote}
                    onChange={(event) =>
                      setSelectedInternalNote(event.target.value)
                    }
                    placeholder="Renewal context, support notes, or contract details"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Feature access overrides</Label>
                    <p className="text-xs text-foreground-tertiary">
                      These switches save the effective feature set for this
                      organization on top of the selected plan.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {WORKSPACE_FEATURE_IDS.map((featureId) => (
                      <div
                        key={featureId}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border-light/70 bg-surface-overlay/60 px-4 py-3"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground-strong">
                            {workspaceFeatureLabels[featureId]}
                          </div>
                          <p className="text-xs text-foreground-tertiary">
                            Current:{' '}
                            {organization.effectiveFeatures[featureId]
                              ? 'Enabled'
                              : 'Disabled'}
                          </p>
                        </div>
                        <Switch
                          checked={selectedFeatureAccess[featureId]}
                          onCheckedChange={(checked) =>
                            setSelectedFeatureAccess(featureId, checked)
                          }
                          disabled={isPending}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {organization.manualPlanOverride.overriddenAt != null ? (
                  <p className="text-xs text-foreground-tertiary">
                    Last manual update on{' '}
                    {formatDateLabel(organization.manualPlanOverride.overriddenAt)}
                    {organization.manualPlanOverride.overriddenByUserId
                      ? ` by ${organization.manualPlanOverride.overriddenByUserId}`
                      : ''}
                    .
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={resetSelectedOverridesToPlanDefaults}
                  disabled={isPending}
                >
                  Reset cap and features to plan defaults
                </Button>

                <Button
                  className="w-full"
                  size="large"
                  onClick={() => void handleSetPlan()}
                  disabled={
                    isPending
                    || !isSeatCountValid
                    || !isUsageLimitValid
                    || !hasOverrideChanges
                  }
                >
                  Apply override
                </Button>
              </div>
            </LayeredSideCard>
          </aside>
        </div>
      </div>
    </ContentPage>
  )
}
