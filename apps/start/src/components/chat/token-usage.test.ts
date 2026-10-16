import { describe, expect, it } from 'vitest'
import {
  buildLatestAssistantUsage,
  resolveCurrentContextTokens,
} from './token-usage'

describe('buildLatestAssistantUsage', () => {
  it('returns the latest persisted assistant usage on the active branch', () => {
    const usage = buildLatestAssistantUsage([
      {
        role: 'assistant',
        inputTokens: 2_410,
        outputTokens: 345,
        totalTokens: 2_755,
        reasoningTokens: 315,
        textTokens: 30,
        cacheReadTokens: 563,
        cacheWriteTokens: 0,
        noCacheTokens: 1_847,
      },
      {
        role: 'assistant',
        inputTokens: 3_020,
        outputTokens: 120,
        totalTokens: 3_140,
        reasoningTokens: 20,
        textTokens: 100,
      },
    ])

    expect(usage?.inputTokens).toBe(3_020)
    expect(usage?.outputTokens).toBe(120)
    expect(usage?.totalTokens).toBe(3_140)
    expect(usage?.outputTokenDetails.textTokens).toBe(100)
  })

  it('returns undefined when no assistant usage is persisted yet', () => {
    const usage = buildLatestAssistantUsage([
      {
        role: 'user',
      },
    ])

    expect(usage).toBeUndefined()
  })
})

describe('resolveCurrentContextTokens', () => {
  it('uses exact input and output text tokens when available', () => {
    expect(
      resolveCurrentContextTokens({
        inputTokens: 2_410,
        inputTokenDetails: {
          noCacheTokens: 1_847,
          cacheReadTokens: 563,
          cacheWriteTokens: 0,
        },
        outputTokens: 345,
        outputTokenDetails: {
          textTokens: 30,
          reasoningTokens: 315,
        },
        totalTokens: 2_755,
      }),
    ).toBe(2_440)
  })

  it('derives assistant text tokens from output minus reasoning when needed', () => {
    expect(
      resolveCurrentContextTokens({
        inputTokens: 1_000,
        inputTokenDetails: {
          noCacheTokens: 1_000,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokens: 80,
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: 30,
        },
        totalTokens: 1_080,
      }),
    ).toBe(1_050)
  })

  it('falls back to exact input tokens when output text tokens are unavailable', () => {
    expect(
      resolveCurrentContextTokens({
        inputTokens: 900,
        inputTokenDetails: {
          noCacheTokens: 900,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokens: 80,
        outputTokenDetails: {
          textTokens: undefined,
          reasoningTokens: undefined,
        },
        totalTokens: 980,
      }),
    ).toBe(900)
  })

  it('returns undefined when no persisted provider usage exists yet', () => {
    expect(resolveCurrentContextTokens()).toBeUndefined()
  })
})
