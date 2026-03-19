import { CHAT_MODE_REGISTRY, getChatModeDefinition } from './registry'
import type { ChatModeId, ResolvedChatMode } from './types'

export function isChatModeId(value: string): value is ChatModeId {
  return value in CHAT_MODE_REGISTRY
}

/**
 * Resolves the effective mode.
 * 1) org-enforced mode
 * 2) request mode
 * 3) thread mode
 */
export function resolveEffectiveChatMode(input: {
  readonly orgEnforcedModeId?: string
  readonly requestModeId?: string
  readonly threadModeId?: string
}): ResolvedChatMode | undefined {
  const orgMode = normalizeModeId(input.orgEnforcedModeId)
  if (orgMode) {
    return {
      modeId: orgMode,
      isEnforced: true,
      source: 'org',
      definition: getChatModeDefinition(orgMode),
    }
  }

  const requestMode = normalizeModeId(input.requestModeId)
  if (requestMode) {
    return {
      modeId: requestMode,
      isEnforced: false,
      source: 'request',
      definition: getChatModeDefinition(requestMode),
    }
  }

  const threadMode = normalizeModeId(input.threadModeId)
  if (threadMode) {
    return {
      modeId: threadMode,
      isEnforced: false,
      source: 'thread',
      definition: getChatModeDefinition(threadMode),
    }
  }

  return undefined
}

function normalizeModeId(value?: string): ChatModeId | undefined {
  const normalized = value?.trim()
  if (!normalized || !isChatModeId(normalized)) return undefined
  return normalized
}
