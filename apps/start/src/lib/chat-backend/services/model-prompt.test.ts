import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { sanitizeMessagesForModel } from './model-prompt'

describe('sanitizeMessagesForModel', () => {
  it('removes assistant reasoning parts before prompt conversion', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          { type: 'reasoning', text: 'private chain of thought', state: 'done' },
          { type: 'text', text: 'visible answer' },
        ],
      },
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'follow-up question' }],
      },
    ]

    expect(sanitizeMessagesForModel(messages)).toEqual([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'visible answer' }],
      },
      messages[1],
    ])
  })
})
