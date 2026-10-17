import { describe, expect, it } from 'vitest'
import { resolveRetryTarget, shouldReplaceFailedResponse } from './retry'

describe('retry decisions', () => {
  it('replaces empty failures, preserving useful content and descendants', () => {
    const failure = { status: 'error', content: '' }
    expect(shouldReplaceFailedResponse(failure)).toBe(true)
    expect(
      shouldReplaceFailedResponse({ ...failure, content: 'partial' }),
    ).toBe(false)
    expect(
      shouldReplaceFailedResponse({ ...failure, reasoning: 'thought' }),
    ).toBe(false)
    expect(shouldReplaceFailedResponse(failure, true)).toBe(false)
    expect(shouldReplaceFailedResponse({ ...failure, inputTokens: 400 })).toBe(
      false,
    )
    expect(shouldReplaceFailedResponse({ ...failure, publicCost: 0.001 })).toBe(
      false,
    )
    expect(
      shouldReplaceFailedResponse({ ...failure, status: 'cancelled' }),
    ).toBe(false)
  })
  it('retries only the most recent turn with its original model', () => {
    const user = { messageId: 'user', role: 'user', model: 'original' }
    const failure = {
      messageId: 'failed',
      role: 'assistant',
      status: 'error',
      model: 'original',
    }
    expect(resolveRetryTarget([user, failure])).toEqual(failure)
    expect(resolveRetryTarget([user])).toEqual(user)
    const next = { ...user, messageId: 'next' }
    expect(resolveRetryTarget([user, failure, next])).toEqual(next)
    expect(resolveRetryTarget([])).toBeUndefined()
  })
})
