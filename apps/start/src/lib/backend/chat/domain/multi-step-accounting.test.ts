import { describe, expect, it } from 'vitest'
import { aggregateStepAccounting } from './multi-step-accounting'
import { buildPersistedGenerationAnalytics } from './generation-metrics'

describe('multi-step accounting', () => {
  it('sums every gateway step and billable search while preserving SDK token totals', () => {
    const providerMetadata = aggregateStepAccounting([
      {
        providerMetadata: {
          gateway: { cost: '0.03', billableWebSearchCalls: 2 },
        },
      },
      {
        providerMetadata: {
          gateway: { cost: '0.02', billableWebSearchCalls: 1 },
        },
      },
    ])
    const analytics = buildPersistedGenerationAnalytics({
      providerMetadata,
      usedByok: true,
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        totalTokens: 150,
        inputTokenDetails: {},
        outputTokenDetails: {},
      } as never,
    })
    expect(analytics.publicCost).toBeCloseTo(0.05)
    expect(analytics.totalTokens).toBe(150)
    expect(analytics.billableWebSearchCalls).toBe(3)
  })
  it('normalizes OpenRouter upstream costs per step, including mixed fallback and zeros', () => {
    const metadata = aggregateStepAccounting([
      {
        providerMetadata: {
          openrouter: {
            usage: {
              cost: 4,
              costDetails: { upstreamInferenceCost: 0.1 },
              promptTokens: 100,
            },
          },
        },
      },
      {
        providerMetadata: {
          openrouter: { usage: { cost: '0.2', promptTokens: 200 } },
        },
      },
      {
        providerMetadata: {
          openrouter: {
            usage: {
              cost: 1,
              costDetails: { upstreamInferenceCost: 0 },
              promptTokens: 50,
            },
          },
        },
      },
    ])
    const analytics = buildPersistedGenerationAnalytics({
      providerMetadata: metadata,
      usedByok: true,
    })
    expect(analytics.publicCost).toBeCloseTo(0.3)
    expect(analytics.inputTokens).toBe(350)
  })
  it('ignores invalid cost metadata without inventing a zero-cost turn', () => {
    const result = buildPersistedGenerationAnalytics({
      providerMetadata: aggregateStepAccounting([
        { providerMetadata: { gateway: { cost: 'invalid' } } },
      ]),
      usedByok: true,
    })
    expect(result.publicCost).toBeUndefined()
    expect(aggregateStepAccounting([])).toEqual({})
  })
})
