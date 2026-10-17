import { expect, it } from 'vitest'
import { hasProviderWork } from './provider-work'

it('bills usage/cost or streamed output even when there is no successful text answer', () => {
  expect(
    hasProviderWork({
      hasOutput: false,
      analytics: { usedByok: false, inputTokens: 100, reasoningTokens: 8000 },
    }),
  ).toBe(true)
  expect(
    hasProviderWork({
      hasOutput: false,
      analytics: { usedByok: false, aiCost: 0.04 },
    }),
  ).toBe(true)
  expect(
    hasProviderWork({
      hasOutput: false,
      analytics: { usedByok: false, publicCost: 0.04 },
    }),
  ).toBe(true)
  expect(hasProviderWork({ hasOutput: true })).toBe(true)
  expect(
    hasProviderWork({
      hasOutput: false,
      analytics: { usedByok: false, inputTokens: 0, totalTokens: 0 },
    }),
  ).toBe(true)
  expect(hasProviderWork({ hasOutput: false })).toBe(false)
})
