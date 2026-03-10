import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import {
  estimatePromptTokens,
  estimatePromptTokensForMessage,
  estimateTokensFromText,
} from './prompt-usage'

describe('prompt-usage', () => {
  it('estimates text using the shared character heuristic', () => {
    expect(estimateTokensFromText('abcd')).toBe(1)
    expect(estimateTokensFromText('abcdefgh')).toBe(2)
  })

  it('counts resendable text instead of historical assistant totals', () => {
    const assistant: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'short answer' }],
      metadata: { totalTokens: 48_000 },
    }

    expect(estimatePromptTokensForMessage(assistant)).toBeLessThan(10)
  })

  it('sums the current prompt footprint across the thread', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello there' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'general kenobi' }],
        metadata: { totalTokens: 50_000 },
      },
    ]

    expect(estimatePromptTokens(messages)).toBe(
      estimatePromptTokensForMessage(messages[0]!) + estimatePromptTokensForMessage(messages[1]!),
    )
  })
})
