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

// These records are provider-specific display history. A new model sees the
// answer/citations as text and cannot accidentally replay another provider's API.
it('drops tool calls, outputs, sources, and reasoning on provider switches while retaining user files', () => {
  const user: UIMessage = { id: 'u', role: 'user', parts: [{ type: 'text', text: '<document>Stable library</document> Question' }, { type: 'file', mediaType: 'application/pdf', url: 'https://example.com/manual.pdf' }] }
  const assistant: UIMessage = { id: 'a', role: 'assistant', parts: [
    { type: 'dynamic-tool', toolName: 'web_search', toolCallId: 'tool-1', state: 'output-available', input: { query: 'q' }, output: {}, providerExecuted: true },
    { type: 'tool-code_execution', toolCallId: 'tool-2', state: 'input-available', input: { code: '1' } },
    { type: 'reasoning', text: 'Hidden' },
    { type: 'text', text: 'Answer [[1]](https://example.com)' },
    { type: 'source-url', sourceId: '1', url: 'https://example.com' },
  ] }
  const sanitized = sanitizeMessagesForModel([user, assistant])
  expect(sanitized[0]).toBe(user)
  expect(sanitized[1].parts).toEqual([{ type: 'text', text: 'Answer [[1]](https://example.com)' }])
})

it('omits empty and tool-only assistant turns instead of sending invalid empty model messages', () => {
  expect(sanitizeMessagesForModel([
    { id: 'a', role: 'assistant', parts: [{ type: 'dynamic-tool', toolName: 'web_search', toolCallId: 's', state: 'input-available', input: {} }] },
    { id: 'b', role: 'assistant', parts: [{ type: 'text', text: '' }] },
  ])).toEqual([])
})
