type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' ? (value as RecordValue) : {}
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : typeof value === 'string' &&
        value.trim() &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
      ? Number(value)
      : undefined

/**
 * SDK usage already totals tokens across steps. Provider metadata remains per-step,
 * so summing only accounting fields avoids both underbilling and doubling tokens.
 * Normalize OpenRouter's BYOK fallback per step before summing, since a step may
 * report credits while another reports upstreamInferenceCost.
 */
export function aggregateStepAccounting(
  steps: readonly { providerMetadata?: unknown }[],
): RecordValue {
  const final = record(steps.at(-1)?.providerMetadata)
  const sum = (read: (root: RecordValue) => unknown) => {
    const values = steps
      .map((step) => number(read(record(step.providerMetadata))))
      .filter((value): value is number => value !== undefined)
    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : undefined
  }
  const gatewayCost = sum((root) => record(root.gateway).cost)
  const billableWebSearchCalls = sum(
    (root) => record(root.gateway).billableWebSearchCalls,
  )
  const openrouterCost = sum((root) => {
    const usage = record(record(root.openrouter).usage)
    return number(record(usage.costDetails).upstreamInferenceCost) ?? usage.cost
  })
  const openrouterUsage = { ...record(record(final.openrouter).usage) }
  // Override last-step counters used by analytics when SDK usage is incomplete.
  for (const key of ['promptTokens', 'completionTokens', 'totalTokens']) {
    const total = sum((root) => record(record(root.openrouter).usage)[key])
    if (total !== undefined) openrouterUsage[key] = total
  }
  for (const [parent, field] of [
    ['promptTokensDetails', 'cachedTokens'],
    ['completionTokensDetails', 'reasoningTokens'],
  ] as const) {
    const total = sum(
      (root) => record(record(record(root.openrouter).usage)[parent])[field],
    )
    if (total !== undefined)
      openrouterUsage[parent] = {
        ...record(openrouterUsage[parent]),
        [field]: total,
      }
  }
  const details = { ...record(openrouterUsage.costDetails) }
  delete details.upstreamInferenceCost
  return {
    ...final,
    ...(gatewayCost !== undefined || billableWebSearchCalls !== undefined
      ? {
          gateway: {
            ...record(final.gateway),
            cost: gatewayCost,
            billableWebSearchCalls,
          },
        }
      : {}),
    ...(steps.some((step) => record(step.providerMetadata).openrouter != null)
      ? {
          openrouter: {
            ...record(final.openrouter),
            usage: {
              ...openrouterUsage,
              cost: openrouterCost,
              costDetails: details,
            },
          },
        }
      : {}),
  }
}
