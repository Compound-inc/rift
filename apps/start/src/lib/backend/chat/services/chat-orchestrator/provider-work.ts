import type { PersistedGenerationAnalytics } from '../../domain/generation-metrics'

/**
 * Charge reported usage/cost or observed provider output, even without an answer.
 * An explicit zero report is still a report; missing accounting is not. Keep
 * synthetic pre-provider aborts free of accounting so they release the hold.
 */
export function hasProviderWork(input: {
  readonly analytics?: PersistedGenerationAnalytics
  readonly hasOutput: boolean
}): boolean {
  return (
    input.hasOutput ||
    [
        input.analytics?.inputTokens,
        input.analytics?.outputTokens,
        input.analytics?.totalTokens,
        input.analytics?.reasoningTokens,
      input.analytics?.textTokens,
      input.analytics?.cacheReadTokens,
      input.analytics?.cacheWriteTokens,
      input.analytics?.noCacheTokens,
        input.analytics?.aiCost,
        input.analytics?.publicCost,
        input.analytics?.billableWebSearchCalls,
    ].some((value) => value !== undefined)
  )
}
