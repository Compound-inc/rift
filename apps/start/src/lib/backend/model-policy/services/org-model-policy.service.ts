import { Effect, Layer, ServiceMap } from 'effect'
import { AI_CATALOG, AI_MODELS_BY_PROVIDER } from '@/lib/shared/ai-catalog'
import {
  TOOL_CATALOG,
  TOOL_CATALOG_BY_KEY,
} from '@/lib/shared/ai-catalog/tool-catalog'
import { isChatModeId  } from '@/lib/shared/chat-modes'
import type {ChatModeId} from '@/lib/shared/chat-modes';
import { evaluateModelAvailability } from '@/lib/shared/model-policy/policy-engine'
import {
  getOrgAiPolicy,
  upsertOrgAiPolicy,
} from '@/lib/backend/model-policy/repository'
import {
  DEFAULT_ORG_TOOL_POLICY,
  EMPTY_ORG_PROVIDER_KEY_STATUS,
} from '@/lib/shared/model-policy/types'
import {
  OrgModelPolicyInvalidRequestError,
  OrgModelPolicyPersistenceError,
} from '../domain/errors'

export type UpdateOrgModelPolicyAction =
  | {
      readonly action: 'toggle_provider'
      readonly providerId: string
      readonly disabled: boolean
    }
  | {
      readonly action: 'toggle_model'
      readonly modelId: string
      readonly disabled: boolean
    }
  | {
      readonly action: 'toggle_compliance_flag'
      readonly flag: string
      readonly enabled: boolean
    }
  | {
      readonly action: 'set_enforced_mode'
      readonly modeId: string | null
    }
  | {
      readonly action: 'toggle_provider_native_tools'
      readonly enabled: boolean
    }
  | {
      readonly action: 'toggle_external_tools'
      readonly enabled: boolean
    }
  | {
      readonly action: 'toggle_tool'
      readonly toolKey: string
      readonly disabled: boolean
    }

export type OrgModelPolicyPayload = {
  readonly organizationId: string
  readonly policy: {
    readonly disabledProviderIds: readonly string[]
    readonly disabledModelIds: readonly string[]
    readonly complianceFlags: Readonly<Record<string, boolean>>
    readonly toolPolicy: {
      readonly providerNativeToolsEnabled: boolean
      readonly externalToolsEnabled: boolean
      readonly disabledToolKeys: readonly string[]
    }
    readonly enforcedModeId?: string
    readonly updatedAt?: number
  }
  readonly providers: readonly {
    readonly id: string
    readonly disabled: boolean
  }[]
  readonly models: readonly {
    readonly id: string
    readonly name: string
    readonly providerId: string
    readonly description: string
    readonly zeroDataRetention: boolean
    readonly disabled: boolean
    readonly deniedBy: readonly ('provider' | 'model' | 'compliance')[]
  }[]
  readonly tools: readonly {
    readonly key: string
    readonly providerId: string
    readonly advanced: boolean
    readonly source: 'provider-native' | 'external'
    readonly disabled: boolean
  }[]
}

export type OrgModelPolicyServiceShape = {
  readonly getPayload: (input: {
    readonly organizationId: string
    readonly requestId: string
  }) => Effect.Effect<OrgModelPolicyPayload, OrgModelPolicyPersistenceError>
  readonly updatePolicy: (input: {
    readonly organizationId: string
    readonly requestId: string
    readonly action: UpdateOrgModelPolicyAction
  }) => Effect.Effect<
    OrgModelPolicyPayload,
    OrgModelPolicyInvalidRequestError | OrgModelPolicyPersistenceError
  >
}

/**
 * Validates catalog-backed update actions before persistence so every
 * server-side write path enforces the same identifier constraints.
 */
export function validateUpdateOrgModelPolicyAction(input: {
  readonly action: UpdateOrgModelPolicyAction
  readonly requestId: string
}): Effect.Effect<void, OrgModelPolicyInvalidRequestError> {
  return Effect.try({
    try: () => {
      const action = input.action
      switch (action.action) {
        case 'toggle_provider':
          if (!AI_MODELS_BY_PROVIDER.has(action.providerId)) {
            throw new OrgModelPolicyInvalidRequestError({
              message: `Unknown provider id: ${action.providerId}`,
              requestId: input.requestId,
            })
          }
          return
        case 'toggle_model':
          if (!AI_CATALOG.some((model) => model.id === action.modelId)) {
            throw new OrgModelPolicyInvalidRequestError({
              message: `Unknown model id: ${action.modelId}`,
              requestId: input.requestId,
            })
          }
          return
        case 'toggle_tool':
          if (!TOOL_CATALOG_BY_KEY.has(action.toolKey)) {
            throw new OrgModelPolicyInvalidRequestError({
              message: `Unknown tool key: ${action.toolKey}`,
              requestId: input.requestId,
            })
          }
          return
        default:
          return
      }
    },
    catch: (error) =>
      error instanceof OrgModelPolicyInvalidRequestError
        ? error
        : new OrgModelPolicyInvalidRequestError({
            message: String(error),
            requestId: input.requestId,
          }),
  })
}

export class OrgModelPolicyService extends ServiceMap.Service<
  OrgModelPolicyService,
  OrgModelPolicyServiceShape
>()('model-policy-backend/OrgModelPolicyService') {
  static readonly layer = Layer.succeed(this, {
    getPayload: Effect.fn('OrgModelPolicyService.getPayload')(
      ({ organizationId, requestId }) =>
        Effect.gen(function* () {
          const policy = yield* loadPolicy({ organizationId, requestId })
          return toOrgModelPolicyPayload(organizationId, policy)
        }),
    ),
    updatePolicy: Effect.fn('OrgModelPolicyService.updatePolicy')(
      ({ organizationId, requestId, action }) =>
        Effect.gen(function* () {
          yield* validateUpdateOrgModelPolicyAction({ action, requestId })
          const existing = yield* loadPolicy({ organizationId, requestId })

          let disabledProviderIds = existing?.disabledProviderIds ?? []
          let disabledModelIds = existing?.disabledModelIds ?? []
          let complianceFlags: Record<string, boolean> = {
            ...(existing?.complianceFlags ?? {}),
          }
          let toolPolicy = {
            ...(existing?.toolPolicy ?? DEFAULT_ORG_TOOL_POLICY),
            disabledToolKeys: [
              ...(
                existing?.toolPolicy.disabledToolKeys ??
                DEFAULT_ORG_TOOL_POLICY.disabledToolKeys
              ),
            ],
          }
          let enforcedModeId: ChatModeId | null | undefined = existing?.enforcedModeId

          if (action.action === 'toggle_provider') {
            disabledProviderIds = action.disabled
              ? addToList(disabledProviderIds, action.providerId)
              : removeFromList(disabledProviderIds, action.providerId)
          }

          if (action.action === 'toggle_model') {
            disabledModelIds = action.disabled
              ? addToList(disabledModelIds, action.modelId)
              : removeFromList(disabledModelIds, action.modelId)
          }

          if (action.action === 'toggle_compliance_flag') {
            complianceFlags = {
              ...complianceFlags,
              [action.flag]: action.enabled,
            }
          }

          if (action.action === 'set_enforced_mode') {
            if (action.modeId && !isChatModeId(action.modeId)) {
              return yield* Effect.fail(
                new OrgModelPolicyPersistenceError({
                  message: `Unknown mode id: ${action.modeId}`,
                  requestId,
                }),
              )
            }
            enforcedModeId = action.modeId
          }

          if (action.action === 'toggle_provider_native_tools') {
            toolPolicy = {
              ...toolPolicy,
              providerNativeToolsEnabled: action.enabled,
            }
          }

          if (action.action === 'toggle_external_tools') {
            toolPolicy = {
              ...toolPolicy,
              externalToolsEnabled: action.enabled,
            }
          }

          if (action.action === 'toggle_tool') {
            toolPolicy = {
              ...toolPolicy,
              disabledToolKeys: action.disabled
                ? addToList(toolPolicy.disabledToolKeys, action.toolKey)
                : removeFromList(toolPolicy.disabledToolKeys, action.toolKey),
            }
          }

          yield* Effect.tryPromise({
            try: () =>
              upsertOrgAiPolicy({
                organizationId,
                disabledProviderIds,
                disabledModelIds,
                complianceFlags,
                toolPolicy,
                orgKnowledgeEnabled: existing?.orgKnowledgeEnabled ?? false,
                providerKeyStatus:
                  existing?.providerKeyStatus ?? EMPTY_ORG_PROVIDER_KEY_STATUS,
                enforcedModeId,
              }),
            catch: (error) =>
              new OrgModelPolicyPersistenceError({
                message: 'Failed to update organization model policy',
                requestId,
                cause: String(error),
              }),
          })
          const updated = yield* loadPolicy({ organizationId, requestId })
          return toOrgModelPolicyPayload(organizationId, updated)
        }),
    ),
  })
}

type ExistingOrgPolicy = Awaited<ReturnType<typeof getOrgAiPolicy>>

const loadPolicy = Effect.fn('OrgModelPolicyService.loadPolicy')(
  ({
    organizationId,
    requestId,
  }: {
    readonly organizationId: string
    readonly requestId: string
  }) =>
    Effect.tryPromise({
      try: () => getOrgAiPolicy(organizationId),
      catch: (error) =>
        new OrgModelPolicyPersistenceError({
          message: 'Failed to load organization model policy',
          requestId,
          cause: String(error),
        }),
    }),
)

function addToList(values: readonly string[], nextValue: string): string[] {
  return [...new Set([...values, nextValue])]
}

function removeFromList(values: readonly string[], target: string): string[] {
  return values.filter((value) => value !== target)
}

function toOrgModelPolicyPayload(
  organizationId: string,
  policy: ExistingOrgPolicy,
): OrgModelPolicyPayload {
  const models = AI_CATALOG.map((model) => {
    const decision = evaluateModelAvailability({ model, policy })
    return {
      id: model.id,
      name: model.name,
      providerId: model.providerId,
      description: model.description,
      zeroDataRetention: model.zeroDataRetention,
      disabled: !decision.allowed,
      deniedBy: decision.deniedBy,
    }
  })

  const providers = [...AI_MODELS_BY_PROVIDER.keys()].map((providerId) => ({
    id: providerId,
    disabled: policy?.disabledProviderIds.includes(providerId) ?? false,
  }))

  return {
    organizationId,
    policy: {
      disabledProviderIds: policy?.disabledProviderIds ?? [],
      disabledModelIds: policy?.disabledModelIds ?? [],
      complianceFlags: policy?.complianceFlags ?? {},
      toolPolicy: {
        providerNativeToolsEnabled:
          policy?.toolPolicy.providerNativeToolsEnabled ??
          DEFAULT_ORG_TOOL_POLICY.providerNativeToolsEnabled,
        externalToolsEnabled:
          policy?.toolPolicy.externalToolsEnabled ??
          DEFAULT_ORG_TOOL_POLICY.externalToolsEnabled,
        disabledToolKeys:
          policy?.toolPolicy.disabledToolKeys ??
          DEFAULT_ORG_TOOL_POLICY.disabledToolKeys,
      },
      orgKnowledgeEnabled: policy?.orgKnowledgeEnabled ?? false,
      enforcedModeId: policy?.enforcedModeId,
      updatedAt: policy?.updatedAt,
    },
    providers,
    models,
    tools: TOOL_CATALOG.map((tool) => ({
      key: tool.key,
      providerId: tool.providerId,
      advanced: tool.advanced,
      source: tool.source,
      disabled:
        !(
          tool.source === 'provider-native'
            ? (policy?.toolPolicy.providerNativeToolsEnabled ?? true)
            : (policy?.toolPolicy.externalToolsEnabled ?? true)
        ) ||
        (policy?.toolPolicy.disabledToolKeys.includes(tool.key) ?? false),
    })),
  } satisfies OrgModelPolicyPayload
}
