import type { LanguageModelUsage } from 'ai'

type PersistedUsageMessage = {
  readonly role: 'user' | 'assistant' | 'system'
  readonly inputTokens?: number | null
  readonly outputTokens?: number | null
  readonly totalTokens?: number | null
  readonly reasoningTokens?: number | null
  readonly textTokens?: number | null
  readonly cacheReadTokens?: number | null
  readonly cacheWriteTokens?: number | null
  readonly noCacheTokens?: number | null
}

function addDefined(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  return left == null && right == null ? undefined : (left ?? 0) + (right ?? 0)
}

function resolveMessageTotalTokens(
  message: PersistedUsageMessage,
): number | undefined {
  return (
    message.totalTokens ??
    addDefined(message.inputTokens ?? undefined, message.outputTokens ?? undefined)
  )
}

function hasUsage(message: PersistedUsageMessage): boolean {
  return (
    message.inputTokens != null ||
    message.outputTokens != null ||
    message.totalTokens != null ||
    message.reasoningTokens != null ||
    message.textTokens != null ||
    message.cacheReadTokens != null ||
    message.cacheWriteTokens != null ||
    message.noCacheTokens != null
  )
}

function toLanguageModelUsage(
  message: PersistedUsageMessage,
): LanguageModelUsage | undefined {
  if (!hasUsage(message)) return undefined

  return {
    inputTokens: message.inputTokens ?? undefined,
    inputTokenDetails: {
      noCacheTokens: message.noCacheTokens ?? undefined,
      cacheReadTokens: message.cacheReadTokens ?? undefined,
      cacheWriteTokens: message.cacheWriteTokens ?? undefined,
    },
    outputTokens: message.outputTokens ?? undefined,
    outputTokenDetails: {
      textTokens: message.textTokens ?? undefined,
      reasoningTokens: message.reasoningTokens ?? undefined,
    },
    totalTokens: resolveMessageTotalTokens(message),
  }
}

function resolveAssistantTextTokens(
  usage: LanguageModelUsage,
): number | undefined {
  if (usage.outputTokenDetails?.textTokens != null) {
    return usage.outputTokenDetails.textTokens
  }

  const reasoningTokens = usage.outputTokenDetails?.reasoningTokens

  if (usage.outputTokens != null && reasoningTokens != null) {
    return Math.max(0, usage.outputTokens - reasoningTokens)
  }

  return undefined
}

/**
 * The chat UI only shows exact provider-backed usage, never cumulative branch
 * totals or client-side heuristics. We therefore surface only the most recent
 * persisted assistant usage payload for the active branch.
 */
export function buildLatestAssistantUsage(
  messages: readonly PersistedUsageMessage[],
): LanguageModelUsage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message || message.role !== 'assistant') continue

    const usage = toLanguageModelUsage(message)
    if (usage) return usage
  }

  return undefined
}

/**
 * Context usage is reported as the latest completed prompt plus the assistant
 * text that is now part of the conversation. Both values come from persisted
 * provider analytics, so the UI stays grounded in real usage data.
 *
 * When a provider omits the output text breakdown we fall back to the exact
 * input token count instead of inventing a client-side estimate.
 */
export function resolveCurrentContextTokens(
  usage?: LanguageModelUsage,
): number | undefined {
  if (usage?.inputTokens == null) return undefined

  const assistantTextTokens = resolveAssistantTextTokens(usage)
  return usage.inputTokens + (assistantTextTokens ?? 0)
}
