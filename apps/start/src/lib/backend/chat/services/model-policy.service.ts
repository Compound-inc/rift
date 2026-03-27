import { Effect, Layer, ServiceMap } from 'effect'
import {
  getCatalogModelProviderRoute,
} from '@/lib/shared/ai-catalog'
import type { AiReasoningEffort } from '@/lib/shared/ai-catalog/types'
import {
  evaluateModelAvailability,
  getCatalogModelById,
} from '@/lib/shared/model-policy/policy-engine'
import { getModelAccess  } from '@/lib/shared/access-control'
import type {AccessContext} from '@/lib/shared/access-control';
import {
  isByokSupportedProviderId,
} from '@/lib/shared/model-policy/provider-keys'
import { readOrgProviderApiKeyEffect } from '@/lib/backend/byok/infra/provider-key-store'
import { getOrgAiPolicy } from '@/lib/backend/model-policy/repository'
import type {
  EffectiveModelResolution,
  OrgAiPolicy,
} from '@/lib/shared/model-policy/types'
import { canUseOrganizationProviderKeys } from '@/utils/app-feature-flags'
import {
  MessagePersistenceError,
  ModelPolicyDeniedError,
} from '../domain/errors'

const AI_REASONING_EFFORTS: readonly AiReasoningEffort[] = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]

function isAiReasoningEffort(value: string): value is AiReasoningEffort {
  return (AI_REASONING_EFFORTS as readonly string[]).includes(value)
}

/** Maps policy/runtime selection failures into a chat-domain denied error. */
function toPolicyDenied(input: {
  readonly modelId: string
  readonly threadId: string
  readonly requestId: string
  readonly reason: string
}) {
  return new ModelPolicyDeniedError({
    message: 'Selected model is not allowed for this request',
    requestId: input.requestId,
    modelId: input.modelId,
    threadId: input.threadId,
    reason: input.reason,
  })
}

/**
 * Service contract for reading org policy and resolving the effective runtime model.
 * The resolution path must be deterministic for a given request.
 */
export type ModelPolicyServiceShape = {
  readonly getOrgPolicy: (input: {
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<OrgAiPolicy | undefined, MessagePersistenceError>
  readonly resolveThreadModel: (input: {
    readonly threadId: string
    readonly organizationId?: string
    readonly orgPolicy?: OrgAiPolicy
    readonly threadModel?: string
    readonly threadReasoningEffort?: AiReasoningEffort
    readonly requestedModelId?: string
    readonly modeModelId?: string
    readonly accessContext?: AccessContext
    readonly requestedReasoningEffort?: string
    readonly skipProviderKeyResolution?: boolean
    readonly requestId: string
  }) => Effect.Effect<
    EffectiveModelResolution,
    ModelPolicyDeniedError | MessagePersistenceError
  >
}

/** Dependency-injected model policy service used by chat orchestration. */
export class ModelPolicyService extends ServiceMap.Service<
  ModelPolicyService,
  ModelPolicyServiceShape
>()('chat-backend/ModelPolicyService') {
  /**
   * Production implementation:
   * 1) load org policy,
   * 2) resolve requested or thread-default model,
   * 3) enforce org deny rules,
   * 4) resolve effective reasoning setting.
   */
  static readonly layer = Layer.succeed(this, {
    getOrgPolicy: Effect.fn('ModelPolicyService.getOrgPolicy')(
      ({
        organizationId,
        requestId,
      }: {
        readonly organizationId?: string
        readonly requestId: string
      }) =>
        Effect.tryPromise({
          try: async () => {
            if (!organizationId) return undefined
            return getOrgAiPolicy(organizationId)
          },
          catch: (error) =>
            new MessagePersistenceError({
              message: 'Failed to load organization model policy',
              requestId,
              threadId: 'policy',
              cause: String(error),
            }),
        }),
    ),
    resolveThreadModel: Effect.fn('ModelPolicyService.resolveThreadModel')(
      ({
        threadId,
        organizationId,
        orgPolicy,
        threadModel,
        threadReasoningEffort,
        requestedModelId,
        modeModelId,
        accessContext,
        requestedReasoningEffort,
        skipProviderKeyResolution,
        requestId,
      }: {
        readonly threadId: string
        readonly organizationId?: string
        readonly orgPolicy?: OrgAiPolicy
        readonly threadModel?: string
        readonly threadReasoningEffort?: AiReasoningEffort
        readonly requestedModelId?: string
        readonly modeModelId?: string
        readonly accessContext?: AccessContext
        readonly requestedReasoningEffort?: string
        readonly skipProviderKeyResolution?: boolean
        readonly requestId: string
      }) =>
        Effect.gen(function* () {
          const policy =
            orgPolicy ??
            (yield* Effect.tryPromise({
              try: async () => {
                if (!organizationId) return undefined
                return getOrgAiPolicy(organizationId)
              },
              catch: (error) =>
                new MessagePersistenceError({
                  message: 'Failed to load organization model policy',
                  requestId,
                  threadId,
                  cause: String(error),
                }),
            }))

          const candidateModelId =
            modeModelId?.trim() ||
            requestedModelId?.trim() ||
            threadModel?.trim()
          if (!candidateModelId) {
            return yield* Effect.fail(
              toPolicyDenied({
                modelId: 'missing-model',
                threadId,
                requestId,
                reason: 'no_model_selected',
              }),
            )
          }
          const selectedModel = getCatalogModelById(candidateModelId)
          if (!selectedModel) {
            return yield* Effect.fail(
              toPolicyDenied({
                modelId: candidateModelId,
                threadId,
                requestId,
                reason: 'unknown_model',
              }),
            )
          }

          const access = accessContext
            ? getModelAccess({
                modelId: selectedModel.id,
                context: accessContext,
              })
            : undefined
          if (access && !access.allowed) {
            return yield* Effect.fail(
              toPolicyDenied({
                modelId: selectedModel.id,
                threadId,
                requestId,
                reason: `free_tier_model_denied:${selectedModel.id}`,
              }),
            )
          }

          const availability = evaluateModelAvailability({
            model: selectedModel,
            policy,
          })

          if (!availability.allowed) {
            return yield* Effect.fail(
              toPolicyDenied({
                modelId: selectedModel.id,
                threadId,
                requestId,
                reason: `policy_denied:${availability.deniedBy.join(',')}`,
              }),
            )
          }

          const requestedEffort = [
            requestedReasoningEffort,
            threadReasoningEffort,
            selectedModel.defaultReasoningEffort,
          ].find(
            (value): value is AiReasoningEffort =>
              typeof value === 'string' && isAiReasoningEffort(value),
          )
          // Validate that the requested effort is supported by the model.
          // Threads may have stale values (e.g. 'minimal' for o1/o3) after catalog updates.
          const supportedEfforts = selectedModel.reasoningEfforts
          const effectiveEffort =
            supportedEfforts.length === 0
              ? undefined
              : requestedEffort &&
                supportedEfforts.includes(requestedEffort)
                ? requestedEffort
                : selectedModel.defaultReasoningEffort ?? supportedEfforts[0]
          const reasoningEffort =
            effectiveEffort === 'none'
              ? undefined
              : (effectiveEffort as AiReasoningEffort | undefined)

          const strictProviderKeyPolicyEnabled = Boolean(
            policy?.complianceFlags.require_org_provider_key,
          )
          const persistedProviderKeyStatus = policy?.providerKeyStatus
          const hasTrustedProviderKeySnapshot = Boolean(
            persistedProviderKeyStatus &&
            persistedProviderKeyStatus.syncedAt > 0,
          )
          const hasAnyPersistedProviderKey =
            hasTrustedProviderKeySnapshot && persistedProviderKeyStatus
              ? persistedProviderKeyStatus.hasAnyProviderKey
              : undefined

          if (
            canUseOrganizationProviderKeys &&
            !skipProviderKeyResolution
          ) {
            if (!organizationId) {
              if (strictProviderKeyPolicyEnabled) {
                return yield* Effect.fail(
                  toPolicyDenied({
                    modelId: selectedModel.id,
                    threadId,
                    requestId,
                    reason:
                      'policy_denied:missing_org_context_for_provider_key',
                  }),
                )
              }
            } else {
              if (
                !strictProviderKeyPolicyEnabled &&
                hasAnyPersistedProviderKey === false
              ) {
                return {
                  modelId: selectedModel.id,
                  reasoningEffort,
                  source: modeModelId
                    ? 'mode'
                    : requestedModelId || requestedReasoningEffort
                      ? 'request'
                      : 'thread',
                } satisfies EffectiveModelResolution
              }

              /**
               * Provider-key enforcement is model-route-driven:
               * - derive candidate providers from model.providers,
               * - keep only providers currently supported by BYOK key storage,
               * - evaluate keys in declared order so behavior stays deterministic.
               */
              const declaredProviders = selectedModel.providers
              const byokCandidateProviders = declaredProviders.filter(
                (providerId) => isByokSupportedProviderId(providerId),
              )

              if (byokCandidateProviders.length === 0) {
                if (strictProviderKeyPolicyEnabled) {
                  return yield* Effect.fail(
                    toPolicyDenied({
                      modelId: selectedModel.id,
                      threadId,
                      requestId,
                      reason: `policy_denied:provider_not_supported_by_byok:${selectedModel.providerId}`,
                    }),
                  )
                }
              } else {
                let lastRoutableProviderId = byokCandidateProviders[0]

                for (const providerId of byokCandidateProviders) {
                  const providerMarkedAsConfigured =
                    policy?.providerKeyStatus &&
                    policy.providerKeyStatus.syncedAt > 0
                      ? policy.providerKeyStatus.providers[providerId]
                      : undefined
                  if (providerMarkedAsConfigured === false) {
                    continue
                  }

                  const providerRoute = getCatalogModelProviderRoute({
                    modelId: selectedModel.id,
                    providerId,
                  })

                  // Defensive guard against catalog inconsistencies.
                  if (!providerRoute) continue
                  lastRoutableProviderId = providerId

                  const providerApiKey = yield* readOrgProviderApiKeyEffect({
                    organizationId,
                    providerId,
                  }).pipe(
                    Effect.mapError(
                      (error) =>
                        new MessagePersistenceError({
                          message:
                            'Failed to resolve organization provider API key',
                          requestId,
                          threadId,
                          cause: String(error),
                        }),
                    ),
                  )

                  if (!providerApiKey) {
                    continue
                  }

                  return {
                    modelId: selectedModel.id,
                    reasoningEffort,
                    source: modeModelId
                      ? 'mode'
                      : requestedModelId || requestedReasoningEffort
                        ? 'request'
                        : 'thread',
                    providerApiKeyOverride: {
                      providerId,
                      apiKey: providerApiKey,
                    },
                  } satisfies EffectiveModelResolution
              }

                if (strictProviderKeyPolicyEnabled) {
                  return yield* Effect.fail(
                    toPolicyDenied({
                      modelId: selectedModel.id,
                      threadId,
                      requestId,
                      reason: `policy_denied:missing_provider_api_key:${lastRoutableProviderId}`,
                    }),
                  )
                }
              }
            }
          }

          return {
            modelId: selectedModel.id,
            reasoningEffort,
            source: modeModelId
              ? 'mode'
              : requestedModelId || requestedReasoningEffort
                ? 'request'
                : 'thread',
          } satisfies EffectiveModelResolution
        }),
    ),
  })

  /** Test/local implementation with policy bypass. */
  static readonly layerMemory = Layer.succeed(this, {
    getOrgPolicy: Effect.fn('ModelPolicyService.getOrgPolicyMemory')(() =>
      Effect.succeed(undefined),
    ),
    resolveThreadModel: Effect.fn(
      'ModelPolicyService.resolveThreadModelMemory',
    )(
      ({
        threadId,
        threadModel,
        requestedModelId,
        modeModelId,
        accessContext,
        requestedReasoningEffort,
        requestId,
      }: {
        readonly threadId: string
        readonly threadModel?: string
        readonly requestedModelId?: string
        readonly modeModelId?: string
        readonly accessContext?: AccessContext
        readonly requestedReasoningEffort?: string
        readonly requestId: string
      }) =>
        Effect.gen(function* () {
          const modelId =
            modeModelId?.trim() ||
            requestedModelId?.trim() ||
            threadModel?.trim() ||
            'missing-model'

          const access = accessContext
            ? getModelAccess({
                modelId,
                context: accessContext,
              })
            : undefined
          if (access && !access.allowed) {
            return yield* Effect.fail(
              toPolicyDenied({
                modelId,
                threadId,
                requestId,
                reason: `free_tier_model_denied:${modelId}`,
              }),
            )
          }

          return {
            modelId,
            reasoningEffort:
              requestedReasoningEffort && requestedReasoningEffort !== 'none'
                ? (requestedReasoningEffort as AiReasoningEffort)
                : undefined,
            source: modeModelId
              ? 'mode'
              : requestedModelId || requestedReasoningEffort
                ? 'request'
                : 'thread',
          } satisfies EffectiveModelResolution
        }),
    ),
  })
}
