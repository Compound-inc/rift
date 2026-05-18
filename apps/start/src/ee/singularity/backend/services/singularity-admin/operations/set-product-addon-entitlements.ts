import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { ensureOrganizationBillingBaselineEffect } from '@/lib/backend/auth/services/default-organization.service'
import { withBillingTransactionEffect } from '@/lib/backend/billing/services/sql'
import {
  readCurrentOrgSubscriptionEffect,
  readOrganizationMemberCountsEffect,
  upsertEntitlementSnapshotEffect,
  upsertOrgSubscriptionEffect,
} from '@/lib/backend/billing/services/workspace-billing/persistence'
import {
  asRecord,
  coerceManualSubscriptionMetadata,
} from '@/lib/backend/billing/services/workspace-billing/shared'
import { isProductEntitlementId } from '@/lib/shared/access-control'
import type { ProductEntitlementId } from '@/lib/shared/access-control'
import {
  SingularityNotFoundError,
  SingularityPersistenceError,
  SingularityValidationError,
} from '../../../domain/errors'
import { readOrganizationExistsEffect } from '../queries'

type RawAddonGrants =
  | Partial<Record<ProductEntitlementId, boolean>>
  | Record<string, boolean>

export function normalizeAddonGrants(
  grants: RawAddonGrants,
): Partial<Record<ProductEntitlementId, boolean>> {
  const normalized: Partial<Record<ProductEntitlementId, boolean>> = {}

  for (const [rawKey, value] of Object.entries(grants)) {
    if (typeof value !== 'boolean') continue
    if (!isProductEntitlementId(rawKey)) continue
    normalized[rawKey] = value
  }

  return normalized
}

export function buildAddonGrantMetadata(input: {
  readonly currentMetadata: Record<string, unknown>
  readonly actorUserId: string
  readonly now: number
  readonly addonGrants: Partial<Record<ProductEntitlementId, boolean>>
}): Record<string, unknown> {
  return {
    ...input.currentMetadata,
    overrideSource: 'singularity',
    overriddenByUserId: input.actorUserId,
    overriddenAt: input.now,
    addonGrants: input.addonGrants,
  }
}

function toPersistenceError(
  message: string,
  cause: unknown,
  organizationId?: string,
): SingularityPersistenceError {
  return new SingularityPersistenceError({
    message,
    organizationId,
    cause: cause instanceof Error ? cause.message : String(cause ?? message),
  })
}

export const setProductEntitlementsOperation = Effect.fn(
  'SingularityAdminService.setProductEntitlements',
)(
  (input: {
    readonly organizationId: string
    readonly actorUserId: string
    readonly grants: RawAddonGrants
  }): Effect.Effect<
    void,
    | SingularityNotFoundError
    | SingularityValidationError
    | SingularityPersistenceError,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const { organizationId, actorUserId, grants } = input
      const normalizedGrants = normalizeAddonGrants(grants)

      const organizationExists = yield* readOrganizationExistsEffect(
        organizationId,
      ).pipe(
        Effect.mapError((cause) =>
          toPersistenceError(
            'Failed to update the product addon entitlements.',
            cause,
            organizationId,
          ),
        ),
      )

      if (!organizationExists) {
        return yield* Effect.fail(
          new SingularityNotFoundError({
            message: 'Organization not found.',
            organizationId,
          }),
        )
      }

      yield* ensureOrganizationBillingBaselineEffect(organizationId).pipe(
        Effect.mapError((cause) =>
          toPersistenceError(
            'Failed to update the product addon entitlements.',
            cause,
            organizationId,
          ),
        ),
      )

      yield* withBillingTransactionEffect((client) =>
        Effect.gen(function* () {
          const currentSubscription = yield* readCurrentOrgSubscriptionEffect({
            organizationId,
            client,
          })

          if (!currentSubscription) {
            return yield* Effect.fail(
              new SingularityNotFoundError({
                message: 'No active subscription found for the organization.',
                organizationId,
              }),
            )
          }

          const counts = yield* readOrganizationMemberCountsEffect({
            organizationId,
            client,
          })
          const now = Date.now()
          const existingMetadata = asRecord(currentSubscription.metadata)
          const existingGrants =
            coerceManualSubscriptionMetadata(existingMetadata).addonGrants
          const mergedGrants = {
            ...existingGrants,
            ...normalizedGrants,
          }

          yield* upsertOrgSubscriptionEffect({
            subscriptionId: currentSubscription.id,
            organizationId,
            billingAccountId: `billing_${organizationId}`,
            providerSubscriptionId: currentSubscription.providerSubscriptionId,
            planId: currentSubscription.planId,
            billingInterval: currentSubscription.billingInterval,
            seatCount: currentSubscription.seatCount ?? 1,
            status: currentSubscription.status,
            periodStart: currentSubscription.currentPeriodStart,
            periodEnd: currentSubscription.currentPeriodEnd,
            cancelAtPeriodEnd: false,
            metadata: buildAddonGrantMetadata({
              currentMetadata: existingMetadata,
              actorUserId,
              now,
              addonGrants: mergedGrants,
            }),
            now,
            client,
          })

          const refreshedSubscription = yield* readCurrentOrgSubscriptionEffect(
            {
              organizationId,
              client,
            },
          )

          yield* upsertEntitlementSnapshotEffect({
            organizationId,
            currentSubscription: refreshedSubscription,
            counts,
            client,
          })
        }),
      ).pipe(
        Effect.mapError((cause) =>
          cause instanceof SingularityNotFoundError ||
          cause instanceof SingularityValidationError
            ? cause
            : toPersistenceError(
                'Failed to update the product addon entitlements.',
                cause,
                organizationId,
              ),
        ),
      )
    }),
)
