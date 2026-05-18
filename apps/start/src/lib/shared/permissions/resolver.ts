/**
 * Permission resolver — the single source of truth for "can this user
 * use this key right now?".
 *
 * The resolver is pure. It takes a `PermissionBundle` (the data that
 * backs all decisions) and a `PermissionKey` and returns a
 * `PermissionResult`. Both `usePermissions()` (client) and
 * `PermissionService` (server) wrap this exact function; their only
 * responsibility is building the bundle from their respective data
 * sources.
 *
 * The bundle is pre-resolved — the resolver does not consult Zero or
 * Postgres. Keeping it pure makes the call site trivially testable,
 * keeps permission logic off the hot path of every render, and lets us
 * share byte-identical behavior between server and client.
 *
 * Resolution order for any key:
 *   1. Ancestors (walk up the permission tree; first failing ancestor
 *      short-circuits with `ancestor-denied`).
 *   2. Workspace features: plan rank + effective features.
 *   3. Workspace administration leaves: role permission set.
 *   4. Product umbrella/addon: entitlement (from snapshot) AND capability
 *      (from org product policy).
 *   5. Product leaf: entitlement/capability ancestors AND role permission set.
 */

import { ORG_PRODUCT_ADDON_CATALOG } from '@/lib/shared/org-product-addons'
import type { OrgProductAddonKey } from '@/lib/shared/org-product-addons'
import type { OrgProductKey } from '@/lib/shared/org-products'
import type {
  PaidWorkspacePlanId,
  ProductEntitlements,
  WorkspaceEffectiveFeatures,
  WorkspacePlanId,
} from '@/lib/shared/access-control'
import {
  getFeatureAccessGateMessage,
  getWorkspaceFeatureAccessState,
  resolveProductEntitlements,
  resolveWorkspaceEffectiveFeatures,
} from '@/lib/shared/access-control'
import type { DecodedPermissionKey, PermissionKey } from './catalog'
import { decodePermissionKey, getAncestorKeys } from './catalog'
import {
  productCapabilityKey,
  readOrgProductCapability,
} from '@/lib/shared/org-product-capabilities'

/**
 * Snapshot view of an organization's product policy, keyed by product
 * key. Pre-normalized so the resolver only reads `capabilities` maps.
 */
export type OrgProductCapabilitiesMap = Readonly<
  Partial<Record<OrgProductKey, Readonly<Record<string, boolean>>>>
>

export type PermissionBundle = {
  readonly planId: WorkspacePlanId
  readonly effectiveFeatures: WorkspaceEffectiveFeatures
  readonly productAddonEntitlements: ProductEntitlements
  /**
   * Per-product capability toggles. Missing products and missing keys
   * default to `true` (see `readOrgProductCapability`).
   */
  readonly productCapabilities: OrgProductCapabilitiesMap
  /**
   * Role-based leaf permissions the current actor holds. `null` means the
   * role layer has not been plugged in and leaves inherit their ancestor
   * decision for backwards compatibility. An empty Set is an intentional
   * deny-all role layer.
   */
  readonly rolePermissions: ReadonlySet<string> | null
}

export const EMPTY_PERMISSION_BUNDLE: PermissionBundle = {
  planId: 'free',
  effectiveFeatures: resolveWorkspaceEffectiveFeatures({ planId: 'free' }),
  productAddonEntitlements: resolveProductEntitlements({ planId: 'free' }),
  productCapabilities: {},
  rolePermissions: null,
}

export type PermissionReason =
  | 'allowed'
  | 'not-entitled'
  | 'disabled-by-admin'
  | 'plan-insufficient'
  | 'role-denied'
  | 'ancestor-denied'
  | 'invalid-key'
  | 'loading'

/**
 * Extra context paired with a denial so HTTP / UI surfaces can produce
 * richer copy (for example: "upgrade to Plus" versus "enterprise-only").
 *
 * Fields are optional; the resolver populates what is available for a
 * given reason. `minimumPlanId` is set for `plan-insufficient` reasons.
 */
export type PermissionDenialContext = {
  readonly minimumPlanId?: PaidWorkspacePlanId
  readonly gateMessage?: string
}

export type PermissionResult = {
  readonly allowed: boolean
  readonly reason: PermissionReason
  readonly context?: PermissionDenialContext
}

const ALLOW: PermissionResult = { allowed: true, reason: 'allowed' }

function deny(
  reason: PermissionReason,
  context?: PermissionDenialContext,
): PermissionResult {
  return context
    ? { allowed: false, reason, context }
    : { allowed: false, reason }
}

/**
 * Resolves a single permission key. Callers control two axes:
 *
 * - `applyCapability`: when `false`, the resolver ignores the org-admin
 *   capability kill switch. This matches the "raw entitlement" check
 *   used by settings pages (otherwise the admin would lock themselves
 *   out of the toggle that disables the product).
 * - Ancestor walking is handled by `resolvePermission` — this function
 *   only covers a single key.
 */
function resolveDecoded(
  bundle: PermissionBundle,
  decoded: DecodedPermissionKey,
  options: { readonly applyCapability: boolean },
): PermissionResult {
  if (decoded.kind === 'workspace') {
    const access = getWorkspaceFeatureAccessState({
      planId: bundle.planId,
      feature: decoded.featureId,
      effectiveFeatures: bundle.effectiveFeatures,
    })
    if (access.allowed) return ALLOW
    return deny('plan-insufficient', {
      minimumPlanId: access.minimumPlanId,
      gateMessage: getFeatureAccessGateMessage(access.minimumPlanId),
    })
  }

  if (decoded.kind === 'workspace-admin-leaf') {
    if (bundle.rolePermissions === null) return ALLOW
    const leafKey = `workspace:${decoded.leaf}`
    return bundle.rolePermissions.has(leafKey) ? ALLOW : deny('role-denied')
  }

  if (decoded.kind === 'product-umbrella') {
    const entitled =
      bundle.productAddonEntitlements[decoded.productKey] === true
    if (!entitled) return deny('not-entitled')
    if (!options.applyCapability) return ALLOW

    const capability = readOrgProductCapability({
      policy: {
        capabilities: bundle.productCapabilities[decoded.productKey] ?? {},
        settings: {},
        disabledProviderIds: [],
        disabledModelIds: [],
        disabledToolKeys: [],
        complianceFlags: {},
      },
      productKey: decoded.productKey,
    })
    return capability ? ALLOW : deny('disabled-by-admin')
  }

  if (decoded.kind === 'product-addon') {
    const id = `${decoded.productKey}.${decoded.addonKey}`
    const entitled =
      (bundle.productAddonEntitlements as Record<string, boolean>)[id] === true
    if (!entitled) return deny('not-entitled')
    if (!options.applyCapability) return ALLOW

    const capability = readOrgProductCapability({
      policy: {
        capabilities: bundle.productCapabilities[decoded.productKey] ?? {},
        settings: {},
        disabledProviderIds: [],
        disabledModelIds: [],
        disabledToolKeys: [],
        complianceFlags: {},
      },
      productKey: decoded.productKey,
      addonKey: decoded.addonKey as OrgProductAddonKey<
        typeof decoded.productKey
      >,
    })
    return capability ? ALLOW : deny('disabled-by-admin')
  }

  // product-leaf
  // When the role layer is not hydrated, leaves inherit their ancestor
  // decision so older callers keep working during migrations. Once the
  // layer is hydrated, every leaf requires an explicit role grant.
  if (bundle.rolePermissions === null) {
    return ALLOW
  }

  const leafKey = decoded.addonKey
    ? `product.${decoded.productKey}.${decoded.addonKey}:${decoded.leaf}`
    : `product.${decoded.productKey}:${decoded.leaf}`
  return bundle.rolePermissions.has(leafKey) ? ALLOW : deny('role-denied')
}

/**
 * Full resolution. Walks ancestors AND applies the org-admin capability
 * layer. The first failing ancestor short-circuits with
 * `ancestor-denied` so callers can distinguish "you can't have
 * candidates.view because you don't have hr.recruitment" from the
 * leaf's own role denial.
 */
export function resolvePermission(
  bundle: PermissionBundle,
  key: PermissionKey,
): PermissionResult {
  const decoded = decodePermissionKey(key)
  if (!decoded) return deny('invalid-key')

  const ancestors = getAncestorKeys(decoded)
  for (const ancestor of ancestors) {
    const ancestorDecoded = decodePermissionKey(ancestor)
    if (!ancestorDecoded) continue
    const ancestorResult = resolveDecoded(bundle, ancestorDecoded, {
      applyCapability: true,
    })
    if (!ancestorResult.allowed) {
      return deny('ancestor-denied')
    }
  }

  return resolveDecoded(bundle, decoded, { applyCapability: true })
}

/**
 * Raw entitlement check. Skips both ancestor walking AND the org-admin
 * capability layer.
 *
 * The intended consumer is product settings pages (e.g. HR settings)
 * that need to render when the org is entitled even if the admin has
 * turned the capability off — otherwise disabling the capability would
 * hide the page that holds the re-enable toggle.
 *
 * For admin UIs that want to see "entitled but disabled by admin" as a
 * distinct state, use `check(...)` and inspect `reason`.
 */
export function resolvePermissionRaw(
  bundle: PermissionBundle,
  key: PermissionKey,
): PermissionResult {
  const decoded = decodePermissionKey(key)
  if (!decoded) return deny('invalid-key')
  return resolveDecoded(bundle, decoded, { applyCapability: false })
}

// ---------------------------------------------------------------------------
// Bundle construction
// ---------------------------------------------------------------------------
//
// Both the client hook and the backend service build bundles from row
// data. The helpers below centralize normalization so the two stay in
// lockstep.

type ProductPolicyRowLike = {
  readonly productKey: string
  readonly capabilities?: Readonly<Record<string, unknown>> | null
}

export function buildProductCapabilitiesMap(
  rows: readonly ProductPolicyRowLike[] | null | undefined,
): OrgProductCapabilitiesMap {
  const map: Partial<Record<OrgProductKey, Record<string, boolean>>> = {}
  if (!rows) return map

  for (const row of rows) {
    if (!(row.productKey in ORG_PRODUCT_ADDON_CATALOG)) continue
    const productKey = row.productKey as OrgProductKey
    const caps: Record<string, boolean> = {}
    const raw = row.capabilities ?? {}
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'boolean') {
        caps[key] = value
      }
    }
    map[productKey] = caps
  }

  return map
}

/**
 * Convenience helper used by tests to assert a bundle has a product
 * umbrella enabled, without having to know capability storage shape.
 */
export function setCapability(input: {
  readonly bundle: PermissionBundle
  readonly productKey: OrgProductKey
  readonly addonKey?: string
  readonly enabled: boolean
}): PermissionBundle {
  const key = productCapabilityKey({ addonKey: input.addonKey })
  const currentForProduct =
    input.bundle.productCapabilities[input.productKey] ?? {}
  return {
    ...input.bundle,
    productCapabilities: {
      ...input.bundle.productCapabilities,
      [input.productKey]: {
        ...currentForProduct,
        [key]: input.enabled,
      },
    },
  }
}
