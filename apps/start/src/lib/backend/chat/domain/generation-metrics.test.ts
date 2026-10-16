import { describe, expect, it } from 'vitest'
import { buildPersistedGenerationAnalytics } from './generation-metrics'
import { canExposeUserCost } from '@/utils/app-feature-flags'

describe('buildPersistedGenerationAnalytics', () => {
  it('extracts dedicated analytics columns and omits persisted metadata blobs', () => {
    const analytics = buildPersistedGenerationAnalytics({
      usedByok: false,
      usage: {
        inputTokens: 120,
        inputTokenDetails: {
          noCacheTokens: 100,
          cacheReadTokens: 20,
          cacheWriteTokens: 0,
        },
        outputTokens: 30,
        outputTokenDetails: {
          textTokens: 24,
          reasoningTokens: 6,
        },
        totalTokens: 150,
      },
      providerMetadata: {
        openai: {
          responseId: 'resp_123',
          serviceTier: 'default',
        },
        gateway: {
          generationId: 'gen_local_only',
          cost: '0.0013025',
          marketCost: '0.001401',
          billableWebSearchCalls: 0,
          routing: {
            provider: 'openai',
          },
        },
      },
    })

    expect(analytics.aiCost).toBe(
      canExposeUserCost ? undefined : 0.0013025,
    )
    expect(analytics.publicCost).toBe(
      canExposeUserCost ? 0.0013025 : undefined,
    )
    expect(analytics.usedByok).toBe(false)
    expect(analytics.inputTokens).toBe(120)
    expect(analytics.outputTokens).toBe(30)
    expect(analytics.totalTokens).toBe(150)
    expect(analytics.reasoningTokens).toBe(6)
    expect(analytics.textTokens).toBe(24)
    expect(analytics.cacheReadTokens).toBe(20)
    expect(analytics.cacheWriteTokens).toBe(0)
    expect(analytics.noCacheTokens).toBe(100)
    expect(analytics.billableWebSearchCalls).toBe(0)
    expect(analytics.providerMetadata).toBeUndefined()
    expect(analytics.generationMetadata).toBeUndefined()
  })

  it('falls back to summed totals when totalTokens is absent', () => {
    const analytics = buildPersistedGenerationAnalytics({
      usedByok: true,
      usage: {
        inputTokens: 220,
        inputTokenDetails: {
          noCacheTokens: 220,
          cacheReadTokens: 0,
          cacheWriteTokens: undefined,
        },
        outputTokens: 55,
        outputTokenDetails: {
          textTokens: 55,
          reasoningTokens: 0,
        },
        totalTokens: undefined,
      },
      providerMetadata: {
        gateway: {
          cost: '0.0021',
        },
      },
    })

    expect(analytics.aiCost).toBeUndefined()
    expect(analytics.publicCost).toBe(0.0021)
    expect(analytics.usedByok).toBe(true)
    expect(analytics.totalTokens).toBe(275)
    expect(analytics.cacheWriteTokens).toBeUndefined()
    expect(analytics.providerMetadata).toBeUndefined()
    expect(analytics.generationMetadata).toBeUndefined()
  })

  it('extracts cost and tokens from OpenRouter usage accounting metadata', () => {
    const analytics = buildPersistedGenerationAnalytics({
      usedByok: false,
      // OpenRouter does not always populate the AI SDK structured usage
      // shape; we rely on `providerMetadata.openrouter.usage` instead.
      usage: {
        inputTokens: undefined,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokens: undefined,
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
        totalTokens: undefined,
      },
      providerMetadata: {
        openrouter: {
          provider: 'anthropic',
          usage: {
            promptTokens: 1500,
            promptTokensDetails: {
              cachedTokens: 400,
            },
            completionTokens: 250,
            completionTokensDetails: {
              reasoningTokens: 80,
            },
            totalTokens: 1750,
            cost: 0.00345,
          },
        },
      },
    })

    expect(analytics.publicCost).toBe(
      canExposeUserCost ? 0.00345 : undefined,
    )
    expect(analytics.aiCost).toBe(
      canExposeUserCost ? undefined : 0.00345,
    )
    expect(analytics.usedByok).toBe(false)
    expect(analytics.inputTokens).toBe(1500)
    expect(analytics.outputTokens).toBe(250)
    expect(analytics.totalTokens).toBe(1750)
    expect(analytics.cacheReadTokens).toBe(400)
    // 1500 prompt - 400 cached = 1100 fresh input tokens.
    expect(analytics.noCacheTokens).toBe(1100)
    expect(analytics.reasoningTokens).toBe(80)
    // 250 completion - 80 reasoning = 170 text-only tokens.
    expect(analytics.textTokens).toBe(170)
  })

  it('prefers BYOK upstream cost when OpenRouter reports both', () => {
    const analytics = buildPersistedGenerationAnalytics({
      usedByok: true,
      usage: {
        inputTokens: 100,
        inputTokenDetails: {
          noCacheTokens: 100,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokens: 40,
        outputTokenDetails: {
          textTokens: 40,
          reasoningTokens: 0,
        },
        totalTokens: 140,
      },
      providerMetadata: {
        openrouter: {
          provider: 'openai',
          usage: {
            promptTokens: 100,
            completionTokens: 40,
            totalTokens: 140,
            cost: 0.0008,
            costDetails: {
              upstreamInferenceCost: 0.00065,
            },
          },
        },
      },
    })

    // BYOK cost is always exposed via publicCost.
    expect(analytics.publicCost).toBe(0.00065)
    expect(analytics.aiCost).toBeUndefined()
  })

  it('prefers AI Gateway cost over OpenRouter cost when both are present', () => {
    const analytics = buildPersistedGenerationAnalytics({
      usedByok: true,
      usage: {
        inputTokens: 10,
        inputTokenDetails: {
          noCacheTokens: 10,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokens: 5,
        outputTokenDetails: {
          textTokens: 5,
          reasoningTokens: 0,
        },
        totalTokens: 15,
      },
      providerMetadata: {
        gateway: { cost: '0.001' },
        openrouter: { usage: { cost: 0.999 } },
      },
    })

    // Gateway is the authoritative transport when both are reported.
    expect(analytics.publicCost).toBe(0.001)
  })
  it.each([
    {
      provider: 'Anthropic',
      usage: {
        inputTokens: 4_700,
        inputTokenDetails: {
          noCacheTokens: 200,
          cacheReadTokens: 3_000,
          cacheWriteTokens: 1_500,
        },
        outputTokens: 320,
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
        totalTokens: 5_020,
      },
      providerMetadata: {
        anthropic: {
          usage: {
            input_tokens: 200,
            cache_read_input_tokens: 3_000,
            cache_creation_input_tokens: 1_500,
            output_tokens: 320,
          },
        },
        gateway: { cost: '0.007932', billableWebSearchCalls: 2 },
      },
      expected: {
        inputTokens: 4_700,
        outputTokens: 320,
        totalTokens: 5_020,
        noCacheTokens: 200,
        cacheReadTokens: 3_000,
        cacheWriteTokens: 1_500,
        reasoningTokens: undefined,
        textTokens: undefined,
        billableWebSearchCalls: 2,
      },
      cost: 0.007932,
    },
    {
      provider: 'OpenAI Responses',
      usage: {
        inputTokens: 2_400,
        inputTokenDetails: {
          noCacheTokens: 1_376,
          cacheReadTokens: 1_024,
          cacheWriteTokens: undefined,
        },
        outputTokens: 510,
        outputTokenDetails: { textTokens: 110, reasoningTokens: 400 },
        totalTokens: 2_910,
      },
      providerMetadata: {
        openai: { responseId: 'resp_v7', serviceTier: 'default' },
        gateway: { cost: 0.00876, billableWebSearchCalls: 1 },
      },
      expected: {
        inputTokens: 2_400,
        outputTokens: 510,
        totalTokens: 2_910,
        noCacheTokens: 1_376,
        cacheReadTokens: 1_024,
        cacheWriteTokens: undefined,
        reasoningTokens: 400,
        textTokens: 110,
        billableWebSearchCalls: 1,
      },
      cost: 0.00876,
    },
    {
      provider: 'Google',
      // Google includes thoughts in outputTokens, but not in candidatesTokenCount.
      usage: {
        inputTokens: 1_200,
        inputTokenDetails: {
          noCacheTokens: 400,
          cacheReadTokens: 800,
          cacheWriteTokens: undefined,
        },
        outputTokens: 450,
        outputTokenDetails: { textTokens: 150, reasoningTokens: 300 },
        totalTokens: 1_650,
      },
      providerMetadata: {
        google: { groundingMetadata: { webSearchQueries: ['latest release'] } },
        gateway: { cost: '0.00237', billableWebSearchCalls: 1 },
      },
      expected: {
        inputTokens: 1_200,
        outputTokens: 450,
        totalTokens: 1_650,
        noCacheTokens: 400,
        cacheReadTokens: 800,
        cacheWriteTokens: undefined,
        reasoningTokens: 300,
        textTokens: 150,
        billableWebSearchCalls: 1,
      },
      cost: 0.00237,
    },
    {
      provider: 'OpenRouter v3',
      usage: {
        inputTokens: 1_500,
        inputTokenDetails: {
          noCacheTokens: 1_100,
          cacheReadTokens: 400,
          cacheWriteTokens: 250,
        },
        outputTokens: 250,
        outputTokenDetails: { textTokens: 170, reasoningTokens: 80 },
        totalTokens: 1_750,
      },
      providerMetadata: {
        openrouter: {
          provider: 'Anthropic',
          usage: {
            promptTokens: 1_500,
            promptTokensDetails: { cachedTokens: 400 },
            completionTokens: 250,
            completionTokensDetails: { reasoningTokens: 80 },
            totalTokens: 1_750,
            cost: 0.00345,
          },
        },
      },
      expected: {
        inputTokens: 1_500,
        outputTokens: 250,
        totalTokens: 1_750,
        noCacheTokens: 1_100,
        cacheReadTokens: 400,
        cacheWriteTokens: 250,
        reasoningTokens: 80,
        textTokens: 170,
        billableWebSearchCalls: undefined,
      },
      cost: 0.00345,
    },
  ])(
    'preserves $provider v7 accounting without deprecated usage fields',
    ({ usage, providerMetadata, expected, cost }) => {
      const analytics = buildPersistedGenerationAnalytics({
        usedByok: false,
        usage,
        providerMetadata,
      })

      expect(analytics).toMatchObject(expected)
      expect(analytics.aiCost ?? analytics.publicCost).toBe(cost)
      expect(analytics.providerMetadata).toBeUndefined()
    },
  )

  it('does not replace zero provider usage or cost with metadata fallbacks', () => {
    const analytics = buildPersistedGenerationAnalytics({
      usedByok: true,
      usage: {
        inputTokens: 0,
        inputTokenDetails: {
          noCacheTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokens: 0,
        outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
        totalTokens: 0,
      },
      providerMetadata: {
        gateway: { cost: '0', billableWebSearchCalls: 0 },
        openrouter: {
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
            cost: 1,
          },
        },
      },
    })

    expect(analytics).toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      noCacheTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      textTokens: 0,
      publicCost: 0,
      billableWebSearchCalls: 0,
    })
  })
})
