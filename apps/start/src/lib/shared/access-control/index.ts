import { isSelfHosted } from '@/utils/app-feature-flags'
import { AI_CATALOG } from '@/lib/shared/ai-catalog'
import {
  ORG_PRODUCT_ADDON_CATALOG,
  getProductAddonEntitlementIdsForProduct,
} from '@/lib/shared/org-product-addons'
import type { OrgProductAddonKey } from '@/lib/shared/org-product-addons'
import type { OrgProductKey } from '@/lib/shared/org-products'

export type WorkspacePlanId =
  | 'free'
  | 'plus'
  | 'pro'
  | 'scale'
  | 'enterprise'
  | 'self_hosted'
export type PaidWorkspacePlanId = Exclude<WorkspacePlanId, 'free'>
export type SelfServeWorkspacePlanId = Exclude<
  WorkspacePlanId,
  'enterprise' | 'self_hosted'
>
export type StripeManagedWorkspacePlanId = Exclude<
  PaidWorkspacePlanId,
  'enterprise' | 'self_hosted'
>
export type WorkspaceFeatureId =
  | 'byok'
  | 'providerPolicy'
  | 'compliancePolicy'
  | 'toolPolicy'
  | 'verifiedDomains'
  | 'singleSignOn'
  | 'directoryProvisioning'
export type RuntimeFeatureAccessId = 'chat.fileUpload' | 'chat.paidModels'
export type FeatureAccessId = WorkspaceFeatureId | RuntimeFeatureAccessId

export type WorkspaceEffectiveFeatures = Record<WorkspaceFeatureId, boolean>

export const WORKSPACE_FEATURE_IDS: readonly WorkspaceFeatureId[] = [
  'byok',
  'providerPolicy',
  'compliancePolicy',
  'toolPolicy',
  'verifiedDomains',
  'singleSignOn',
  'directoryProvisioning',
] as const

export type WorkspaceFeatureAccessState = {
  feature: WorkspaceFeatureId
  planId: WorkspacePlanId
  allowed: boolean
  minimumPlanId: PaidWorkspacePlanId
}

export type FeatureAccessState = {
  feature: FeatureAccessId
  planId: WorkspacePlanId
  allowed: boolean
  minimumPlanId: PaidWorkspacePlanId
}

export type AccessAction = {
  kind: 'upgrade' | 'contact'
  href: string
}

export type WorkspacePlan = {
  id: WorkspacePlanId
  name: string
  description: string
  includedSeats: number
  features: readonly string[]
  monthlyPriceUsd: number
  stripePriceEnvKey?: string
}

export type AccessContext = {
  isAnonymous: boolean
  planId: WorkspacePlanId
}

export type ModelAccessState = {
  modelId: string
  planId: WorkspacePlanId
  visible: true
  allowed: boolean
  reason?: 'free_tier_locked'
  minimumPlanId?: PaidWorkspacePlanId
}

/**
 * Workspace plans remain defined here because billing and access resolution
 * need a shared understanding of plan ordering.
 */
export const WORKSPACE_PLANS: readonly WorkspacePlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Core workspace access for one member.',
    includedSeats: 1,
    features: ['Core models', 'Single-member workspace'],
    monthlyPriceUsd: 0,
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Expanded model access and workspace controls.',
    includedSeats: 1,
    features: ['Expanded usage', 'BYOK', 'Workspace settings'],
    monthlyPriceUsd: 8,
    stripePriceEnvKey: 'STRIPE_PRICE_PLUS_MONTHLY',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Higher-capacity workspaces with advanced controls.',
    includedSeats: 1,
    features: ['Higher limits', 'Priority support', 'Advanced policies'],
    monthlyPriceUsd: 50,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO_MONTHLY',
  },
  {
    id: 'scale',
    name: 'Scale',
    description:
      'Operational scale with advanced identity and access controls.',
    includedSeats: 1,
    features: ['SAML SSO', 'Verified domains', 'Higher throughput'],
    monthlyPriceUsd: 100,
    stripePriceEnvKey: 'STRIPE_PRICE_SCALE_MONTHLY',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom contracts, provisioning, and security controls.',
    includedSeats: 1,
    features: [
      'Directory provisioning',
      'Custom onboarding',
      'Manual billing support',
    ],
    monthlyPriceUsd: 0,
  },
  {
    id: 'self_hosted',
    name: 'Self-Hosted',
    description:
      'Unlimited self-managed deployment with cloud-only controls disabled.',
    includedSeats: 100_000,
    features: [
      'Self-managed infrastructure',
      'Unlimited usage',
      'Manual instance control',
    ],
    monthlyPriceUsd: 0,
  },
] as const

/**
 * Organization-scoped features are persisted into `org_entitlement_snapshot`.
 * The snapshot stores the resolved boolean access state so future overrides can
 * diverge from pure plan minimums without changing call sites.
 */
export const ORG_FEATURE_MINIMUM_PLANS: Record<
  WorkspaceFeatureId,
  PaidWorkspacePlanId
> = {
  byok: 'plus',
  providerPolicy: 'plus',
  compliancePolicy: 'plus',
  toolPolicy: 'plus',
  verifiedDomains: 'pro',
  singleSignOn: 'enterprise',
  directoryProvisioning: 'enterprise',
}

/**
 * Runtime-scoped features are request/user dependent and are intentionally not
 * persisted into the org entitlement snapshot.
 */
export const RUNTIME_FEATURE_MINIMUM_PLANS: Record<
  RuntimeFeatureAccessId,
  PaidWorkspacePlanId
> = {
  'chat.fileUpload': 'plus',
  'chat.paidModels': 'plus',
}

const BILLING_SETTINGS_HREF = '/organization/settings/billing'
const ENTERPRISE_CONTACT_HREF = 'mailto:enterprise@rift.mx'

const FREE_TIER_ALLOWED_MODEL_IDS = new Set<string>(
  AI_CATALOG.filter(
    (model) =>
      model.providerId === 'meta' && model.id.startsWith('meta/llama-'),
  ).map((model) => model.id),
)

export function getWorkspacePlan(planId: WorkspacePlanId): WorkspacePlan {
  const plan = WORKSPACE_PLANS.find((candidate) => candidate.id === planId)
  if (!plan) {
    throw new Error(`Unknown workspace plan: ${planId}`)
  }
  return plan
}

export function getMinimumPlanName(planId: PaidWorkspacePlanId): string {
  return getWorkspacePlan(planId).name
}

export function isPaidWorkspacePlan(
  plan: WorkspacePlan,
): plan is WorkspacePlan & { id: PaidWorkspacePlanId } {
  return plan.id !== 'free'
}

export function isStripeManagedWorkspacePlan(
  plan: WorkspacePlan,
): plan is WorkspacePlan & { id: StripeManagedWorkspacePlanId } {
  return (
    plan.id !== 'free' && plan.id !== 'enterprise' && plan.id !== 'self_hosted'
  )
}

export function isWorkspacePlanId(
  value: string | null | undefined,
): value is WorkspacePlanId {
  return WORKSPACE_PLANS.some(
    (plan) => plan.id === value && (plan.id !== 'self_hosted' || isSelfHosted),
  )
}

export function coerceWorkspacePlanId(
  value: string | null | undefined,
): WorkspacePlanId {
  return isWorkspacePlanId(value) ? value : 'free'
}

export function getWorkspacePlanRank(planId: WorkspacePlanId): number {
  return WORKSPACE_PLANS.findIndex((plan) => plan.id === planId)
}

export function resolveStripePlanPriceId(
  planId: StripeManagedWorkspacePlanId,
): string {
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
 * Stripe schedules only expose future price ids. The billing sync mirrors those
 * schedules back into app plan ids so the billing page can render the pending
 * change without waiting for a human-maintained lookup table elsewhere.
 */
export function resolveWorkspacePlanIdFromStripePriceId(
  priceId: string,
): StripeManagedWorkspacePlanId | null {
  const normalizedPriceId = priceId.trim()
  if (!normalizedPriceId) {
    return null
  }

  const matchingPlan = WORKSPACE_PLANS.filter(
    isStripeManagedWorkspacePlan,
  ).find((plan) => {
    const envKey = plan.stripePriceEnvKey
    if (!envKey) {
      return false
    }

    return process.env[envKey]?.trim() === normalizedPriceId
  })

  return matchingPlan?.id ?? null
}

export function getMinimumPlanIdForFeature(
  feature: FeatureAccessId,
): PaidWorkspacePlanId {
  if (feature in ORG_FEATURE_MINIMUM_PLANS) {
    return ORG_FEATURE_MINIMUM_PLANS[feature as WorkspaceFeatureId]
  }

  return RUNTIME_FEATURE_MINIMUM_PLANS[feature as RuntimeFeatureAccessId]
}

/**
 * Upgrade/contact actions are derived from the minimum plan so callers do not
 * need to maintain a second catalog for CTA behavior.
 */
export function getFeatureAccessAction(
  minimumPlanId: PaidWorkspacePlanId,
): AccessAction {
  if (minimumPlanId === 'enterprise') {
    return {
      kind: 'contact',
      href: ENTERPRISE_CONTACT_HREF,
    }
  }

  return {
    kind: 'upgrade',
    href: BILLING_SETTINGS_HREF,
  }
}

/**
 * Server-side denied responses use one generic message template. UI surfaces
 * can localize the same minimum-plan decision separately.
 */
export function getFeatureAccessGateMessage(
  minimumPlanId: PaidWorkspacePlanId,
): string {
  if (minimumPlanId === 'enterprise') {
    return 'This feature is available on the Enterprise plan. Contact us to enable it.'
  }

  return `This feature is available on the ${getMinimumPlanName(minimumPlanId)} plan and above.`
}

export function getPlanEffectiveFeatures(
  planId: WorkspacePlanId,
): WorkspaceEffectiveFeatures {
  return Object.fromEntries(
    Object.entries(ORG_FEATURE_MINIMUM_PLANS).map(
      ([feature, minimumPlanId]) => [
        feature,
        getWorkspacePlanRank(planId) >= getWorkspacePlanRank(minimumPlanId),
      ],
    ),
  ) as WorkspaceEffectiveFeatures
}

/**
 * Manual contracts can diverge from the default plan feature matrix. We keep
 * that merge in one shared helper so entitlement recomputation and admin UIs
 * reason about the same final feature set.
 */
export function resolveWorkspaceEffectiveFeatures(input: {
  planId: WorkspacePlanId
  featureOverrides?: Partial<Record<WorkspaceFeatureId, boolean>>
}): WorkspaceEffectiveFeatures {
  const resolved = getPlanEffectiveFeatures(input.planId)

  for (const featureId of WORKSPACE_FEATURE_IDS) {
    const override = input.featureOverrides?.[featureId]
    if (typeof override === 'boolean') {
      resolved[featureId] = override
    }
  }

  return resolved
}

/**
 * Resolves access for any feature id from plan context alone. Organization
 * features can optionally supply `effectiveFeatures` so callers prefer the
 * materialized entitlement snapshot when one exists, while runtime features
 * always derive directly from the active plan.
 */
export function getFeatureAccessState(input: {
  feature: FeatureAccessId
  planId: WorkspacePlanId
  effectiveFeatures?: Partial<WorkspaceEffectiveFeatures>
}): FeatureAccessState {
  const minimumPlanId = getMinimumPlanIdForFeature(input.feature)
  const allowed =
    input.feature in ORG_FEATURE_MINIMUM_PLANS
      ? (input.effectiveFeatures?.[input.feature as WorkspaceFeatureId] ??
        getWorkspacePlanRank(input.planId) >=
          getWorkspacePlanRank(minimumPlanId))
      : getWorkspacePlanRank(input.planId) >=
        getWorkspacePlanRank(minimumPlanId)

  return {
    feature: input.feature,
    planId: input.planId,
    allowed,
    minimumPlanId,
  }
}

/**
 * Organization settings commonly need both the boolean result and the minimum
 * paid plan that unlocks the feature, so this wrapper narrows the generic
 * feature state helper back to the workspace-feature domain.
 */
export function getWorkspaceFeatureAccessState(input: {
  planId: WorkspacePlanId
  feature: WorkspaceFeatureId
  effectiveFeatures?: Partial<WorkspaceEffectiveFeatures>
}): WorkspaceFeatureAccessState {
  const permission = getFeatureAccessState({
    feature: input.feature,
    planId: input.planId,
    effectiveFeatures: input.effectiveFeatures,
  })

  return {
    feature: input.feature,
    planId: input.planId,
    allowed: permission.allowed,
    minimumPlanId: permission.minimumPlanId,
  }
}

/**
 * Most application code only needs a boolean access answer. This helper keeps
 * runtime feature checks compact while preserving richer state helpers for the
 * smaller number of upgrade-gated UI surfaces.
 */
export function hasFeatureAccess(
  feature: FeatureAccessId,
  context: AccessContext,
): boolean {
  return getFeatureAccessState({ feature, planId: context.planId }).allowed
}

export function isFreeTierContext(context: AccessContext): boolean {
  return context.isAnonymous || context.planId === 'free'
}

/**
 * Free-tier users can see the full catalog, but only the allowlisted models
 * can be selected or executed.
 */
export function getModelAccess(input: {
  modelId: string
  context: AccessContext
}): ModelAccessState {
  if (!isFreeTierContext(input.context)) {
    return {
      modelId: input.modelId,
      planId: input.context.planId,
      visible: true,
      allowed: true,
    }
  }

  if (FREE_TIER_ALLOWED_MODEL_IDS.has(input.modelId)) {
    return {
      modelId: input.modelId,
      planId: input.context.planId,
      visible: true,
      allowed: true,
    }
  }

  return {
    modelId: input.modelId,
    planId: input.context.planId,
    visible: true,
    allowed: false,
    reason: 'free_tier_locked',
    minimumPlanId: RUNTIME_FEATURE_MINIMUM_PLANS['chat.paidModels'],
  }
}

// ---------------------------------------------------------------------------
// Product addon entitlements
// ---------------------------------------------------------------------------

/**
 * Template-literal union of every valid product-addon entitlement id.
 * Derived from the product catalog + addon catalog, so adding a new addon
 * automatically extends this union with no manual edits here.
 */
export type ProductAddonEntitlementId = {
  [K in OrgProductKey]: OrgProductAddonKey<K> extends never
    ? K
    : K | `${K}.${OrgProductAddonKey<K>}`
}[OrgProductKey]

export const PRODUCT_ADDON_ENTITLEMENT_IDS: readonly ProductAddonEntitlementId[] =
  (Object.keys(ORG_PRODUCT_ADDON_CATALOG) as OrgProductKey[]).flatMap(
    (productKey) => getProductAddonEntitlementIdsForProduct(productKey),
  ) as readonly ProductAddonEntitlementId[]

export type ProductAddonEntitlements = Record<
  ProductAddonEntitlementId,
  boolean
>

/**
 * Partial map of entitlement ids to booleans. Used for both plan defaults
 * and per-org explicit grants. `true` means granted, `false` means
 * explicitly revoked (so a plan-default `true` can be overridden off for a
 * specific org), `undefined`/missing means "inherit the layer below".
 */
export type ProductAddonGrants = Partial<
  Record<ProductAddonEntitlementId, boolean>
>

export const PLAN_DEFAULT_PRODUCT_ADDONS: Readonly<
  Record<WorkspacePlanId, ProductAddonGrants>
> = {
  free: {},
  plus: {},
  pro: {},
  scale: {},
  enterprise: {},
  self_hosted: {},
}

/**
 * Resolves the final product-addon entitlement map for an organization by
 * layering the plan defaults with the explicit grants persisted on the
 * subscription.
 *
 * - `planId` controls the base layer (`PLAN_DEFAULT_PRODUCT_ADDONS`).
 * - `addonGrants` is the explicit per-org layer; when a grant is a boolean
 *   it replaces whatever the plan defaulted to, when it is missing the
 *   plan default survives.
 *
 */
export function resolveProductAddonEntitlements(input: {
  readonly planId?: WorkspacePlanId | null
  readonly addonGrants?: ProductAddonGrants | null
}): ProductAddonEntitlements {
  const resolved = Object.fromEntries(
    PRODUCT_ADDON_ENTITLEMENT_IDS.map((id) => [id, false]),
  ) as ProductAddonEntitlements

  const planId: WorkspacePlanId = input.planId ?? 'free'
  const planDefaults = PLAN_DEFAULT_PRODUCT_ADDONS[planId] ?? {}

  for (const id of PRODUCT_ADDON_ENTITLEMENT_IDS) {
    const planDefault = planDefaults[id]
    if (typeof planDefault === 'boolean') {
      resolved[id] = planDefault
    }
  }

  if (input.addonGrants) {
    for (const id of PRODUCT_ADDON_ENTITLEMENT_IDS) {
      const grant = input.addonGrants[id]
      if (typeof grant === 'boolean') {
        resolved[id] = grant
      }
    }
  }

  return resolved
}

export function isProductAddonEntitlementId(
  value: string,
): value is ProductAddonEntitlementId {
  return (PRODUCT_ADDON_ENTITLEMENT_IDS as readonly string[]).includes(value)
}

/**
 * Helper for reading a single entitlement from a resolved
 * entitlements map without repeating dot-key construction at call sites.
 */
export function readProductAddonEntitlement<
  TProduct extends OrgProductKey,
>(input: {
  readonly entitlements: ProductAddonEntitlements | null | undefined
  readonly productKey: TProduct
  readonly addonKey?: OrgProductAddonKey<TProduct>
}): boolean {
  if (!input.entitlements) {
    return false
  }

  const id = (
    input.addonKey ? `${input.productKey}.${input.addonKey}` : input.productKey
  ) as ProductAddonEntitlementId

  return input.entitlements[id] === true
}
