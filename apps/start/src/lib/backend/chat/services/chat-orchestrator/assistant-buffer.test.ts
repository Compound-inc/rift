import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import {
  applyAssistantChunkDelta,
  hydrateAssistantBufferFromResponse,
  markAssistantStepBoundary,
} from './assistant-buffer'
import type { AssistantDeltaBuffer } from './assistant-buffer'

describe('assistant display buffer', () => {
  it('collects source parts, tool calls/results/errors and length before finalization', () => {
    const buffer: AssistantDeltaBuffer = { text: '', reasoning: '' }
    for (const chunk of [
      { type: 'text-delta', text: 'Partial' },
      { type: 'reasoning-delta', text: 'Reasoning' },
      {
        type: 'tool-call',
        toolCallId: 'search',
        toolName: 'web_search',
        input: { query: 'Q' },
        providerExecuted: true,
      },
      {
        type: 'tool-result',
        toolCallId: 'search',
        toolName: 'web_search',
        output: {
          results: [{ url: 'https://example.com/a', content: 'Page body' }],
        },
        providerExecuted: true,
      },
      {
        type: 'source',
        sourceType: 'url',
        id: 'web',
        url: 'https://example.com/a',
        title: 'Page',
      },
      {
        type: 'source',
        sourceType: 'document',
        id: 'doc',
        title: 'Manual',
        mediaType: 'application/pdf',
      },
      {
        type: 'tool-call',
        toolCallId: 'code',
        toolName: 'code_execution',
        input: { code: 'bad()' },
      },
      {
        type: 'tool-error',
        toolCallId: 'code',
        toolName: 'code_execution',
        error: new Error('Failed'),
      },
      { type: 'finish-step', finishReason: 'length' },
      { type: 'finish', finishReason: 'length' },
    ])
      applyAssistantChunkDelta(buffer, chunk)
    expect(buffer).toMatchObject({
      text: 'Partial',
      reasoning: 'Reasoning',
      finishReason: 'length',
    })
    expect(buffer.sources?.map((source) => source.type)).toEqual([
      'source-url',
      'source-document',
    ])
    expect(buffer.toolParts).toHaveLength(2)
    expect(buffer.toolParts?.[0]).toMatchObject({
      input: { query: 'Q' },
      state: 'output-available',
      output: { siteCount: 1 },
    })
    expect(buffer.toolParts?.[1]).toMatchObject({
      state: 'output-error',
      errorText: 'Failed',
    })
    expect(JSON.stringify(buffer)).not.toContain('Page body')
  })

  it('retains a tool whose input stream disconnects before a complete call', () => {
    const buffer: AssistantDeltaBuffer = { text: '', reasoning: '' }
    applyAssistantChunkDelta(buffer, {
      type: 'tool-input-start',
      id: 'partial',
      toolName: 'web_search',
      providerExecuted: true,
    })
    applyAssistantChunkDelta(buffer, {
      type: 'tool-input-delta',
      id: 'partial',
      delta: '{"query":"Rift',
    })
    expect(buffer.toolParts?.[0]).toMatchObject({
      toolName: 'web_search',
      toolCallId: 'partial',
      state: 'input-available',
      input: '{"query":"Rift',
      providerExecuted: true,
    })
    applyAssistantChunkDelta(buffer, {
      type: 'tool-call',
      toolCallId: 'partial',
      toolName: 'web_search',
      input: { query: 'Rift' },
    })
    expect(buffer.toolParts).toHaveLength(1)
    expect(buffer.toolParts?.[0]?.input).toEqual({ query: 'Rift' })
  })

  it('fills missed content and reconciles final tool state without losing partial activity', () => {
    const buffer: AssistantDeltaBuffer = { text: '', reasoning: '' }
    applyAssistantChunkDelta(buffer, {
      type: 'tool-call',
      toolCallId: 'unfinished',
      toolName: 'web_search',
      input: { query: 'Q' },
    })
    const response: UIMessage = {
      id: 'a',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'Thinking' },
        { type: 'text', text: 'Answer' },
        {
          type: 'dynamic-tool',
          toolName: 'code_execution',
          toolCallId: 'code',
          state: 'output-available',
          input: { code: '2' },
          output: '2',
        },
        { type: 'source-url', sourceId: 'web', url: 'https://example.com/a' },
      ],
    }
    hydrateAssistantBufferFromResponse(buffer, response)
    hydrateAssistantBufferFromResponse(buffer, response)
    expect(buffer.text).toBe('Answer')
    expect(buffer.reasoning).toBe('Thinking')
    expect(buffer.sources).toHaveLength(1)
    expect(buffer.toolParts).toHaveLength(2)
  })
})
describe('multi-step assistant buffer', () => {
  it('preserves every step and separates text part IDs', () => {
    const buffer = { text: '', reasoning: '' }
    for (const chunk of [
      { type: 'text-delta', id: 'step1', text: 'Let me ' },
      { type: 'text-delta', id: 'step1', text: 'draft.' },
      { type: 'tool-result', toolName: 'create_document', toolCallId: 'call', output: {} },
      { type: 'text-delta', id: 'step2', text: 'The plan is ready.' },
    ])
      applyAssistantChunkDelta(buffer, chunk)
    expect(buffer.text).toBe('Let me draft.\n\nThe plan is ready.')
  })
  it('separates steps when the provider reuses the same text ID', () => {
    const buffer = { text: '', reasoning: '' }
    applyAssistantChunkDelta(buffer, {
      type: 'text-delta',
      id: '0',
      text: 'First.',
    })
    markAssistantStepBoundary(buffer)
    applyAssistantChunkDelta(buffer, {
      type: 'text-delta',
      id: '0',
      text: 'Next.',
    })
    expect(buffer).toEqual({ text: 'First.\n\nNext.', reasoning: '' })
  })
  it('hydrates tool-loop text without joining words across steps', () => {
    const buffer = { text: '', reasoning: '' }
    hydrateAssistantBufferFromResponse(buffer, {
      id: 'a',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'First.' },
        { type: 'step-start' },
        { type: 'text', text: 'Done.' },
      ],
    })
    expect(buffer.text).toBe('First.\n\nDone.')
  })
})
