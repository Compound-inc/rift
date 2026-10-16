import type { WorkspaceFeatureId } from '@/lib/shared/access-control'
import type { SingularityOrganizationDetail } from '../shared/singularity-admin'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
const date = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
export const formatSingularityCurrency = (amount: number) =>
  currency.format(amount)
export function formatSingularityDate(timestamp: number | null): string {
  if (timestamp == null) return 'Not set'
  const value = new Date(Number(timestamp))
  return Number.isFinite(value.getTime()) ? date.format(value) : 'Not set'
}
export const billingIntervalLabels = {
  month: 'Monthly',
  year: 'Yearly',
  custom: 'Custom',
}
export const workspaceFeatureLabels: Record<WorkspaceFeatureId, string> = {
  byok: 'Bring your own keys',
  providerPolicy: 'Provider policy',
  compliancePolicy: 'Compliance policy',
  toolPolicy: 'Tool policy',
  verifiedDomains: 'Verified domains',
  singleSignOn: 'Single sign-on',
  directoryProvisioning: 'Directory provisioning',
}
export function singularityBillingSource(
  organization: SingularityOrganizationDetail,
): string {
  if (organization.planId === 'free') return 'Free tier'
  return organization.billingProvider === 'stripe' ||
    organization.providerSubscriptionId
    ? 'Stripe'
    : 'Manual contract'
}
export function singularityUsageCap(
  organization: SingularityOrganizationDetail,
): string {
  if (!organization.usagePolicy.enabled) return 'Not metered'
  return organization.usagePolicy.organizationMonthlyBudgetUsd == null
    ? 'No organization cap'
    : formatSingularityCurrency(
        organization.usagePolicy.organizationMonthlyBudgetUsd,
      )
}
