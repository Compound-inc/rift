import { Effect, Layer, ServiceMap } from 'effect'
import { AI_CATALOG, AI_MODELS_BY_PROVIDER } from '@/lib/shared/ai-catalog'
import {
  TOOL_CATALOG,
  TOOL_CATALOG_BY_KEY,
} from '@/lib/shared/ai-catalog/tool-catalog'
import {
  CHAT_PRODUCT_KEY,
  normalizeChatProductPolicy,
  resolveEffectiveChatOrgPolicy,
  serializeChatProductPolicy,
} from '@/lib/shared/model-policy/chat-product-policy'
import { isChatModeId  } from '@/lib/shared/chat-modes'
import type {ChatModeId} from '@/lib/shared/chat-modes';
import { evaluateModelAvailability } from '@/lib/shared/model-policy/policy-engine'
import {
  getOrgPolicy,
  upsertOrgPolicy,
} from '@/lib/backend/org-policy/repository'
import {
  getOrgProductPolicy,
  upsertOrgProductPolicy,
} from '@/lib/backend/org-product-policy/repository'
import {
  DEFAULT_ORG_TOOL_POLICY,
  EMPTY_ORG_PROVIDER_KEY_STATUS,
} from '@/lib/shared/model-policy/types'
import {
  ChatPolicyInvalidRequestError,
  ChatPolicyPersistenceError,
} from '../domain/errors'

export type UpdateChatPolicySettingsAction =
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

export type ChatPolicySettingsPayload = {
  readonly organizationId: string
  readonly policy: {
    readonly disabledProviderIds: readonly string[]
    readonly disabledModelIds: readonly string[]
    readonly complianceFlags: Readonly<Record<string, boolean>>
    readonly orgKnowledgeEnabled: boolean
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

export type ChatPolicySettingsServiceShape = {
  readonly getPayload: (input: {
    readonly organizationId: string
    readonly requestId: string
  }) => Effect.Effect<ChatPolicySettingsPayload, ChatPolicyPersistenceError>
  readonly updatePolicy: (input: {
    readonly organizationId: string
    readonly requestId: string
    readonly action: UpdateChatPolicySettingsAction
  }) => Effect.Effect<
    ChatPolicySettingsPayload,
    ChatPolicyInvalidRequestError | ChatPolicyPersistenceError
  >
}

/**
 * Validates catalog-backed update actions before persistence so every
 * server-side write path enforces the same identifier constraints.
 */
export function validateUpdateChatPolicySettingsAction(input: {
  readonly action: UpdateChatPolicySettingsAction
  readonly requestId: string
}): Effect.Effect<void, ChatPolicyInvalidRequestError> {
  return Effect.try({
    try: () => {
      const action = input.action
      switch (action.action) {
        case 'toggle_provider':
          if (!AI_MODELS_BY_PROVIDER.has(action.providerId)) {
            throw new ChatPolicyInvalidRequestError({
              message: `Unknown provider id: ${action.providerId}`,
              requestId: input.requestId,
            })
          }
          return
        case 'toggle_model':
          if (!AI_CATALOG.some((model) => model.id === action.modelId)) {
            throw new ChatPolicyInvalidRequestError({
              message: `Unknown model id: ${action.modelId}`,
              requestId: input.requestId,
            })
          }
          return
        case 'toggle_tool':
          if (!TOOL_CATALOG_BY_KEY.has(action.toolKey)) {
            throw new ChatPolicyInvalidRequestError({
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
      error instanceof ChatPolicyInvalidRequestError
        ? error
        : new ChatPolicyInvalidRequestError({
            message: String(error),
            requestId: input.requestId,
          }),
  })
}

export class ChatPolicySettingsService extends ServiceMap.Service<
  ChatPolicySettingsService,
  ChatPolicySettingsServiceShape
>()('chat-policy-backend/ChatPolicySettingsService') {
  static readonly layer = Layer.succeed(this, {
    getPayload: Effect.fn('ChatPolicySettingsService.getPayload')(
      ({ organizationId, requestId }) =>
        Effect.gen(function* () {
          const loaded = yield* loadPolicy({ organizationId, requestId })
          return toChatPolicySettingsPayload(organizationId, loaded.effectivePolicy)
        }),
    ),
    updatePolicy: Effect.fn('ChatPolicySettingsService.updatePolicy')(
      ({ organizationId, requestId, action }) =>
        Effect.gen(function* () {
          yield* validateUpdateChatPolicySettingsAction({ action, requestId })
          const existing = yield* loadPolicy({ organizationId, requestId })

          let chatPolicy = normalizeChatProductPolicy({
            productPolicy: existing.productPolicy,
            legacyOrgPolicy: existing.orgPolicy,
          })
          let complianceFlags: Record<string, boolean> = {
            ...(existing.orgPolicy?.complianceFlags ?? {}),
          }
          let enforcedModeId: ChatModeId | null | undefined =
            existing.orgPolicy?.enforcedModeId

          if (action.action === 'toggle_provider') {
            chatPolicy = {
              ...chatPolicy,
              disabledProviderIds: action.disabled
                ? addToList(chatPolicy.disabledProviderIds, action.providerId)
                : removeFromList(chatPolicy.disabledProviderIds, action.providerId),
            }
          }

          if (action.action === 'toggle_model') {
            chatPolicy = {
              ...chatPolicy,
              disabledModelIds: action.disabled
                ? addToList(chatPolicy.disabledModelIds, action.modelId)
                : removeFromList(chatPolicy.disabledModelIds, action.modelId),
            }
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
                new ChatPolicyPersistenceError({
                  message: `Unknown mode id: ${action.modeId}`,
                  requestId,
                }),
              )
            }
            enforcedModeId = action.modeId
          }

          if (action.action === 'toggle_provider_native_tools') {
            chatPolicy = {
              ...chatPolicy,
              toolPolicy: {
                ...chatPolicy.toolPolicy,
                providerNativeToolsEnabled: action.enabled,
              },
            }
          }

          if (action.action === 'toggle_external_tools') {
            chatPolicy = {
              ...chatPolicy,
              toolPolicy: {
                ...chatPolicy.toolPolicy,
                externalToolsEnabled: action.enabled,
              },
            }
          }

          if (action.action === 'toggle_tool') {
            chatPolicy = {
              ...chatPolicy,
              toolPolicy: {
                ...chatPolicy.toolPolicy,
                disabledToolKeys: action.disabled
                  ? addToList(chatPolicy.toolPolicy.disabledToolKeys, action.toolKey)
                  : removeFromList(
                      chatPolicy.toolPolicy.disabledToolKeys,
                      action.toolKey,
                    ),
              },
            }
          }

          yield* Effect.tryPromise({
            try: async () => {
              if (
                action.action === 'toggle_provider' ||
                action.action === 'toggle_model' ||
                action.action === 'toggle_provider_native_tools' ||
                action.action === 'toggle_external_tools' ||
                action.action === 'toggle_tool'
              ) {
                await upsertOrgProductPolicy({
                  organizationId,
                  productKey: CHAT_PRODUCT_KEY,
                  policy: serializeChatProductPolicy(chatPolicy),
                })
                return
              }

              await upsertOrgPolicy({
                organizationId,
                disabledProviderIds: existing.orgPolicy?.disabledProviderIds ?? [],
                disabledModelIds: existing.orgPolicy?.disabledModelIds ?? [],
                complianceFlags,
                toolPolicy: existing.orgPolicy?.toolPolicy ?? DEFAULT_ORG_TOOL_POLICY,
                orgKnowledgeEnabled: existing.orgPolicy?.orgKnowledgeEnabled ?? false,
                providerKeyStatus:
                  existing.orgPolicy?.providerKeyStatus ??
                  EMPTY_ORG_PROVIDER_KEY_STATUS,
                enforcedModeId,
              })
            },
            catch: (error) =>
              new ChatPolicyPersistenceError({
                message: 'Failed to update organization chat policy settings',
                requestId,
                cause: String(error),
              }),
          })
          const updated = yield* loadPolicy({ organizationId, requestId })
          return toChatPolicySettingsPayload(organizationId, updated.effectivePolicy)
        }),
    ),
  })
}

type LoadedPolicyState = {
  readonly orgPolicy: Awaited<ReturnType<typeof getOrgPolicy>>
  readonly productPolicy: Awaited<ReturnType<typeof getOrgProductPolicy>>
  readonly effectivePolicy: Awaited<ReturnType<typeof getOrgPolicy>>
}

const loadPolicy = Effect.fn('ChatPolicySettingsService.loadPolicy')(
  ({
    organizationId,
    requestId,
  }: {
    readonly organizationId: string
    readonly requestId: string
  }) =>
    Effect.tryPromise({
      try: async () => {
        const [orgPolicy, productPolicy] = await Promise.all([
          getOrgPolicy(organizationId),
          getOrgProductPolicy(organizationId, CHAT_PRODUCT_KEY),
        ])

        return {
          orgPolicy,
          productPolicy,
          effectivePolicy: resolveEffectiveChatOrgPolicy({
            orgPolicy,
            productPolicy,
          }),
        } satisfies LoadedPolicyState
      },
      catch: (error) =>
        new ChatPolicyPersistenceError({
          message: 'Failed to load organization chat policy settings',
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

function toChatPolicySettingsPayload(
  organizationId: string,
  policy: Awaited<ReturnType<typeof getOrgPolicy>>,
): ChatPolicySettingsPayload {
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
  } satisfies ChatPolicySettingsPayload
}
