import { Effect, Layer, ServiceMap } from 'effect'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import {
  ZeroDatabaseNotConfiguredError,
  ZeroDatabaseService,
} from '@/lib/backend/server-effect/services/zero-database.service'
import {
  EMPTY_ORG_PRODUCT_POLICY,
  isOrgProductPolicyEmpty,
  normalizeOrgProductPolicy,
  serializeOrgProductPolicy,
} from '@/lib/shared/org-product-policy'
import { isOrgProductKey } from '@/lib/shared/org-products'
import type {
  OrgProductPolicy,
  PersistedOrgProductPolicy,
} from '@/lib/shared/org-product-policy'
import type { OrgProductKey } from '@/lib/shared/org-products'
import {
  OrgProductPolicyInvalidRequestError,
  OrgProductPolicyPersistenceError,
} from '../domain/errors'

type OrgProductPolicyRow = {
  readonly id: string
  readonly organizationId: string
  readonly productKey: string
  readonly capabilities?: Record<string, unknown> | null
  readonly settings?: Record<string, unknown> | null
  readonly disabledProviderIds?: readonly unknown[] | null
  readonly disabledModelIds?: readonly unknown[] | null
  readonly disabledToolKeys?: readonly unknown[] | null
  readonly complianceFlags?: Record<string, unknown> | null
  readonly version?: number | null
  readonly updatedAt?: number | null
}

type OrgProductPolicyServiceShape = {
  readonly getPolicy: (input: {
    readonly organizationId: string
    readonly productKey: string
    readonly requestId: string
  }) => Effect.Effect<
    PersistedOrgProductPolicy | undefined,
    OrgProductPolicyInvalidRequestError | OrgProductPolicyPersistenceError
  >
  readonly listPolicies: (input: {
    readonly organizationId: string
    readonly requestId: string
  }) => Effect.Effect<
    readonly PersistedOrgProductPolicy[],
    OrgProductPolicyPersistenceError
  >
  readonly setPolicy: (input: {
    readonly organizationId: string
    readonly productKey: string
    readonly policy: OrgProductPolicy
    readonly requestId: string
  }) => Effect.Effect<
    PersistedOrgProductPolicy | undefined,
    OrgProductPolicyInvalidRequestError | OrgProductPolicyPersistenceError
  >
}

function toInvalidRequest(input: {
  readonly organizationId: string
  readonly productKey: string
  readonly requestId: string
  readonly message: string
  readonly details?: unknown
}) {
  return new OrgProductPolicyInvalidRequestError({
    organizationId: input.organizationId,
    productKey: input.productKey,
    requestId: input.requestId,
    message: input.message,
    details: input.details,
  })
}

function toPersistenceError(input: {
  readonly organizationId: string
  readonly productKey: string
  readonly requestId: string
  readonly message: string
  readonly cause?: unknown
}) {
  return new OrgProductPolicyPersistenceError({
    organizationId: input.organizationId,
    productKey: input.productKey,
    requestId: input.requestId,
    message: input.message,
    cause: input.cause ? String(input.cause) : undefined,
  })
}

function toPersistedPolicy(row: OrgProductPolicyRow): PersistedOrgProductPolicy {
  const normalized = normalizeOrgProductPolicy({
    capabilities: row.capabilities,
    settings: row.settings,
    disabledProviderIds: row.disabledProviderIds,
    disabledModelIds: row.disabledModelIds,
    disabledToolKeys: row.disabledToolKeys,
    complianceFlags: row.complianceFlags,
  })

  return {
    organizationId: row.organizationId,
    productKey: row.productKey as OrgProductKey,
    version: row.version ?? 1,
    updatedAt: row.updatedAt ?? Date.now(),
    ...normalized,
  }
}

/**
 * Product-key validation lives here so every future server entry point gets the
 * same strict error shape before any persistence work starts.
 */
export function validateOrgProductKey(input: {
  readonly organizationId: string
  readonly productKey: string
  readonly requestId: string
}): Effect.Effect<OrgProductKey, OrgProductPolicyInvalidRequestError> {
  if (isOrgProductKey(input.productKey)) {
    return Effect.succeed(input.productKey)
  }

  return Effect.fail(
    toInvalidRequest({
      organizationId: input.organizationId,
      productKey: input.productKey,
      requestId: input.requestId,
      message: `Unknown organization product "${input.productKey}"`,
    }),
  )
}

export class OrgProductPolicyService extends ServiceMap.Service<
  OrgProductPolicyService,
  OrgProductPolicyServiceShape
>()('org-product-policy/OrgProductPolicyService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService

      const withPolicyDb = <TValue>(
        input: {
          readonly organizationId: string
          readonly productKey: string
          readonly requestId: string
          readonly message: string
        },
        run: Parameters<typeof zeroDatabase.withDatabase<TValue, OrgProductPolicyPersistenceError, never>>[0],
      ) =>
        zeroDatabase.withDatabase(run).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? toPersistenceError({
                  organizationId: input.organizationId,
                  productKey: input.productKey,
                  requestId: input.requestId,
                  message: input.message,
                  cause: error.message,
                })
              : error,
          ),
        )

      const getPolicy: OrgProductPolicyServiceShape['getPolicy'] = Effect.fn(
        'OrgProductPolicyService.getPolicy',
      )(({ organizationId, productKey, requestId }) =>
        Effect.gen(function* () {
          const normalizedProductKey = yield* validateOrgProductKey({
            organizationId,
            productKey,
            requestId,
          })

          const row = yield* withPolicyDb(
            {
              organizationId,
              productKey: normalizedProductKey,
              requestId,
              message: 'Failed to load organization product policy',
            },
            (db) =>
              Effect.tryPromise({
                try: () =>
                  db.run(
                    zql.orgProductPolicy
                      .where('organizationId', organizationId)
                      .where('productKey', normalizedProductKey)
                      .one(),
                  ),
                catch: (error) =>
                  toPersistenceError({
                    organizationId,
                    productKey: normalizedProductKey,
                    requestId,
                    message: 'Failed to load organization product policy',
                    cause: error,
                  }),
              }),
          )

          return row ? toPersistedPolicy(row as OrgProductPolicyRow) : undefined
        }),
      )

      const listPolicies: OrgProductPolicyServiceShape['listPolicies'] = Effect.fn(
        'OrgProductPolicyService.listPolicies',
      )(({ organizationId, requestId }) =>
        withPolicyDb(
          {
            organizationId,
            productKey: '*',
            requestId,
            message: 'Failed to list organization product policies',
          },
          (db) =>
            Effect.tryPromise({
              try: async () => {
                const rows = await db.run(
                  zql.orgProductPolicy
                    .where('organizationId', organizationId)
                    .orderBy('productKey', 'asc'),
                )
                return rows.map((row) => toPersistedPolicy(row as OrgProductPolicyRow))
              },
              catch: (error) =>
                toPersistenceError({
                  organizationId,
                  productKey: '*',
                  requestId,
                  message: 'Failed to list organization product policies',
                  cause: error,
                }),
            }),
        ),
      )

      const setPolicy: OrgProductPolicyServiceShape['setPolicy'] = Effect.fn(
        'OrgProductPolicyService.setPolicy',
      )(({ organizationId, productKey, policy, requestId }) =>
        Effect.gen(function* () {
          const normalizedProductKey = yield* validateOrgProductKey({
            organizationId,
            productKey,
            requestId,
          })
          const normalizedPolicy = normalizeOrgProductPolicy(policy)

          return yield* withPolicyDb(
            {
              organizationId,
              productKey: normalizedProductKey,
              requestId,
              message: 'Failed to persist organization product policy',
            },
            (db) =>
              Effect.tryPromise({
                try: async () => {
                  const existing = await db.run(
                    zql.orgProductPolicy
                      .where('organizationId', organizationId)
                      .where('productKey', normalizedProductKey)
                      .one(),
                  )

                  if (isOrgProductPolicyEmpty(normalizedPolicy)) {
                    if (existing) {
                      await db.transaction(async (tx) => {
                        await tx.mutate.orgProductPolicy.delete({ id: existing.id })
                      })
                    }
                    return undefined
                  }

                  const serializedPolicy = serializeOrgProductPolicy(normalizedPolicy)
                  const updatedAt = Date.now()
                  const nextVersion = ((existing as OrgProductPolicyRow | null)?.version ?? 0) + 1

                  const existingPolicy = existing
                    ? normalizeOrgProductPolicy({
                        capabilities: existing.capabilities,
                        settings: existing.settings,
                        disabledProviderIds: existing.disabledProviderIds,
                        disabledModelIds: existing.disabledModelIds,
                        disabledToolKeys: existing.disabledToolKeys,
                        complianceFlags: existing.complianceFlags,
                      })
                    : EMPTY_ORG_PRODUCT_POLICY

                  if (
                    existing &&
                    JSON.stringify(serializeOrgProductPolicy(existingPolicy)) ===
                      JSON.stringify(serializedPolicy)
                  ) {
                    return toPersistedPolicy(existing as OrgProductPolicyRow)
                  }

                  if (!existing) {
                    const insertedRow: PersistedOrgProductPolicy = {
                      organizationId,
                      productKey: normalizedProductKey,
                      version: nextVersion,
                      updatedAt,
                      ...normalizedPolicy,
                    }

                    await db.transaction(async (tx) => {
                      await tx.mutate.orgProductPolicy.insert({
                        id: crypto.randomUUID(),
                        organizationId,
                        productKey: normalizedProductKey,
                        capabilities: serializedPolicy.capabilities ?? {},
                        settings: serializedPolicy.settings ?? {},
                        disabledProviderIds: serializedPolicy.disabledProviderIds ?? [],
                        disabledModelIds: serializedPolicy.disabledModelIds ?? [],
                        disabledToolKeys: serializedPolicy.disabledToolKeys ?? [],
                        complianceFlags: serializedPolicy.complianceFlags ?? {},
                        version: nextVersion,
                        updatedAt,
                      })
                    })

                    return insertedRow
                  }

                  await db.transaction(async (tx) => {
                    await tx.mutate.orgProductPolicy.update({
                      id: existing.id,
                      capabilities: serializedPolicy.capabilities ?? {},
                      settings: serializedPolicy.settings ?? {},
                      disabledProviderIds: serializedPolicy.disabledProviderIds ?? [],
                      disabledModelIds: serializedPolicy.disabledModelIds ?? [],
                      disabledToolKeys: serializedPolicy.disabledToolKeys ?? [],
                      complianceFlags: serializedPolicy.complianceFlags ?? {},
                      version: nextVersion,
                      updatedAt,
                    })
                  })

                  return {
                    organizationId,
                    productKey: normalizedProductKey,
                    version: nextVersion,
                    updatedAt,
                    ...normalizedPolicy,
                  } satisfies PersistedOrgProductPolicy
                },
                catch: (error) =>
                  toPersistenceError({
                    organizationId,
                    productKey: normalizedProductKey,
                    requestId,
                    message: 'Failed to persist organization product policy',
                    cause: error,
                  }),
              }),
          )
        }),
      )

      return {
        getPolicy,
        listPolicies,
        setPolicy,
      }
    }),
  )

  /**
   * In-memory implementation for deterministic tests and future orchestration
   * tests that should not require a real Zero database connection.
   */
  static readonly layerMemory = Layer.sync(this, () => {
    const rows = new Map<string, PersistedOrgProductPolicy>()

    const getKey = (organizationId: string, productKey: OrgProductKey) =>
      `${organizationId}:${productKey}`

    return {
      getPolicy: Effect.fn('OrgProductPolicyService.getPolicyMemory')(
        ({ organizationId, productKey, requestId }) =>
          Effect.gen(function* () {
            const normalizedProductKey = yield* validateOrgProductKey({
              organizationId,
              productKey,
              requestId,
            })
            return rows.get(getKey(organizationId, normalizedProductKey))
          }),
      ),
      listPolicies: Effect.fn('OrgProductPolicyService.listPoliciesMemory')(
        ({ organizationId }) =>
          Effect.succeed(
            [...rows.values()]
              .filter((row) => row.organizationId === organizationId)
              .sort((left, right) => left.productKey.localeCompare(right.productKey)),
          ),
      ),
      setPolicy: Effect.fn('OrgProductPolicyService.setPolicyMemory')(
        ({ organizationId, productKey, policy, requestId }) =>
          Effect.gen(function* () {
            const normalizedProductKey = yield* validateOrgProductKey({
              organizationId,
              productKey,
              requestId,
            })
            const normalizedPolicy = normalizeOrgProductPolicy(policy)
            const key = getKey(organizationId, normalizedProductKey)
            const existing = rows.get(key)

            if (isOrgProductPolicyEmpty(normalizedPolicy)) {
              rows.delete(key)
              return undefined
            }

            const next: PersistedOrgProductPolicy = {
              organizationId,
              productKey: normalizedProductKey,
              version: (existing?.version ?? 0) + 1,
              updatedAt: Date.now(),
              ...normalizedPolicy,
            }
            rows.set(key, next)
            return next
          }),
      ),
    } satisfies OrgProductPolicyServiceShape
  })
}
