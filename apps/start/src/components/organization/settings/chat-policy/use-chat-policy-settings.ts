import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AI_CATALOG, AI_MODELS_BY_PROVIDER } from '@/lib/shared/ai-catalog'
import { TOOL_CATALOG } from '@/lib/shared/ai-catalog/tool-catalog'
import { evaluateModelAvailability } from '@/lib/shared/model-policy/policy-engine'
import { useChatProductPolicy } from '@/lib/frontend/organizations/use-chat-product-policy'
import type { ChatPolicySettingsUpdateAction, ChatPolicySettingsPayload } from './types'

function buildChatPolicySettingsPayload(input: {
  readonly policy: ReturnType<typeof useChatProductPolicy>['effectivePolicy']
  readonly chatPolicy: ReturnType<typeof useChatProductPolicy>['chatPolicy']
}): ChatPolicySettingsPayload {
  const policy = {
    disabledProviderIds: [...input.chatPolicy.disabledProviderIds],
    disabledModelIds: [...input.chatPolicy.disabledModelIds],
    complianceFlags: { ...(input.policy?.complianceFlags ?? {}) },
    toolPolicy: {
      providerNativeToolsEnabled:
        input.chatPolicy.toolPolicy.providerNativeToolsEnabled,
      externalToolsEnabled: input.chatPolicy.toolPolicy.externalToolsEnabled,
      disabledToolKeys: [...input.chatPolicy.toolPolicy.disabledToolKeys],
    },
    enforcedModeId: input.policy?.enforcedModeId,
    updatedAt: input.policy?.updatedAt,
  }

  return {
    policy,
    providers: [...AI_MODELS_BY_PROVIDER.keys()].map((providerId) => ({
      id: providerId,
      disabled: policy.disabledProviderIds.includes(providerId),
    })),
    models: AI_CATALOG.map((model) => {
      const decision = evaluateModelAvailability({
        model,
        policy: input.policy,
      })
      return {
        id: model.id,
        name: model.name,
        providerId: model.providerId,
        description: model.description,
        zeroDataRetention: model.zeroDataRetention,
        disabled: !decision.allowed,
        deniedBy: [...decision.deniedBy],
      }
    }),
    tools: TOOL_CATALOG.map((tool) => ({
      key: tool.key,
      providerId: tool.providerId,
      advanced: tool.advanced,
      source: tool.source,
      disabled:
        !(
          tool.source === 'provider-native'
            ? policy.toolPolicy.providerNativeToolsEnabled
            : policy.toolPolicy.externalToolsEnabled
        ) ||
        policy.toolPolicy.disabledToolKeys.includes(tool.key),
    })),
  }
}

function add(values: readonly string[], candidate: string): readonly string[] {
  return [...new Set([...values, candidate])]
}

function remove(values: readonly string[], candidate: string): readonly string[] {
  return values.filter((value) => value !== candidate)
}

/** Zero-backed hook for chat-specific provider/model/tool policy in realtime. */
export function useChatPolicySettings() {
  const chatProductPolicy = useChatProductPolicy()
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const payload = useMemo(
    () =>
      buildChatPolicySettingsPayload({
        policy: chatProductPolicy.effectivePolicy,
        chatPolicy: chatProductPolicy.chatPolicy,
      }),
    [chatProductPolicy.chatPolicy, chatProductPolicy.effectivePolicy],
  )

  const update = useCallback(
    async (body: ChatPolicySettingsUpdateAction) => {
      setUpdating(true)
      setError(null)
      try {
        if (body.action === 'toggle_provider') {
          await chatProductPolicy.setChatPolicy({
            ...chatProductPolicy.chatPolicy,
            disabledProviderIds: body.disabled
              ? add(chatProductPolicy.chatPolicy.disabledProviderIds, body.providerId)
              : remove(chatProductPolicy.chatPolicy.disabledProviderIds, body.providerId),
          })
        }
        if (body.action === 'toggle_model') {
          await chatProductPolicy.setChatPolicy({
            ...chatProductPolicy.chatPolicy,
            disabledModelIds: body.disabled
              ? add(chatProductPolicy.chatPolicy.disabledModelIds, body.modelId)
              : remove(chatProductPolicy.chatPolicy.disabledModelIds, body.modelId),
          })
        }
        if (body.action === 'toggle_compliance_flag') {
          await chatProductPolicy.updateComplianceFlag({
            flag: body.flag,
            enabled: body.enabled,
          })
        }
        if (body.action === 'set_enforced_mode') {
          await chatProductPolicy.setEnforcedMode(body.modeId)
        }
        if (body.action === 'toggle_provider_native_tools') {
          await chatProductPolicy.setChatPolicy({
            ...chatProductPolicy.chatPolicy,
            toolPolicy: {
              ...chatProductPolicy.chatPolicy.toolPolicy,
              providerNativeToolsEnabled: body.enabled,
            },
          })
        }
        if (body.action === 'toggle_external_tools') {
          await chatProductPolicy.setChatPolicy({
            ...chatProductPolicy.chatPolicy,
            toolPolicy: {
              ...chatProductPolicy.chatPolicy.toolPolicy,
              externalToolsEnabled: body.enabled,
            },
          })
        }
        if (body.action === 'toggle_tool') {
          await chatProductPolicy.setChatPolicy({
            ...chatProductPolicy.chatPolicy,
            toolPolicy: {
              ...chatProductPolicy.chatPolicy.toolPolicy,
              disabledToolKeys: body.disabled
                ? add(
                    chatProductPolicy.chatPolicy.toolPolicy.disabledToolKeys,
                    body.toolKey,
                  )
                : remove(
                    chatProductPolicy.chatPolicy.toolPolicy.disabledToolKeys,
                    body.toolKey,
                  ),
            },
          })
        }
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Failed to update chat policy settings'
        setError(message)
        toast.error(message)
      } finally {
        setUpdating(false)
      }
    },
    [chatProductPolicy],
  )

  return {
    payload,
    loading: chatProductPolicy.loading,
    error: error ?? chatProductPolicy.error,
    updating: updating || chatProductPolicy.saving,
    update,
  }
}
