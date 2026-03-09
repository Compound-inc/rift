export type WorkspacePlanId = 'free' | 'plus' | 'pro' | 'scale' | 'enterprise'
export type PaidWorkspacePlanId = Exclude<WorkspacePlanId, 'free'>
export type StripeManagedWorkspacePlanId = Exclude<PaidWorkspacePlanId, 'enterprise'>
export type WorkspaceFeatureId
  = 'byok'
    | 'providerPolicy'
    | 'compliancePolicy'
    | 'toolPolicy'
    | 'verifiedDomains'
    | 'singleSignOn'
    | 'directoryProvisioning'

export type WorkspaceEffectiveFeatures = Record<WorkspaceFeatureId, boolean>
export type WorkspaceFeatureDefinition = {
  id: WorkspaceFeatureId
  name: string
  minimumPlanId: PaidWorkspacePlanId
  upgradeCallout: string
  action: {
    kind: 'upgrade' | 'contact'
    label: string
    href: string
  }
}
export type WorkspaceFeatureAccessState = {
  feature: WorkspaceFeatureId
  planId: WorkspacePlanId
  allowed: boolean
  minimumPlanId: PaidWorkspacePlanId
  minimumPlanName: string
  upgradeCallout: string
  action: WorkspaceFeatureDefinition['action']
}

export type WorkspacePlan = {
  id: WorkspacePlanId
  name: string
  description: string
  monthlyPriceUsd: number
  includedSeats: number
  features: readonly string[]
  stripePriceEnvKey?: string
}

/**
 * The billing UI and Stripe configuration both resolve from this catalog so
 * plan copy, checkout payloads, and entitlement sync stay aligned.
 */
export const WORKSPACE_PLANS: readonly WorkspacePlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Core workspace access for one member.',
    monthlyPriceUsd: 0,
    includedSeats: 1,
    features: ['Core models', 'Single-member workspace'],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Expanded model access and workspace controls.',
    monthlyPriceUsd: 8,
    includedSeats: 1,
    features: ['Expanded usage', 'BYOK', 'Workspace settings'],
    stripePriceEnvKey: 'STRIPE_PRICE_PLUS_MONTHLY',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Higher-capacity workspaces with advanced controls.',
    monthlyPriceUsd: 50,
    includedSeats: 1,
    features: ['Higher limits', 'Priority support', 'Advanced policies'],
    stripePriceEnvKey: 'STRIPE_PRICE_PRO_MONTHLY',
  },
  {
    id: 'scale',
    name: 'Scale',
    description: 'Operational scale with advanced identity and access controls.',
    monthlyPriceUsd: 100,
    includedSeats: 1,
    features: ['SAML SSO', 'Verified domains', 'Higher throughput'],
    stripePriceEnvKey: 'STRIPE_PRICE_SCALE_MONTHLY',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom contracts, provisioning, and security controls.',
    monthlyPriceUsd: 0,
    includedSeats: 1,
    features: ['Directory provisioning', 'Custom onboarding', 'Manual billing support'],
  },
] as const

/**
 * Plan-gated organization capabilities live in one catalog so server
 * enforcement, UI messaging, and future pricing changes all resolve from the
 * same source of truth.
 */
export const WORKSPACE_FEATURES: Record<WorkspaceFeatureId, WorkspaceFeatureDefinition> = {
  byok: {
    id: 'byok',
    name: 'Bring Your Own Key',
    minimumPlanId: 'plus',
    upgradeCallout:
      'Bring Your Own Key is available on the Plus plan and above. Upgrade this workspace to configure provider keys here.',
    action: {
      kind: 'upgrade',
      label: 'Upgrade to Plus',
      href: '/organization/settings/billing',
    },
  },
  providerPolicy: {
    id: 'providerPolicy',
    name: 'Provider Policy',
    minimumPlanId: 'pro',
    upgradeCallout:
      'Provider and model policy controls are available on the Pro plan and above. Upgrade this workspace to manage them here.',
    action: {
      kind: 'upgrade',
      label: 'Upgrade to Pro',
      href: '/organization/settings/billing',
    },
  },
  compliancePolicy: {
    id: 'compliancePolicy',
    name: 'Compliance Policy',
    minimumPlanId: 'pro',
    upgradeCallout:
      'Compliance controls are available on the Pro plan and above. Upgrade this workspace to manage them here.',
    action: {
      kind: 'upgrade',
      label: 'Upgrade to Pro',
      href: '/organization/settings/billing',
    },
  },
  toolPolicy: {
    id: 'toolPolicy',
    name: 'Tool Policy',
    minimumPlanId: 'pro',
    upgradeCallout:
      'Workspace tool controls are available on the Pro plan and above. Upgrade this workspace to manage them here.',
    action: {
      kind: 'upgrade',
      label: 'Upgrade to Pro',
      href: '/organization/settings/billing',
    },
  },
  verifiedDomains: {
    id: 'verifiedDomains',
    name: 'Verified Domains',
    minimumPlanId: 'pro',
    upgradeCallout:
      'Verified domains are available on the Pro plan and above. Upgrade this workspace to manage domains here.',
    action: {
      kind: 'upgrade',
      label: 'Upgrade to Pro',
      href: '/organization/settings/billing',
    },
  },
  singleSignOn: {
    id: 'singleSignOn',
    name: 'Single Sign-On',
    minimumPlanId: 'pro',
    upgradeCallout:
      'Single Sign-On is available on the Pro plan and above. Upgrade this workspace to configure SSO here.',
    action: {
      kind: 'upgrade',
      label: 'Upgrade to Pro',
      href: '/organization/settings/billing',
    },
  },
  directoryProvisioning: {
    id: 'directoryProvisioning',
    name: 'Directory Provisioning',
    minimumPlanId: 'enterprise',
    upgradeCallout:
      'Directory provisioning is available on the Enterprise plan. Contact us to enable it for this workspace.',
    action: {
      kind: 'contact',
      label: 'Contact us',
      href: 'mailto:enterprise@rift.mx',
    },
  },
}

export function getWorkspacePlan(planId: WorkspacePlanId): WorkspacePlan {
  const plan = WORKSPACE_PLANS.find((candidate) => candidate.id === planId)
  if (!plan) {
    throw new Error(`Unknown workspace plan: ${planId}`)
  }
  return plan
}

export function isPaidWorkspacePlan(
  plan: WorkspacePlan,
): plan is WorkspacePlan & { id: PaidWorkspacePlanId } {
  return plan.id !== 'free'
}

export function isStripeManagedWorkspacePlan(
  plan: WorkspacePlan,
): plan is WorkspacePlan & { id: StripeManagedWorkspacePlanId } {
  return plan.id !== 'free' && plan.id !== 'enterprise'
}

export function isWorkspacePlanId(value: string | null | undefined): value is WorkspacePlanId {
  return WORKSPACE_PLANS.some((plan) => plan.id === value)
}

export function coerceWorkspacePlanId(value: string | null | undefined): WorkspacePlanId {
  return isWorkspacePlanId(value) ? value : 'free'
}

export function getWorkspacePlanRank(planId: WorkspacePlanId): number {
  return WORKSPACE_PLANS.findIndex((plan) => plan.id === planId)
}

export function resolveStripePlanPriceId(planId: StripeManagedWorkspacePlanId): string {
  const plan = getWorkspacePlan(planId)
  const envKey = plan.stripePriceEnvKey

  if (!envKey) {
    throw new Error(`Plan ${planId} is not backed by Stripe pricing`)
  }

  const value = process.env[envKey]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable ${envKey}`)
  }

  return value
}

/**
 * Server and client guards read a normalized boolean map so plan gating stays
 * stable even when UI copy changes independently of authorization behavior.
 */
export function getPlanEffectiveFeatures(
  planId: WorkspacePlanId,
): WorkspaceEffectiveFeatures {
  return Object.fromEntries(
    Object.values(WORKSPACE_FEATURES).map((feature) => [
      feature.id,
      hasWorkspaceFeatureAccess(planId, feature.id),
    ]),
  ) as WorkspaceEffectiveFeatures
}

export function getWorkspaceFeatureDefinition(
  feature: WorkspaceFeatureId,
): WorkspaceFeatureDefinition {
  return WORKSPACE_FEATURES[feature]
}

export function hasWorkspaceFeatureAccess(
  planId: WorkspacePlanId,
  feature: WorkspaceFeatureId,
): boolean {
  const minimumPlanId = getWorkspaceFeatureDefinition(feature).minimumPlanId
  return getWorkspacePlanRank(planId) >= getWorkspacePlanRank(minimumPlanId)
}

export function getWorkspaceFeatureAccessState(input: {
  planId: WorkspacePlanId
  feature: WorkspaceFeatureId
  effectiveFeatures?: Partial<WorkspaceEffectiveFeatures>
}): WorkspaceFeatureAccessState {
  const definition = getWorkspaceFeatureDefinition(input.feature)
  const minimumPlan = getWorkspacePlan(definition.minimumPlanId)
  const allowed = input.effectiveFeatures?.[input.feature]
    ?? hasWorkspaceFeatureAccess(input.planId, input.feature)

  return {
    feature: input.feature,
    planId: input.planId,
    allowed,
    minimumPlanId: definition.minimumPlanId,
    minimumPlanName: minimumPlan.name,
    upgradeCallout: definition.upgradeCallout,
    action: definition.action,
  }
}
