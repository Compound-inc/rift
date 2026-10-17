import type { UIMessage } from 'ai'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
import {
  estimatePromptTokens,
  estimateTokensFromText,
} from '@/lib/shared/chat-contracts'
import type { PersistedGenerationAnalytics } from '../../domain/generation-metrics'

/**
 * Abort can omit the provider's final usage frame. Prefer every reported token
 * and cost field; otherwise estimate prompt + visible text/reasoning at the
 * catalog rate. Hidden reasoning and tool fees cannot be recovered on abort.
 * An abort during a tool call with no visible output can only estimate the
 * prompt; unreported tool output and hidden provider work are unavailable.
 * Models without catalog pricing use the reservation when one exists.
 */
export function resolveStoppedUsage(input: {
  readonly analytics?: PersistedGenerationAnalytics
  readonly modelId: string
  readonly messages: readonly UIMessage[]
  readonly text: string
  readonly reasoning: string
  readonly usedByok: boolean
  readonly reservedNanoUsd?: number
}): PersistedGenerationAnalytics {
  const pricing = getCatalogModel(input.modelId)?.pricing
  const inputTokens =
    input.analytics?.inputTokens ?? estimatePromptTokens(input.messages)
  const reasoningTokens =
    input.analytics?.reasoningTokens ??
    (input.reasoning ? estimateTokensFromText(input.reasoning) : 0)
  const textTokens =
    input.analytics?.textTokens ??
    (input.text ? estimateTokensFromText(input.text) : 0)
  const outputTokens =
    input.analytics?.outputTokens ?? textTokens + reasoningTokens
  const cost = pricing
    ? tokenCost(inputTokens, pricing.inputPerToken, pricing.inputTiers) +
      tokenCost(outputTokens, pricing.outputPerToken, pricing.outputTiers)
    : (input.reservedNanoUsd ?? 0) / 1_000_000_000
  return {
    ...input.analytics,
    usedByok: input.usedByok,
    inputTokens,
    outputTokens,
    totalTokens: input.analytics?.totalTokens ?? inputTokens + outputTokens,
    reasoningTokens,
    textTokens,
    ...((input.analytics?.aiCost ?? input.analytics?.publicCost) == null
      ? { aiCost: cost }
      : {}),
  }
}

function tokenCost(
  tokens: number,
  base: string,
  tiers?: readonly { min: number; max?: number; cost: string }[],
): number {
  if (!tiers?.length) return tokens * Number(base)
  return tiers.reduce(
    (cost, tier) =>
      cost +
      Math.max(0, Math.min(tokens, tier.max ?? tokens) - tier.min) *
        Number(tier.cost),
    0,
  )
}
