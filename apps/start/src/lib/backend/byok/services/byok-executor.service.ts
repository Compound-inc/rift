import { Effect, Layer, Match, Option, pipe, ServiceMap } from 'effect'
import { canUseOrganizationProviderKeys } from '@/utils/app-feature-flags'
import {
  getOrgPolicy,
  upsertOrgPolicy,
} from '@/lib/backend/org-policy/repository'
import type { ByokSupportedProviderId } from '@/lib/shared/model-policy/provider-keys'
import {
  deleteOrgProviderApiKey,
  readOrgProviderApiKeyStatus,
  upsertOrgProviderApiKey,
} from '@/lib/backend/byok/infra/provider-key-store'
import {
  DEFAULT_ORG_TOOL_POLICY,
  EMPTY_ORG_PROVIDER_KEY_STATUS,
  toOrgProviderKeyStatusSnapshot,
} from '@/lib/shared/model-policy/types'
import type { ByokUpdateResult } from '../domain/types'
import type { UpdateByokPayload } from '../domain/schemas'
import {
  ByokFeatureDisabledError,
  ByokPersistenceError,
} from '../domain/errors'

/**
 * Service that executes BYOK updates: set or remove provider API keys and
 * persist org policy.
 */
export type ByokExecutorServiceShape = {
  readonly executeUpdate: (
    organizationId: string,
    action: UpdateByokPayload,
  ) => Effect.Effect<
    ByokUpdateResult,
    ByokFeatureDisabledError | ByokPersistenceError
  >
}

export class ByokExecutorService extends ServiceMap.Service<
  ByokExecutorService,
  ByokExecutorServiceShape
>()('byok/ByokExecutorService') {
  /**
   * Live BYOK policy/key mutation implementation.
   */
  static readonly layer = Layer.succeed(this, {
    executeUpdate: Effect.fn('ByokExecutorService.executeUpdate')(
      (
        organizationId: string,
        action: UpdateByokPayload,
      ): ExecuteUpdateEffect =>
        pipe(
          Effect.succeed(canUseOrganizationProviderKeys),
          Effect.flatMap(
            (
              enabled,
            ): Effect.Effect<
              ExistingPolicy,
              ByokFeatureDisabledError | ByokPersistenceError
            > =>
              enabled
                ? tryGetPolicy(organizationId)
                : Effect.fail(
                    new ByokFeatureDisabledError({
                      message:
                        'Organization provider keys feature is disabled.',
                    }),
                  ),
          ),
          Effect.flatMap((existing: ExistingPolicy) => {
            switch (action.action) {
              case 'set_provider_api_key':
                return runSet(organizationId, existing, action)
              case 'remove_provider_api_key':
                return runRemove(organizationId, existing, action)
            }
          }),
        ),
    ),
  })
}

/** Maps unknown failure to ByokPersistenceError. */
const toPersistenceError = (cause: unknown): ByokPersistenceError =>
  pipe(
    cause,
    Match.value,
    Match.when(Match.instanceOf(Error), (e: Error) => e.message),
    Match.orElse(() => String(cause)),
    (causeStr) => {
      const message = causeStr.includes(
        'Missing required environment variable BYOK_ENCRYPTION_KEY_B64',
      )
        ? 'Missing required environment variable BYOK_ENCRYPTION_KEY_B64.'
        : causeStr.includes('relation "org_provider_api_key" does not exist')
          ? 'BYOK key storage is not initialized. Run the BYOK migration first.'
          : 'BYOK persistence failed'

      return (
      new ByokPersistenceError({
        message,
        cause: causeStr,
      })
      )
    },
  )

const tryGetPolicy = (organizationId: string) =>
  Effect.tryPromise({
    try: () => getOrgPolicy(organizationId),
    catch: toPersistenceError,
  })

const tryUpsertKey = (params: {
  organizationId: string
  providerId: ByokSupportedProviderId
  apiKey: string
}) =>
  Effect.tryPromise({
    try: () => upsertOrgProviderApiKey(params),
    catch: toPersistenceError,
  })

const tryDeleteKey = (params: {
  organizationId: string
  providerId: ByokSupportedProviderId
}) =>
  Effect.tryPromise({
    try: () => deleteOrgProviderApiKey(params),
    catch: toPersistenceError,
  })

const tryReadStatus = (organizationId: string) =>
  Effect.tryPromise({
    try: () => readOrgProviderApiKeyStatus(organizationId),
    catch: toPersistenceError,
  })

/** Runs set_provider_api_key branch. */
const runSet = (
  organizationId: string,
  existing: Awaited<ReturnType<typeof getOrgPolicy>>,
  action: Extract<UpdateByokPayload, { action: 'set_provider_api_key' }>,
): Effect.Effect<
  ByokUpdateResult,
  ByokFeatureDisabledError | ByokPersistenceError
> => {
  const providerKeyStatus = pipe(
    Option.fromNullishOr(existing?.providerKeyStatus),
    Option.getOrElse(() => EMPTY_ORG_PROVIDER_KEY_STATUS),
  )
  const needSyncBaseline = pipe(
    Option.fromNullishOr(existing?.providerKeyStatus),
    Option.map((ps) => ps.syncedAt <= 0),
    Option.getOrElse(() => true),
  )
  const baselineEffect = needSyncBaseline
    ? tryReadStatus(organizationId)
    : Effect.succeed(providerKeyStatus.providers)

  return pipe(
    tryUpsertKey({
      organizationId,
      providerId: action.providerId,
      apiKey: action.apiKey,
    }),
    Effect.flatMap(() => baselineEffect),
    Effect.flatMap((baseline) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            upsertOrgPolicy({
              organizationId,
              disabledProviderIds: existing?.disabledProviderIds ?? [],
              disabledModelIds: existing?.disabledModelIds ?? [],
              complianceFlags: existing?.complianceFlags ?? {},
              toolPolicy: existing?.toolPolicy ?? DEFAULT_ORG_TOOL_POLICY,
              orgKnowledgeEnabled: existing?.orgKnowledgeEnabled ?? false,
              enforcedModeId: existing?.enforcedModeId,
              providerKeyStatus: toOrgProviderKeyStatusSnapshot({
                ...baseline,
                [action.providerId]: true,
              }),
            }),
          catch: toPersistenceError,
        }),
        Effect.as({
          providerKeyStatus: {
            ...baseline,
            [action.providerId]: true,
          },
        }),
      ),
    ),
  )
}

/** Runs remove_provider_api_key branch. */
const runRemove = (
  organizationId: string,
  existing: Awaited<ReturnType<typeof getOrgPolicy>>,
  action: Extract<UpdateByokPayload, { action: 'remove_provider_api_key' }>,
): Effect.Effect<
  ByokUpdateResult,
  ByokFeatureDisabledError | ByokPersistenceError
> => {
  const providerKeyStatus = pipe(
    Option.fromNullishOr(existing?.providerKeyStatus),
    Option.getOrElse(() => EMPTY_ORG_PROVIDER_KEY_STATUS),
  )
  const needSyncBaseline = pipe(
    Option.fromNullishOr(existing?.providerKeyStatus),
    Option.map((ps) => ps.syncedAt <= 0),
    Option.getOrElse(() => true),
  )
  const baselineEffect = needSyncBaseline
    ? tryReadStatus(organizationId)
    : Effect.succeed(providerKeyStatus.providers)

  return pipe(
    tryDeleteKey({ organizationId, providerId: action.providerId }),
    Effect.flatMap(() => baselineEffect),
    Effect.flatMap((baseline) =>
      pipe(
        Effect.tryPromise({
          try: () =>
            upsertOrgPolicy({
              organizationId,
              disabledProviderIds: existing?.disabledProviderIds ?? [],
              disabledModelIds: existing?.disabledModelIds ?? [],
              complianceFlags: existing?.complianceFlags ?? {},
              toolPolicy: existing?.toolPolicy ?? DEFAULT_ORG_TOOL_POLICY,
              orgKnowledgeEnabled: existing?.orgKnowledgeEnabled ?? false,
              enforcedModeId: existing?.enforcedModeId,
              providerKeyStatus: toOrgProviderKeyStatusSnapshot({
                ...baseline,
                [action.providerId]: false,
              }),
            }),
          catch: toPersistenceError,
        }),
        Effect.as({
          providerKeyStatus: {
            ...baseline,
            [action.providerId]: false,
          },
        }),
      ),
    ),
  )
}

type ExecuteUpdateEffect = Effect.Effect<
  ByokUpdateResult,
  ByokFeatureDisabledError | ByokPersistenceError
>
type ExistingPolicy = Awaited<ReturnType<typeof getOrgPolicy>>
