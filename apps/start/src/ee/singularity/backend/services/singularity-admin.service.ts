import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { auth } from '@/lib/backend/auth/services/auth.service'
import { ensureOrganizationBillingBaselineEffect } from '@/lib/backend/auth/services/default-organization.service'
import {
  markOrgBillingAccountStatusEffect,
  markOrgSubscriptionCanceledEffect,
  readCurrentOrgSubscriptionEffect,
  readOrganizationMemberCountsEffect,
  upsertEntitlementSnapshotEffect,
  upsertOrgBillingAccountEffect,
  upsertOrgSubscriptionEffect,
} from '@/lib/backend/billing/services/workspace-billing/persistence'
import {
  WORKSPACE_FEATURE_IDS,
  resolveWorkspaceEffectiveFeatures,
} from '@/lib/shared/access-control'
import type {
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '@/lib/shared/access-control'
import { usdToNanoUsd } from '@/lib/backend/billing/services/workspace-usage/shared'
import {
  asRecord,
} from '@/lib/backend/billing/services/workspace-billing/shared'
import type { ManualBillingInterval } from '@/lib/backend/billing/services/workspace-billing/shared'
import {
  withBillingTransactionEffect,
  type BillingSqlClient,
} from '@/lib/backend/billing/services/sql'
import type {
  SingularityOrganizationDetail,
  SingularityOrganizationListItem,
} from '@/ee/singularity/shared/singularity-admin'
import {
  SingularityNotFoundError,
  SingularityPersistenceError,
  SingularityValidationError,
} from '../domain/errors'
import { toReadableErrorCause } from '@/lib/backend/chat/domain/error-formatting'
import { upsertOrganizationUsagePolicyOverrideRecordEffect } from '@/lib/backend/billing/services/workspace-usage/persistence'
import {
  getOrganizationProfileEffect,
  listOrganizationsEffect,
  readOrganizationExistsEffect,
  readOrganizationMemberRoleEffect,
} from './singularity-admin/queries'

export type SingularityAdminServiceShape = {
  readonly listOrganizations: () => Effect.Effect<
    Array<SingularityOrganizationListItem>,
    SingularityPersistenceError
  >
  readonly getOrganizationProfile: (input: {
    organizationId: string
  }) => Effect.Effect<
    SingularityOrganizationDetail,
    SingularityNotFoundError | SingularityPersistenceError
  >
  readonly inviteOrganizationMember: (input: {
    headers: Headers
    organizationId: string
    email: string
    role: 'admin' | 'member'
  }) => Effect.Effect<void, SingularityPersistenceError>
  readonly removeOrganizationMember: (input: {
    headers: Headers
    organizationId: string
    memberIdOrEmail: string
  }) => Effect.Effect<void, SingularityPersistenceError>
  readonly updateOrganizationMemberRole: (input: {
    headers: Headers
    organizationId: string
    memberId: string
    role: 'admin' | 'member'
  }) => Effect.Effect<
    void,
    SingularityValidationError | SingularityPersistenceError
  >
  readonly cancelOrganizationInvitation: (input: {
    headers: Headers
    invitationId: string
  }) => Effect.Effect<void, SingularityPersistenceError>
  readonly setOrganizationPlanOverride: (input: {
    organizationId: string
    actorUserId: string
    planId: WorkspacePlanId
    seatCount: number
    billingInterval: ManualBillingInterval | null
    monthlyUsageLimitUsd: number | null
    overrideReason: string | null
    internalNote: string | null
    billingReference: string | null
    featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
  }) => Effect.Effect<
    void,
    | SingularityNotFoundError
    | SingularityValidationError
    | SingularityPersistenceError
  >
}

type NormalizedPlanOverrideInput = {
  organizationId: string
  actorUserId: string
  planId: WorkspacePlanId
  seatCount: number
  billingInterval: ManualBillingInterval | null
  monthlyUsageLimitUsd: number | null
  overrideReason: string | null
  internalNote: string | null
  billingReference: string | null
  featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
}

function toPersistenceError(
  message: string,
  cause: unknown,
  organizationId?: string,
): SingularityPersistenceError {
  return new SingularityPersistenceError({
    message,
    organizationId,
    cause: toReadableErrorCause(cause, message),
  })
}

function normalizeRole(role: string): 'admin' | 'member' {
  return role === 'admin' ? 'admin' : 'member'
}

function normalizeManualFeatureOverrides(input: {
  planId: WorkspacePlanId
  featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
}): Partial<Record<WorkspaceFeatureId, boolean>> {
  const planDefaults = resolveWorkspaceEffectiveFeatures({
    planId: input.planId,
  })

  return Object.fromEntries(
    WORKSPACE_FEATURE_IDS.map((featureId) => {
      const featureOverride = input.featureOverrides[featureId]
      return typeof featureOverride === 'boolean' &&
        featureOverride !== planDefaults[featureId]
        ? [featureId, featureOverride]
        : null
    }).filter((entry): entry is [WorkspaceFeatureId, boolean] => entry != null),
  )
}

function normalizePlanOverrideInput(
  input: NormalizedPlanOverrideInput,
): NormalizedPlanOverrideInput {
  const normalizedSeatCount = Math.max(1, input.seatCount)

  if (input.planId === 'free') {
    return {
      ...input,
      seatCount: normalizedSeatCount,
      billingInterval: null,
      monthlyUsageLimitUsd: null,
      overrideReason: null,
      internalNote: null,
      billingReference: null,
      featureOverrides: {},
    }
  }

  return {
    ...input,
    seatCount: normalizedSeatCount,
    featureOverrides: normalizeManualFeatureOverrides({
      planId: input.planId,
      featureOverrides: input.featureOverrides,
    }),
  }
}

function validatePlanOverrideInput(input: NormalizedPlanOverrideInput): void {
  if (input.planId !== 'free' && input.billingInterval == null) {
    throw new SingularityValidationError({
      message: 'Billing interval is required for paid manual contracts.',
      field: 'billingInterval',
    })
  }

  if (
    input.billingInterval === 'custom' &&
    !input.overrideReason &&
    !input.internalNote
  ) {
    throw new SingularityValidationError({
      message:
        'Custom billing intervals require an override reason or internal note.',
      field: 'billingInterval',
    })
  }
}

function buildManualSubscriptionMetadata(input: {
  currentMetadata: Record<string, unknown>
  actorUserId: string
  now: number
  overrideReason: string | null
  internalNote: string | null
  billingReference: string | null
  featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
}): Record<string, unknown> {
  return {
    ...input.currentMetadata,
    overrideSource: 'singularity',
    overriddenByUserId: input.actorUserId,
    overriddenAt: input.now,
    overrideReason: input.overrideReason,
    internalNote: input.internalNote,
    billingReference: input.billingReference,
    featureOverrides: input.featureOverrides,
  }
}

export class SingularityAdminService extends ServiceMap.Service<
  SingularityAdminService,
  SingularityAdminServiceShape
>()('singularity/SingularityAdminService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client: BillingSqlClient = yield* PgClient.PgClient
      const provideSql = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, BillingSqlClient>,
      ): Effect.Effect<TValue, TError> =>
        Effect.provideService(effect, PgClient.PgClient, client)

      return {
        listOrganizations: Effect.fn(
          'SingularityAdminService.listOrganizations',
        )(() =>
          provideSql(listOrganizationsEffect()).pipe(
            Effect.mapError((cause) =>
              toPersistenceError(
                'Failed to list organizations for Singularity.',
                cause,
              ),
            ),
          ),
        ),

        getOrganizationProfile: Effect.fn(
          'SingularityAdminService.getOrganizationProfile',
        )(({ organizationId }) =>
          provideSql(getOrganizationProfileEffect({ organizationId })).pipe(
            Effect.mapError((cause) =>
              cause instanceof SingularityNotFoundError
                ? cause
                : toPersistenceError(
                    'Failed to load the Singularity organization profile.',
                    cause,
                    organizationId,
                  ),
            ),
          ),
        ),

        inviteOrganizationMember: Effect.fn(
          'SingularityAdminService.inviteOrganizationMember',
        )(({ headers, organizationId, email, role }) =>
          Effect.tryPromise({
            try: async () => {
              await auth.api.createInvitation({
                headers,
                body: {
                  organizationId,
                  email,
                  role,
                },
              })
            },
            catch: (cause) =>
              toPersistenceError(
                'Failed to invite the organization member.',
                cause,
                organizationId,
              ),
          }),
        ),

        removeOrganizationMember: Effect.fn(
          'SingularityAdminService.removeOrganizationMember',
        )(({ headers, organizationId, memberIdOrEmail }) =>
          Effect.tryPromise({
            try: async () => {
              await auth.api.removeMember({
                headers,
                body: {
                  organizationId,
                  memberIdOrEmail,
                },
              })
            },
            catch: (cause) =>
              toPersistenceError(
                'Failed to remove the organization member.',
                cause,
                organizationId,
              ),
          }),
        ),

        updateOrganizationMemberRole: Effect.fn(
          'SingularityAdminService.updateOrganizationMemberRole',
        )(({ headers, organizationId, memberId, role }) =>
          Effect.gen(function* () {
            const currentRole = yield* provideSql(readOrganizationMemberRoleEffect({
              organizationId,
              memberId,
            })).pipe(
              Effect.map((value) => value?.trim().toLowerCase() ?? null),
              Effect.mapError((cause) =>
                toPersistenceError(
                  'Failed to update the organization member role.',
                  cause,
                  organizationId,
                ),
              ),
            )

            if (currentRole === 'owner') {
              return yield* Effect.fail(
                new SingularityValidationError({
                  message: 'Owners must be changed from the workspace itself.',
                  field: 'role',
                }),
              )
            }

            yield* Effect.tryPromise({
              try: () =>
                auth.api.updateMemberRole({
                  headers,
                  body: {
                    organizationId,
                    memberId,
                    role,
                  },
                }),
              catch: (cause) =>
                toPersistenceError(
                  'Failed to update the organization member role.',
                  cause,
                  organizationId,
                ),
            })
          }),
        ),

        cancelOrganizationInvitation: Effect.fn(
          'SingularityAdminService.cancelOrganizationInvitation',
        )(({ headers, invitationId }) =>
          Effect.tryPromise({
            try: async () => {
              await auth.api.cancelInvitation({
                headers,
                body: {
                  invitationId,
                },
              })
            },
            catch: (cause) =>
              toPersistenceError(
                'Failed to cancel the organization invitation.',
                cause,
              ),
          }),
        ),

        setOrganizationPlanOverride: Effect.fn(
          'SingularityAdminService.setOrganizationPlanOverride',
        )(
          ({
            organizationId,
            actorUserId,
            planId,
            seatCount,
            billingInterval,
            monthlyUsageLimitUsd,
            overrideReason,
            internalNote,
            billingReference,
            featureOverrides,
          }) =>
            Effect.gen(function* () {
              const normalizedInput = normalizePlanOverrideInput({
                organizationId,
                actorUserId,
                planId,
                seatCount,
                billingInterval,
                monthlyUsageLimitUsd,
                overrideReason,
                internalNote,
                billingReference,
                featureOverrides,
              })
              validatePlanOverrideInput(normalizedInput)

              const organizationExists = yield* provideSql(readOrganizationExistsEffect(
                organizationId,
              )).pipe(
                Effect.mapError((cause) =>
                  toPersistenceError(
                    'Failed to apply the organization plan override.',
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

              yield* provideSql(ensureOrganizationBillingBaselineEffect(organizationId)).pipe(
                Effect.mapError((cause) =>
                  toPersistenceError(
                    'Failed to apply the organization plan override.',
                    cause,
                    organizationId,
                  ),
                ),
              )

              yield* provideSql(withBillingTransactionEffect((client) =>
                Effect.gen(function* () {
                    const currentSubscription =
                      yield* readCurrentOrgSubscriptionEffect({
                        organizationId,
                        client,
                      })
                    const counts = yield* readOrganizationMemberCountsEffect({
                      organizationId,
                      client,
                    })
                    const now = Date.now()
                    const billingAccountId = `billing_${organizationId}`
                    const subscriptionId = `workspace_subscription_${organizationId}`
                    const currentMetadata = asRecord(
                      currentSubscription?.metadata,
                    )
                    const monthlyUsageLimitNanoUsd =
                      normalizedInput.monthlyUsageLimitUsd == null
                        ? null
                        : usdToNanoUsd(normalizedInput.monthlyUsageLimitUsd)

                    if (normalizedInput.planId === 'free') {
                      yield* markOrgSubscriptionCanceledEffect({
                        organizationId,
                        status: 'inactive',
                        cancelAtPeriodEnd: false,
                        now,
                        client,
                      })
                      yield* markOrgBillingAccountStatusEffect({
                        organizationId,
                        status: 'inactive',
                        now,
                        client,
                      })
                      yield* upsertOrganizationUsagePolicyOverrideRecordEffect({
                        organizationId,
                        override: {},
                        now,
                        client,
                      })
                      yield* upsertEntitlementSnapshotEffect({
                        organizationId,
                        currentSubscription: null,
                        counts,
                        client,
                      })
                      return
                    }

                    yield* upsertOrgBillingAccountEffect({
                      billingAccountId,
                      organizationId,
                      provider: 'manual',
                      providerCustomerId: null,
                      status: 'active',
                      now,
                      client,
                    })

                    yield* upsertOrgSubscriptionEffect({
                      subscriptionId,
                      organizationId,
                      billingAccountId,
                      providerSubscriptionId: null,
                      planId: normalizedInput.planId,
                      billingInterval: normalizedInput.billingInterval,
                      seatCount: normalizedInput.seatCount,
                      status: 'active',
                      periodStart: now,
                      periodEnd: currentSubscription?.currentPeriodEnd ?? null,
                      cancelAtPeriodEnd: false,
                      metadata: buildManualSubscriptionMetadata({
                        currentMetadata,
                        actorUserId,
                        now,
                        overrideReason: normalizedInput.overrideReason,
                        internalNote: normalizedInput.internalNote,
                        billingReference: normalizedInput.billingReference,
                        featureOverrides: normalizedInput.featureOverrides,
                      }),
                      now,
                      client,
                    })

                    yield* upsertOrganizationUsagePolicyOverrideRecordEffect({
                      organizationId,
                      override: {
                        organizationMonthlyBudgetNanoUsd:
                          monthlyUsageLimitNanoUsd ?? undefined,
                      },
                      now,
                      client,
                    })

                    const refreshedSubscription =
                      yield* readCurrentOrgSubscriptionEffect({
                        organizationId,
                        client,
                      })

                    yield* upsertEntitlementSnapshotEffect({
                      organizationId,
                      currentSubscription: refreshedSubscription,
                      counts,
                      client,
                    })
                  }),
                )).pipe(
                Effect.mapError((cause) =>
                  cause instanceof SingularityNotFoundError ||
                  cause instanceof SingularityValidationError
                    ? cause
                    : toPersistenceError(
                        'Failed to apply the organization plan override.',
                        cause,
                        organizationId,
                      ),
                ),
              )
            }),
        ),
      }
    }),
  )
}

export function normalizeSingularityRole(role: string): 'admin' | 'member' {
  return normalizeRole(role)
}
