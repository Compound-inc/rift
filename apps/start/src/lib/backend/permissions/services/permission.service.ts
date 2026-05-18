/**
 * Backend-only module. Lives under `src/lib/backend/**` per the project
 * convention (`BACKEND_EFFECT_PLAYBOOK.md` §2) — nothing in the client
 * tree imports this file. The permission *read* path available to
 * browsers goes through `lib/frontend/permissions/use-permissions.ts`,
 * which imports only pure helpers from `@/lib/shared/permissions`.
 */

import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { coerceManualSubscriptionMetadata } from '@/lib/backend/billing/services/workspace-billing/shared'
import { normalizeOrgProductPolicy } from '@/lib/shared/org-product-policy'
import {
  EMPTY_PERMISSION_BUNDLE,
  buildProductCapabilitiesMap,
  getChildLeafPermissionKeys,
  resolvePermission,
  resolvePermissionRaw,
} from '@/lib/shared/permissions'
import {
  getSystemRolePermissionKeys,
  readRiftPermissionsFromDynamicPermission,
  splitOrganizationRoles,
} from '@/lib/shared/auth/org-access-control'
import type {
  OrgProductCapabilitiesMap,
  PermissionBundle,
  PermissionKey,
  PermissionResult,
} from '@/lib/shared/permissions'
import {
  coerceWorkspacePlanId,
  resolveProductEntitlements,
  resolveWorkspaceEffectiveFeatures,
} from '@/lib/shared/access-control'
import { PermissionDeniedError, PermissionResolveError } from '../domain/errors'

/**
 * Permission service.
 *
 * `forOrg({ organizationId, userId })` loads the permission bundle for
 * the target org + user from the database and returns a frozen object
 * with the same `can/canRaw/check` triad the client hook exposes.
 *
 * `authorize({ ... })` is the same check, but fails with a tagged
 * `PermissionDeniedError` so callers can thread typed error channels.
 */

type BundleInput = {
  readonly organizationId: string
  readonly userId: string
}

type AuthorizeInput = BundleInput & {
  readonly permissionKey: PermissionKey
  readonly raw?: boolean
}

export type PermissionContext = {
  readonly bundle: PermissionBundle
  readonly can: (key: PermissionKey) => boolean
  readonly canRaw: (key: PermissionKey) => boolean
  readonly canAnyChild: (key: PermissionKey) => boolean
  readonly check: (key: PermissionKey) => PermissionResult
}

export type PermissionServiceShape = {
  readonly forOrg: (
    input: BundleInput,
  ) => Effect.Effect<PermissionContext, PermissionResolveError>
  readonly authorize: (
    input: AuthorizeInput,
  ) => Effect.Effect<void, PermissionResolveError | PermissionDeniedError>
}

function toResolveError(
  cause: unknown,
  organizationId: string,
): PermissionResolveError {
  return new PermissionResolveError({
    message: 'Failed to resolve permissions for the organization.',
    organizationId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

/**
 * Builds a `PermissionDeniedError` that preserves the resolver's denial
 * context (minimum plan, gate message) so HTTP responses and telemetry
 * have everything they need without re-running gating logic.
 */
function deniedErrorFromResult(
  input: AuthorizeInput,
  result: PermissionResult,
): PermissionDeniedError {
  return new PermissionDeniedError({
    message:
      result.context?.gateMessage ??
      `Permission denied: ${input.permissionKey}`,
    organizationId: input.organizationId,
    permissionKey: input.permissionKey,
    reason: result.reason,
    minimumPlanId: result.context?.minimumPlanId,
    gateMessage: result.context?.gateMessage,
  })
}

export class PermissionService extends ServiceMap.Service<
  PermissionService,
  PermissionServiceShape
>()('permissions/PermissionService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient

      const loadBundle = Effect.fn('PermissionService.loadBundle')(
        ({ organizationId, userId: _userId }: BundleInput) =>
          Effect.gen(function* () {
            type SnapshotRow = {
              planId: string | null
              effectiveFeatures: Record<string, boolean> | null
              productAddonEntitlements: Record<string, boolean> | null
            }
            type PolicyRow = {
              productKey: string
              capabilities: Record<string, unknown> | null
            }
            type SubscriptionRow = {
              planId: string | null
              metadata: Record<string, unknown> | null
            }
            type MemberRow = {
              role: string | null
            }
            type OrganizationRoleRow = {
              role: string
              permission: string | Record<string, unknown> | null
            }

            const [
              [snapshotRow],
              policyRows,
              [subscriptionRow],
              [memberRow],
              organizationRoleRows,
            ] =
              yield* Effect.all([
                client<SnapshotRow>`
                select
                  plan_id as "planId",
                  effective_features as "effectiveFeatures",
                  product_addon_entitlements as "productAddonEntitlements"
                from org_entitlement_snapshot
                where organization_id = ${organizationId}
                limit 1
              `,
                client<PolicyRow>`
                select product_key as "productKey", capabilities
                from org_product_policy
                where organization_id = ${organizationId}
              `,
                client<SubscriptionRow>`
                select plan_id as "planId", metadata
                from org_subscription
                where organization_id = ${organizationId}
                  and status in ('active', 'trialing', 'past_due')
                order by updated_at desc
                limit 1
              `,
                client<MemberRow>`
                select role
                from member
                where "organizationId" = ${organizationId}
                  and "userId" = ${_userId}
                limit 1
              `,
                client<OrganizationRoleRow>`
                select role, permission
                from "organizationRole"
                where "organizationId" = ${organizationId}
              `,
              ])

            const planId = coerceWorkspacePlanId(
              snapshotRow?.planId ?? subscriptionRow?.planId ?? 'free',
            )
            const effectiveFeatures = (snapshotRow?.effectiveFeatures ??
              resolveWorkspaceEffectiveFeatures({
                planId,
              })) as PermissionBundle['effectiveFeatures']
            const productAddonEntitlements =
              (snapshotRow?.productAddonEntitlements ??
                resolveProductEntitlements({
                  planId,
                  addonGrants: coerceManualSubscriptionMetadata(
                    subscriptionRow?.metadata,
                  ).addonGrants,
                })) as PermissionBundle['productAddonEntitlements']
            const productCapabilities: OrgProductCapabilitiesMap =
              buildProductCapabilitiesMap(
                policyRows.map((row) => ({
                  productKey: row.productKey,
                  capabilities: normalizeOrgProductPolicy({
                    capabilities: row.capabilities,
                  }).capabilities,
                })),
              )
            const memberRoles = splitOrganizationRoles(memberRow?.role)
            const dynamicRolePermissions = new Map(
              organizationRoleRows.map((row) =>
                [
                  row.role,
                  readRiftPermissionsFromDynamicPermission(row.permission),
                ] as const,
              ),
            )
            const rolePermissions = new Set<string>()
            for (const role of memberRoles) {
              for (const key of getSystemRolePermissionKeys(role)) {
                rolePermissions.add(key)
              }
              for (const key of dynamicRolePermissions.get(role) ?? []) {
                rolePermissions.add(key)
              }
            }

            const bundle: PermissionBundle = {
              planId,
              effectiveFeatures,
              productAddonEntitlements,
              productCapabilities,
              rolePermissions,
            }

            return bundle
          }).pipe(
            Effect.mapError((cause) => toResolveError(cause, organizationId)),
          ),
      )

      const buildContext = (bundle: PermissionBundle): PermissionContext => ({
        bundle,
        can: (key) => resolvePermission(bundle, key).allowed,
        canRaw: (key) => resolvePermissionRaw(bundle, key).allowed,
        canAnyChild: (key) =>
          getChildLeafPermissionKeys(key as never).some(
            (childKey) => resolvePermission(bundle, childKey).allowed,
          ),
        check: (key) => resolvePermission(bundle, key),
      })

      return {
        forOrg: Effect.fn('PermissionService.forOrg')((input) =>
          loadBundle(input).pipe(Effect.map(buildContext)),
        ),
        authorize: Effect.fn('PermissionService.authorize')((input) =>
          loadBundle(input).pipe(
            Effect.flatMap((bundle) => {
              const result = input.raw
                ? resolvePermissionRaw(bundle, input.permissionKey)
                : resolvePermission(bundle, input.permissionKey)
              if (result.allowed) return Effect.void
              return Effect.fail(deniedErrorFromResult(input, result))
            }),
          ),
        ),
      }
    }),
  )

  /**
   * Deterministic in-memory layer for tests. Accepts a fixed bundle and
   * serves every request from it. Use `setCapability` + the entitlement
   * helpers to shape the bundle before running the service.
   */
  static readonly layerMemory = (bundle: PermissionBundle) =>
    Layer.succeed(this, {
      forOrg: Effect.fn('PermissionService.forOrg')((_input: BundleInput) =>
        Effect.succeed<PermissionContext>({
          bundle,
          can: (key: PermissionKey) => resolvePermission(bundle, key).allowed,
          canRaw: (key: PermissionKey) =>
            resolvePermissionRaw(bundle, key).allowed,
          canAnyChild: (key: PermissionKey) =>
            getChildLeafPermissionKeys(key as never).some(
              (childKey) => resolvePermission(bundle, childKey).allowed,
            ),
          check: (key: PermissionKey) => resolvePermission(bundle, key),
        }),
      ),
      authorize: Effect.fn('PermissionService.authorize')(
        (input: AuthorizeInput): Effect.Effect<void, PermissionDeniedError> => {
          const result = input.raw
            ? resolvePermissionRaw(bundle, input.permissionKey)
            : resolvePermission(bundle, input.permissionKey)
          if (result.allowed) return Effect.void
          return Effect.fail(deniedErrorFromResult(input, result))
        },
      ),
    })

  /**
   * Always-allow layer for scaffolding and local development. Intended
   * for tests that want to isolate a downstream service from permission
   * concerns.
   */
  static readonly layerNoop = Layer.succeed(this, {
    forOrg: Effect.fn('PermissionService.forOrg')(() =>
      Effect.succeed({
        bundle: EMPTY_PERMISSION_BUNDLE,
        can: () => true,
        canRaw: () => true,
        canAnyChild: () => true,
        check: () => ({ allowed: true, reason: 'allowed' }) as PermissionResult,
      }),
    ),
    authorize: Effect.fn('PermissionService.authorize')(() => Effect.void),
  })
}
