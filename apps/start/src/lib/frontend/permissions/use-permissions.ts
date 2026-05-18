'use client'

/**
 * Canonical permission hook for the client.
 *
 * `usePermissions()` is the ONE call surface every user-facing gate
 * should use (sidebar rails, route guards, product UIs, conditional
 * actions). It reads from the single layout-level Zero subscription
 * (`queries.orgBilling.currentSummary`) and returns the synchronous
 * resolver triad plus a loading flag.
 *
 * Typesafety:
 *
 *   can('product.hr.recruitment')      // ✓ auto-completes
 *   can('product.hq')                  // ✗ compile error
 *
 * The `can(...)` key union is derived from the shared permission
 * catalog; adding a new product / addon / leaf extends the union
 * automatically.
 *
 * Workspace features additionally expose `workspaceFeatureState(...)`
 * which returns upgrade-hint metadata (the minimum plan that unlocks
 * the feature) for forms and BYOK-style pages that render a locked UI.
 *
 * See `apps/start/PERMISSIONS.md` for the full model.
 */

import { useMemo } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { queries } from '@/integrations/zero'
import {
  EMPTY_PERMISSION_BUNDLE,
  buildProductCapabilitiesMap,
  resolvePermission,
  resolvePermissionRaw,
} from '@/lib/shared/permissions'
import type {
  PermissionBundle,
  PermissionKey,
  PermissionResult,
} from '@/lib/shared/permissions'
import {
  coerceWorkspacePlanId,
  getWorkspaceFeatureAccessState,
  resolveProductEntitlements,
  resolveWorkspaceEffectiveFeatures,
} from '@/lib/shared/access-control'
import type {
  ProductEntitlements,
  WorkspaceEffectiveFeatures,
  WorkspaceFeatureAccessState,
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '@/lib/shared/access-control'

const MISSING_ORG_SENTINEL = '__missing_org__'

type BillingSummaryRow = {
  id: string
  subscriptions?: readonly { planId?: string | null }[]
  entitlementSnapshots?: readonly {
    planId?: string | null
    effectiveFeatures?: WorkspaceEffectiveFeatures | null
    productAddonEntitlements?: ProductEntitlements | null
  }[]
  productPolicies?: readonly {
    productKey: string
    capabilities?: Readonly<Record<string, unknown>> | null
  }[]
}

type PermissionsContext = {
  /** Resolved permission check: walks ancestors AND composes all layers. */
  readonly can: (key: PermissionKey) => boolean
  /** Raw single-layer check (skips ancestor walking). Admin UI only. */
  readonly canRaw: (key: PermissionKey) => boolean
  /** Full result including discriminated `reason` for richer UX copy. */
  readonly check: (key: PermissionKey) => PermissionResult
  /**
   * Workspace-feature state including upgrade-hint metadata. Use for
   * settings pages that render a locked UI when a feature is gated
   * behind a higher plan.
   */
  readonly workspaceFeatureState: (
    feature: WorkspaceFeatureId,
  ) => WorkspaceFeatureAccessState & { loading: boolean }
  /** True only while Zero is still resolving the layout query. */
  readonly loading: boolean
}

function buildBundleFromRow(input: {
  readonly row: BillingSummaryRow | null | undefined
  readonly activeOrganizationId: string | null | undefined
}): PermissionBundle {
  const { row, activeOrganizationId } = input
  if (!row || !activeOrganizationId || row.id !== activeOrganizationId) {
    return EMPTY_PERMISSION_BUNDLE
  }

  const snapshot = row.entitlementSnapshots?.[0]
  const planId: WorkspacePlanId = coerceWorkspacePlanId(
    snapshot?.planId ?? row.subscriptions?.[0]?.planId ?? 'free',
  )

  const effectiveFeatures =
    snapshot?.effectiveFeatures ?? resolveWorkspaceEffectiveFeatures({ planId })

  const productAddonEntitlements =
    snapshot?.productAddonEntitlements ??
    resolveProductEntitlements({ planId })

  const productCapabilities = buildProductCapabilitiesMap(row.productPolicies)

  return {
    planId,
    effectiveFeatures,
    productAddonEntitlements,
    productCapabilities,
    rolePermissions: EMPTY_PERMISSION_BUNDLE.rolePermissions,
  }
}

export function usePermissions(): PermissionsContext {
  const { activeOrganizationId } = useAppAuth()
  const requestedOrganizationId =
    activeOrganizationId?.trim() ?? MISSING_ORG_SENTINEL
  const [summary, result] = useQuery(
    queries.orgBilling.currentSummary({
      organizationId: requestedOrganizationId,
    }),
  )

  return useMemo<PermissionsContext>(() => {
    const loading = !!activeOrganizationId && result.type !== 'complete'
    const bundle = buildBundleFromRow({
      row: (summary as BillingSummaryRow | null | undefined) ?? null,
      activeOrganizationId,
    })

    return {
      can: (key) => resolvePermission(bundle, key).allowed,
      canRaw: (key) => resolvePermissionRaw(bundle, key).allowed,
      check: (key) => {
        if (loading) {
          return { allowed: false, reason: 'loading' }
        }
        return resolvePermission(bundle, key)
      },
      workspaceFeatureState: (feature) => ({
        loading,
        ...getWorkspaceFeatureAccessState({
          planId: bundle.planId,
          feature,
          effectiveFeatures: bundle.effectiveFeatures,
        }),
      }),
      loading,
    }
  }, [activeOrganizationId, result.type, summary])
}

/**
 * Pure helper exposed for tests and non-React callers. Building the
 * bundle in one function keeps the hook and tests in lockstep — if the
 * hook changes how it decodes the row, the tests cover the same path.
 */
export function buildPermissionBundleFromSummary(input: {
  readonly row: unknown
  readonly activeOrganizationId: string | null | undefined
}): PermissionBundle {
  return buildBundleFromRow({
    row: (input.row as BillingSummaryRow | null | undefined) ?? null,
    activeOrganizationId: input.activeOrganizationId,
  })
}
