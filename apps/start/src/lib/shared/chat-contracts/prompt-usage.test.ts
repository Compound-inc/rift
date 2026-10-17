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
      estimatePromptTokensForMessage(messages[0]) + estimatePromptTokensForMessage(messages[1]),
    )
  })
})

it('reserves tokens for dense scripts and native images without counting past reasoning', () => {
  expect(estimateTokensFromText('中文'.repeat(1000))).toBeGreaterThanOrEqual(2000)
  expect(estimatePromptTokensForMessage({ id: 'image', role: 'user', parts: [{ type: 'file', mediaType: 'image/png', url: 'https://files.example/image.png' }] })).toBeGreaterThanOrEqual(4096)
})

it('uses character estimates for Latin, CJK and mixed text across callers', () => {
  expect(estimateTokensFromText('café'.repeat(1000))).toBe(1000)
  expect(estimateTokensFromText('中'.repeat(120_000))).toBe(144_000)
  expect(estimateTokensFromText('abcd中文')).toBe(4)
  for (const text of ['hello'.repeat(100), '中文'.repeat(100), 'かなカナ한국어']) {
    expect(estimatePromptTokens([{ id: 'u', role: 'user', parts: [{ type: 'text', text }] }])).toBe(estimateTokensFromText(text))
  }
})
