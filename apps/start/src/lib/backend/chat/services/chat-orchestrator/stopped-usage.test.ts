import { describe, expect, it } from 'vitest'
import { resolveStoppedUsage } from './stopped-usage'

const input = {
  modelId: 'openai/gpt-5-mini',
  messages: [
    {
      id: 'u',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'prompt text' }],
    },
  ],
  text: 'partial answer',
  reasoning: 'thinking',
  usedByok: false,
  reservedNanoUsd: 1000,
}

describe('stopped usage settlement estimate', () => {
  it('preserves exact provider usage and spend when available', () => {
    const analytics = {
      usedByok: false,
      inputTokens: 123,
      outputTokens: 45,
      totalTokens: 168,
      aiCost: 0.00123,
    }
    expect(resolveStoppedUsage({ ...input, analytics })).toMatchObject(
      analytics,
    )
  })
  it('estimates visible reasoning and text rather than discarding usage after abort', () => {
    const usage = resolveStoppedUsage(input)
    expect(usage.inputTokens).toBe(3)
    expect(usage.outputTokens).toBe(6)
    expect(usage.totalTokens).toBe(9)
    expect(usage.aiCost).toBeGreaterThan(0)
  })
  it('settles even a stop before the first output token', () => {
    const usage = resolveStoppedUsage({ ...input, text: '', reasoning: '' })
    expect(usage.outputTokens).toBe(0)
    expect(usage.inputTokens).toBe(3)
    expect(usage.aiCost).toBeGreaterThan(0)
  })
  it('uses reserved spend when catalog pricing is unavailable', () => {
    expect(
      resolveStoppedUsage({ ...input, modelId: 'missing-model' }).aiCost,
    ).toBe(0.000001)
  })
})
