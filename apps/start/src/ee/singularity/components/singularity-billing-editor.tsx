import { useState } from 'react'
import type { ReactNode } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import { Switch } from '@rift/ui/switch'
import { Textarea } from '@rift/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rift/ui/select'
import { CircleAlert, RotateCcw } from 'lucide-react'
import {
  getPlanEffectiveFeatures,
  getWorkspacePlan,
  isWorkspacePlanId,
  WORKSPACE_FEATURE_IDS,
  WORKSPACE_PLANS,
} from '@/lib/shared/access-control'
import type { SingularityOrganizationDetail } from '../shared/singularity-admin'
import type { SingularityOrgActions } from './singularity-org-detail-page.logic'
import {
  createSingularityPlanDraft,
  hasSingularityPlanChanges,
  validateSingularityPlanDraft,
} from './singularity-plan-draft'
import type { SingularityPlanDraft } from './singularity-plan-draft'
import {
  billingIntervalLabels,
  formatSingularityCurrency,
  formatSingularityDate,
  singularityBillingSource,
  workspaceFeatureLabels,
} from './singularity-format'
import { SingularityConfirmDialog, SingularityPanel } from './singularity-ui'

function Field({
  label,
  id,
  error,
  help,
  children,
}: {
  label: string
  id: string
  error?: string
  help?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-foreground-error"
        >
          {error}
        </p>
      ) : (
        help && <p className="text-xs text-foreground-tertiary">{help}</p>
      )}
    </div>
  )
}

/** The editor is keyed by the billing snapshot, so a successful reload establishes a fresh baseline. */
export function SingularityBillingEditor({
  organization,
  actions,
}: {
  organization: SingularityOrganizationDetail
  actions: SingularityOrgActions
}) {
  const [draft, setDraft] = useState(() =>
    createSingularityPlanDraft(organization),
  )
  const [reviewOpen, setReviewOpen] = useState(false)
  const changed = hasSingularityPlanChanges(organization, draft)
  const errors = validateSingularityPlanDraft(draft)
  const free = draft.planId === 'free'
  const defaults = getPlanEffectiveFeatures(draft.planId)
  const patch = <TKey extends keyof SingularityPlanDraft>(
    key: TKey,
    value: SingularityPlanDraft[TKey],
  ) => setDraft((current) => ({ ...current, [key]: value }))
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      changed && current.pathname !== next.pathname,
    enableBeforeUnload: changed,
    withResolver: true,
  })
  const before = createSingularityPlanDraft(organization)
  const changes = [
    {
      label: 'Plan',
      before: getWorkspacePlan(before.planId).name,
      after: getWorkspacePlan(draft.planId).name,
    },
    {
      label: 'Seats',
      before: before.seatCount,
      after: free
        ? String(getWorkspacePlan('free').includedSeats)
        : draft.seatCount,
    },
    {
      label: 'Billing interval',
      before:
        organization.planId === 'free'
          ? 'None'
          : billingIntervalLabels[before.billingInterval],
      after: free ? 'None' : billingIntervalLabels[draft.billingInterval],
    },
    {
      label: 'Monthly cap',
      before: before.monthlyUsageLimitUsd
        ? formatSingularityCurrency(Number(before.monthlyUsageLimitUsd))
        : 'Plan default',
      after:
        free || !draft.monthlyUsageLimitUsd.trim()
          ? 'Plan default'
          : formatSingularityCurrency(Number(draft.monthlyUsageLimitUsd)),
    },
    {
      label: 'Billing reference',
      before: before.billingReference || 'None',
      after: free ? 'None' : draft.billingReference.trim() || 'None',
    },
    {
      label: 'Override reason',
      before: before.overrideReason || 'None',
      after: free ? 'None' : draft.overrideReason.trim() || 'None',
    },
    {
      label: 'Internal note',
      before: before.internalNote || 'None',
      after: free ? 'None' : draft.internalNote.trim() || 'None',
    },
    ...WORKSPACE_FEATURE_IDS.map((feature) => ({
      label: workspaceFeatureLabels[feature],
      before: before.featureAccess[feature] ? 'Enabled' : 'Disabled',
      after: !free && draft.featureAccess[feature] ? 'Enabled' : 'Disabled',
    })),
  ].filter((change) => change.before !== change.after)
  return (
    <div className="space-y-5">
      <SingularityPanel
        title="Manual contract"
        description="Set the plan, seat capacity, and access for this workspace."
        action={
          <span className="rounded-md bg-surface-overlay px-2 py-1 text-xs text-foreground-tertiary">
            Current source · {singularityBillingSource(organization)}
          </span>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (changed && Object.keys(errors).length === 0) setReviewOpen(true)
          }}
          className="space-y-6"
        >
          {organization.billingProvider === 'stripe' && (
            <p className="flex gap-2 rounded-lg bg-surface-warning p-3 text-sm text-foreground-warning">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              This applies a manual contract in Rift. Manage Stripe charges and
              cancellations separately in Stripe.
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="singularity-plan"
              label="Plan"
              help="Choosing a plan loads its default feature access."
            >
              <Select
                value={draft.planId}
                onValueChange={(value) => {
                  if (value && isWorkspacePlanId(value))
                    setDraft((current) => ({
                      ...current,
                      planId: value,
                      featureAccess: getPlanEffectiveFeatures(value),
                    }))
                }}
              >
                <SelectTrigger
                  id="singularity-plan"
                  className="w-full"
                  disabled={actions.isPending || actions.needsRefresh}
                >
                  <SelectValue>
                    {getWorkspacePlan(draft.planId).name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {WORKSPACE_PLANS.filter((plan) =>
                    isWorkspacePlanId(plan.id),
                  ).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="singularity-seats"
              label="Seat capacity"
              error={errors.seatCount}
              help={
                free
                  ? 'The Free plan uses its included seat capacity.'
                  : `${organization.memberCount + organization.pendingInvitationCount} seats in use, including pending invitations.`
              }
            >
              <Input
                id="singularity-seats"
                type="text"
                inputMode="numeric"
                value={
                  free
                    ? String(getWorkspacePlan('free').includedSeats)
                    : draft.seatCount
                }
                onChange={(event) => patch('seatCount', event.target.value)}
                disabled={actions.isPending || actions.needsRefresh || free}
                aria-invalid={Boolean(errors.seatCount)}
                aria-describedby={
                  errors.seatCount ? 'singularity-seats-error' : undefined
                }
              />
            </Field>
            <Field
              id="singularity-interval"
              label="Billing interval"
              error={errors.billingInterval}
            >
              <Select
                value={draft.billingInterval}
                onValueChange={(value) => {
                  if (
                    value === 'month' ||
                    value === 'year' ||
                    value === 'custom'
                  )
                    patch('billingInterval', value)
                }}
              >
                <SelectTrigger
                  id="singularity-interval"
                  className="w-full"
                  disabled={actions.isPending || actions.needsRefresh || free}
                  aria-invalid={Boolean(errors.billingInterval)}
                  aria-describedby={
                    errors.billingInterval
                      ? 'singularity-interval-error'
                      : undefined
                  }
                >
                  <SelectValue>
                    {billingIntervalLabels[draft.billingInterval]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(billingIntervalLabels).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="singularity-cap"
              label="Monthly usage cap (USD)"
              error={errors.monthlyUsageLimitUsd}
              help="Leave empty to follow the plan default. Zero blocks metered usage."
            >
              <Input
                id="singularity-cap"
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                inputMode="decimal"
                placeholder="Plan default"
                value={draft.monthlyUsageLimitUsd}
                onChange={(event) =>
                  patch('monthlyUsageLimitUsd', event.target.value)
                }
                disabled={actions.isPending || actions.needsRefresh || free}
                aria-invalid={Boolean(errors.monthlyUsageLimitUsd)}
                aria-describedby={
                  errors.monthlyUsageLimitUsd
                    ? 'singularity-cap-error'
                    : undefined
                }
              />
            </Field>
          </div>
          {!free &&
            Number(draft.seatCount) <
              organization.memberCount +
                organization.pendingInvitationCount && (
              <p className="flex gap-2 rounded-lg bg-surface-warning p-3 text-sm text-foreground-warning">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                The selected capacity is below the number of members and
                invitations. Some members may have restricted access.
              </p>
            )}
          {free && organization.planId !== 'free' && (
            <p className="rounded-lg bg-surface-warning p-3 text-sm text-foreground-warning">
              Switching to Free removes the manual contract, custom usage cap,
              contract notes, and feature overrides. The Free plan includes{' '}
              {getWorkspacePlan('free').includedSeats} seat.
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="singularity-reference"
              label="Billing reference"
              error={errors.billingReference}
            >
              <Input
                id="singularity-reference"
                placeholder="Contract, purchase order, or invoice"
                maxLength={255}
                value={draft.billingReference}
                onChange={(event) =>
                  patch('billingReference', event.target.value)
                }
                disabled={actions.isPending || actions.needsRefresh || free}
              />
            </Field>
            <Field
              id="singularity-reason"
              label="Override reason"
              error={errors.overrideReason}
            >
              <Input
                id="singularity-reason"
                placeholder="Why this workspace needs an override"
                maxLength={500}
                value={draft.overrideReason}
                onChange={(event) =>
                  patch('overrideReason', event.target.value)
                }
                disabled={actions.isPending || actions.needsRefresh || free}
              />
            </Field>
          </div>
          <Field
            id="singularity-note"
            label="Internal note"
            error={errors.internalNote}
          >
            <Textarea
              id="singularity-note"
              placeholder="Support context, renewal details, or contract notes"
              maxLength={2000}
              value={draft.internalNote}
              onChange={(event) => patch('internalNote', event.target.value)}
              disabled={actions.isPending || actions.needsRefresh || free}
            />
          </Field>
          <fieldset
            disabled={actions.isPending || actions.needsRefresh || free}
            className="space-y-3"
          >
            <legend className="mb-1 text-sm font-medium text-foreground-strong">
              Feature access
            </legend>
            <p className="text-xs text-foreground-tertiary">
              Changes from the selected plan are marked as overrides.
            </p>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {WORKSPACE_FEATURE_IDS.map((feature) => (
                <div
                  key={feature}
                  className="flex min-h-16 items-center justify-between gap-4 border-b border-border-base py-3"
                >
                  <div>
                    <Label htmlFor={`singularity-feature-${feature}`}>
                      {workspaceFeatureLabels[feature]}
                    </Label>
                    <p className="mt-1 text-xs text-foreground-tertiary">
                      {!free &&
                      draft.featureAccess[feature] !== defaults[feature]
                        ? 'Custom override'
                        : 'Plan default'}
                    </p>
                  </div>
                  <Switch
                    id={`singularity-feature-${feature}`}
                    aria-label={workspaceFeatureLabels[feature]}
                    checked={!free && draft.featureAccess[feature]}
                    onCheckedChange={(checked) =>
                      patch('featureAccess', {
                        ...draft.featureAccess,
                        [feature]: checked,
                      })
                    }
                    disabled={actions.isPending || actions.needsRefresh || free}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="large"
              className="gap-2"
              disabled={actions.isPending || actions.needsRefresh || free}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  monthlyUsageLimitUsd: '',
                  featureAccess: getPlanEffectiveFeatures(current.planId),
                }))
              }
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Use plan cap & feature defaults
            </Button>
          </fieldset>
          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-border-base bg-surface-raised p-4">
            <span role="status" className="text-xs text-foreground-tertiary">
              {changed ? 'You have unsaved changes' : 'No unsaved changes'}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="large"
                disabled={!changed || actions.isPending}
                onClick={() =>
                  setDraft(createSingularityPlanDraft(organization))
                }
              >
                Discard
              </Button>
              <Button
                type="submit"
                size="large"
                disabled={
                  !changed ||
                  actions.isPending ||
                  actions.needsRefresh ||
                  Object.keys(errors).length > 0
                }
              >
                Review changes
              </Button>
            </div>
          </div>
        </form>
      </SingularityPanel>
      {organization.manualPlanOverride.overriddenAt != null && (
        <p className="text-xs text-foreground-tertiary">
          Last manual update{' '}
          {formatSingularityDate(organization.manualPlanOverride.overriddenAt)}
          {organization.manualPlanOverride.overriddenByUserId &&
            ` · ${organization.manualPlanOverride.overriddenByUserId}`}
        </p>
      )}
      <SingularityConfirmDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Apply contract changes?"
        description={organization.name}
        confirmLabel="Apply changes"
        danger={free}
        isPending={actions.isPending}
        onConfirm={() => actions.handleSetPlan(draft)}
      >
        <dl className="divide-y divide-border-base">
          {changes.map((change) => (
            <div key={change.label} className="py-3">
              <dt className="text-xs text-foreground-tertiary">
                {change.label}
              </dt>
              <dd className="mt-1 break-words text-sm">
                <span className="text-foreground-tertiary line-through">
                  {change.before}
                </span>
                <span
                  className="mx-2 text-foreground-tertiary"
                  aria-label="changes to"
                >
                  →
                </span>
                <span className="text-foreground-strong">{change.after}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-foreground-tertiary">
          The updated contract takes effect immediately in Rift.
        </p>
      </SingularityConfirmDialog>
      <SingularityConfirmDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        title="Discard unsaved contract changes?"
        description="Your edits have not been applied to this workspace."
        confirmLabel="Discard and leave"
        danger
        isPending={false}
        onConfirm={async () => {
          blocker.proceed?.()
          return true
        }}
      />
    </div>
  )
}
