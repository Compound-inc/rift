import { describe, expect, it } from 'vitest'
import {
  getBlendedCostUsdPerMillionTokens,
  getCostTierForBlendedUsdPerMillionTokens,
  getModelCostTier,
} from './cost-tier'

describe('getBlendedCostUsdPerMillionTokens', () => {
  it('returns undefined when pricing is missing', () => {
    expect(getBlendedCostUsdPerMillionTokens(undefined)).toBeUndefined()
  })

  it('returns undefined when prices are unparseable', () => {
    expect(
      getBlendedCostUsdPerMillionTokens({
        inputPerToken: 'not-a-number',
        outputPerToken: '0.000001',
      }),
    ).toBeUndefined()
  })

  it('uses a 3:1 input:output blend per million tokens', () => {
    // 3 * 1.00 + 1 * 5.00 over 4 = 2.00 USD/M tokens
    const blended = getBlendedCostUsdPerMillionTokens({
      inputPerToken: '0.000001',
      outputPerToken: '0.000005',
    })
    expect(blended).toBeCloseTo(2, 6)
  })
})

describe('getCostTierForBlendedUsdPerMillionTokens', () => {
  it.each([
    [0.05, 'very_low'],
    [0.5, 'very_low'],
    [0.51, 'low'],
    [2, 'low'],
    [2.01, 'medium'],
    [7, 'medium'],
    [7.01, 'high'],
    [20, 'high'],
    [20.01, 'very_high'],
    [60, 'very_high'],
  ] as const)('maps %p USD/M tokens to %s', (blended, tier) => {
    expect(getCostTierForBlendedUsdPerMillionTokens(blended)).toBe(tier)
  })
})

describe('getModelCostTier', () => {
  it('returns undefined when the model has no pricing', () => {
    expect(getModelCostTier({ pricing: undefined })).toBeUndefined()
  })

  it('classifies a budget utility model as very_low', () => {
    // Real catalog example: tiny qwen-style model. blended ≈ 0.17 USD/M
    expect(
      getModelCostTier({
        pricing: {
          inputPerToken: '0.00000007',
          outputPerToken: '0.000000463',
        },
      }),
    ).toBe('very_low')
  })

  it('classifies a mainstream flagship model as medium', () => {
    // GPT-5.4-style pricing: $2.50/M input, $15/M output. blended ≈ 5.625 USD/M
    expect(
      getModelCostTier({
        pricing: {
          inputPerToken: '0.0000025',
          outputPerToken: '0.000015',
        },
      }),
    ).toBe('medium')
  })

  it('classifies a premium reasoning model as very_high', () => {
    // Opus-style pricing: $15/M input, $60/M output. blended ≈ 26.25 USD/M
    expect(
      getModelCostTier({
        pricing: {
          inputPerToken: '0.000015',
          outputPerToken: '0.00006',
        },
      }),
    ).toBe('very_high')
  })
})
