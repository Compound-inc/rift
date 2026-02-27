import { Effect, Layer, ServiceMap } from 'effect'
import { CHAT_DEFAULT_MODEL_ID } from '@/lib/ai-catalog'
import { getCatalogModelProviderRoute } from '@/lib/ai-catalog'
import type { AiReasoningEffort } from '@/lib/ai-catalog/types'
import {
  evaluateModelAvailability,
  getCatalogModelById,
} from '@/lib/model-policy/policy-engine'
import {
  isByokSupportedProviderId,
  readOrgProviderApiKey,
} from '@/lib/model-policy/provider-keys'
import { getOrgAiPolicy } from '@/lib/model-policy/repository'
import type {
  EffectiveModelResolution,
  OrgAiPolicy,
} from '@/lib/model-policy/types'
import { canUseOrganizationProviderKeys } from '@/utils/app-feature-flags'
import {
  MessagePersistenceError,
  ModelPolicyDeniedError,
} from '../domain/errors'

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
    readonly orgWorkosId?: string
    readonly requestId: string
  }) => Effect.Effect<OrgAiPolicy | undefined, MessagePersistenceError>
  readonly resolveThreadModel: (input: {
    readonly threadId: string
    readonly orgWorkosId?: string
    readonly orgPolicy?: OrgAiPolicy
    readonly threadModel?: string
    readonly threadReasoningEffort?: AiReasoningEffort
    readonly requestedModelId?: string
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
>()('chat-backend/ModelPolicyService') {}

/**
 * Production implementation:
 * 1) load org policy,
 * 2) resolve requested or thread-default model,
 * 3) enforce org deny rules,
 * 4) resolve effective reasoning setting.
 */
export const ModelPolicyLive = Layer.succeed(ModelPolicyService, {
  getOrgPolicy: ({ orgWorkosId, requestId }) =>
    Effect.tryPromise({
      try: async () => {
        if (!orgWorkosId) return undefined
        return getOrgAiPolicy(orgWorkosId)
      },
      catch: (error) =>
        new MessagePersistenceError({
          message: 'Failed to load organization model policy',
          requestId,
          threadId: 'policy',
          cause: String(error),
        }),
    }),
  resolveThreadModel: ({
    threadId,
    orgWorkosId,
    orgPolicy,
    threadModel,
    threadReasoningEffort,
    requestedModelId,
    requestedReasoningEffort,
    skipProviderKeyResolution,
    requestId,
  }) =>
    Effect.gen(function* () {
      const policy =
        orgPolicy ??
        (yield* Effect.tryPromise({
          try: async () => {
            if (!orgWorkosId) return undefined
            return getOrgAiPolicy(orgWorkosId)
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
        requestedModelId?.trim() || threadModel?.trim() || CHAT_DEFAULT_MODEL_ID
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

      const requestedEffort =
        requestedReasoningEffort ??
        threadReasoningEffort ??
        selectedModel.defaultReasoningEffort
      const reasoningEffort =
        requestedEffort === 'none'
          ? undefined
          : (requestedEffort as AiReasoningEffort | undefined)

      const strictProviderKeyPolicyEnabled = Boolean(
        policy?.complianceFlags.require_org_provider_key,
      )
      const persistedProviderKeyStatus = policy?.providerKeyStatus
      const hasTrustedProviderKeySnapshot = Boolean(
        persistedProviderKeyStatus && persistedProviderKeyStatus.syncedAt > 0,
      )
      const hasAnyPersistedProviderKey =
        hasTrustedProviderKeySnapshot && persistedProviderKeyStatus
          ? persistedProviderKeyStatus.hasAnyProviderKey
          : undefined

      if (canUseOrganizationProviderKeys() && !skipProviderKeyResolution) {
        if (!orgWorkosId) {
          if (strictProviderKeyPolicyEnabled) {
            return yield* Effect.fail(
              toPolicyDenied({
                modelId: selectedModel.id,
                threadId,
                requestId,
                reason: 'policy_denied:missing_org_context_for_provider_key',
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
              source:
                requestedModelId || requestedReasoningEffort
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

              const providerApiKey = yield* Effect.tryPromise({
                try: () =>
                  readOrgProviderApiKey({
                    orgWorkosId,
                    providerId,
                  }),
                catch: (error) =>
                  new MessagePersistenceError({
                    message: 'Failed to resolve organization provider API key',
                    requestId,
                    threadId,
                    cause: String(error),
                  }),
              })

              if (!providerApiKey) {
                continue
              }

              return {
                modelId: selectedModel.id,
                reasoningEffort,
                source:
                  requestedModelId || requestedReasoningEffort
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
        source:
          requestedModelId || requestedReasoningEffort ? 'request' : 'thread',
      } satisfies EffectiveModelResolution
    }),
})

/** Test/local implementation with policy bypass. */
export const ModelPolicyMemory = Layer.succeed(ModelPolicyService, {
  getOrgPolicy: () => Effect.succeed(undefined),
  resolveThreadModel: ({ requestedModelId, requestedReasoningEffort }) =>
    Effect.succeed({
      modelId: requestedModelId?.trim() || CHAT_DEFAULT_MODEL_ID,
      reasoningEffort:
        requestedReasoningEffort && requestedReasoningEffort !== 'none'
          ? (requestedReasoningEffort as AiReasoningEffort)
          : undefined,
      source:
        requestedModelId || requestedReasoningEffort ? 'request' : 'thread',
    } satisfies EffectiveModelResolution),
})
