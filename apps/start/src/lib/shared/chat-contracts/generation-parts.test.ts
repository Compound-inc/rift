import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { boundedJson } from './bounded-json'
import {
  normalizeSources,
  persistToolParts,
  rehydrateToolParts,
} from './generation-parts'
import {
  hasNewStoredDisplay,
  messageDisplayFingerprint,
  storedMessageToUI,
} from './stored-message'

const tools: UIMessage['parts'] = [
  {
    type: 'tool-web_search',
    toolCallId: 'search-1',
    state: 'output-available',
    input: { query: 'Rift' },
    providerExecuted: true,
    output: {
      results: [
        {
          url: 'https://example.com/a',
          title: 'Example',
          content: 'PAGE'.repeat(100_000),
        },
      ],
    },
  },
  {
    type: 'dynamic-tool',
    toolName: 'code_execution',
    toolCallId: 'code-1',
    state: 'output-available',
    input: { code: 'print(2 + 2)' },
    output: { stdout: '4', stderr: '' },
    providerExecuted: true,
  },
  {
    type: 'tool-web_fetch',
    toolCallId: 'fetch-1',
    state: 'output-error',
    input: { url: 'https://example.com' },
    errorText: 'Timeout',
  },
]

describe('generation display persistence', () => {
  it('round-trips static/dynamic tools as bounded display records', () => {
    const persisted = persistToolParts(tools)
    expect(persisted[0]).toMatchObject({
      type: 'dynamic-tool',
      toolName: 'web_search',
      input: { query: 'Rift' },
      output: {
        siteCount: 1,
        sources: [{ url: 'https://example.com/a', title: 'Example' }],
      },
    })
    expect(JSON.stringify(persisted)).not.toContain('PAGE')
    expect(persisted[1]).toMatchObject({
      toolName: 'code_execution',
      output: { stdout: '4' },
    })
    expect(persisted[2]).toMatchObject({
      state: 'output-error',
      errorText: 'Timeout',
    })
    expect(rehydrateToolParts(JSON.parse(JSON.stringify(persisted)))).toEqual(
      persisted,
    )
  })

  it('bounds large outputs, aggregate payloads, partial calls, and malformed persisted records', () => {
    const large = persistToolParts(
      Array.from({ length: 1_000 }, (_, i) => ({
        type: 'dynamic-tool',
        toolName: 'code_execution',
        toolCallId: String(i),
        state: 'output-available',
        input: { code: 'x'.repeat(100_000) },
        output: { stdout: 'y'.repeat(100_000) },
      })),
    )
    expect(large.length).toBeLessThanOrEqual(64)
    expect(JSON.stringify(large).length).toBeLessThanOrEqual(131_074)
    expect(
      persistToolParts([
        {
          type: 'tool-web_search',
          toolCallId: 'partial',
          state: 'input-streaming',
          input: { query: 'abc' },
        },
      ])[0]?.state,
    ).toBe('input-available')
    expect(
      rehydrateToolParts([
        null,
        { type: 'dynamic-tool' },
        { ...tools[0], state: 'bogus' },
      ]),
    ).toEqual([])
  })

  it('normalizes legacy URL and v7 document sources and rejects unsafe URLs', () => {
    expect(
      normalizeSources([
        {
          sourceId: 'web',
          url: 'https://example.com/a',
          title: 'A',
          providerMetadata: { secret: 'drop' },
        },
        {
          type: 'source-document',
          sourceId: 'doc',
          mediaType: 'application/pdf',
          title: 'Manual',
          filename: 'manual.pdf',
        },
        { sourceId: 'web', url: 'https://example.com/duplicate' },
        { sourceId: 'bad', url: 'javascript:alert(1)' },
      ]),
    ).toEqual([
      {
        type: 'source-url',
        sourceId: 'web',
        url: 'https://example.com/a',
        title: 'A',
      },
      {
        type: 'source-document',
        sourceId: 'doc',
        mediaType: 'application/pdf',
        title: 'Manual',
        filename: 'manual.pdf',
      },
    ])
  })

  it('rehydrates reasoning, tools, text, sources and finish metadata without turning citations into uploads', () => {
    const row = {
      messageId: 'assistant-1',
      role: 'assistant' as const,
      content: 'Answer [1]',
      reasoning: 'Summary',
      model: 'openai/gpt-5-mini',
      sources: [
        { sourceId: '1', url: 'https://example.com/a', title: 'Example' },
      ],
      parts: persistToolParts(tools),
      finishReason: 'length',
    }
    const message = storedMessageToUI(row)
    expect(message.parts.map((part) => part.type)).toEqual([
      'reasoning',
      'dynamic-tool',
      'dynamic-tool',
      'dynamic-tool',
      'text',
      'source-url',
    ])
    expect(message.metadata).toMatchObject({
      model: row.model,
      finishReason: 'length',
    })
    expect(message.metadata?.attachments).toBeUndefined()
    expect(messageDisplayFingerprint(message)).not.toBe(
      messageDisplayFingerprint(
        storedMessageToUI({
          ...row,
          sources: [],
          parts: [],
          finishReason: undefined,
        }),
      ),
    )
  })

  it('adopts late tool results with unchanged text without dropping richer live metadata', () => {
    const row = {
      messageId: 'a',
      role: 'assistant' as const,
      content: 'Answer',
      model: 'm',
    }
    const partial = storedMessageToUI({
      ...row,
      parts: [
        {
          type: 'dynamic-tool',
          toolName: 'code_execution',
          toolCallId: 'c',
          state: 'input-available',
          input: { code: '2' },
        },
      ],
    })
    const complete = storedMessageToUI({
      ...row,
      parts: [
        {
          type: 'dynamic-tool',
          toolName: 'code_execution',
          toolCallId: 'c',
          state: 'output-available',
          input: { code: '2' },
          output: '2',
        },
      ],
      finishReason: 'length',
    })
    expect(hasNewStoredDisplay(partial, complete)).toBe(true)
    expect(hasNewStoredDisplay(complete, partial)).toBe(false)
    expect(hasNewStoredDisplay(complete, complete)).toBe(false)
  })

  it('preserves legacy user attachment manifests and accepts rows without new columns', () => {
    const message = storedMessageToUI({
      messageId: 'u',
      role: 'user',
      content: 'file',
      model: 'm',
      sources: [
        {
          sourceId: 'attachment-1',
          url: 'https://example.com/file.pdf',
          title: 'File',
        },
      ],
    })
    expect(message.parts).toEqual([{ type: 'text', text: 'file' }])
    expect(message.metadata?.attachments?.[0]?.id).toBe('attachment-1')
  })

  it('normalizes non-JSON provider metadata and cycles within a shared byte budget', () => {
    const value: Record<string, unknown> = {
      ok: 1,
      empty: undefined,
      bad: Infinity,
      large: 'x'.repeat(100_000),
    }
    value.self = value
    const result = boundedJson(value, 2_048)
    expect(result).toMatchObject({ ok: 1 })
    expect(JSON.stringify(result).length).toBeLessThan(2_048)
    expect(JSON.stringify(result)).not.toContain('self')
  })
})

it('deduplicates URL sources with different provider ids and URL spelling', () => {
  expect(normalizeSources([
    { sourceId: 'result-random-id', url: 'https://EXAMPLE.com:443/report#section' },
    { sourceId: 'citation-random-id', url: 'https://example.com/report' },
    { sourceId: 'distinct', url: 'https://example.com/other' },
  ])).toHaveLength(2)
})

it('does not emit NUL or orphan surrogates from bounded JSON and display truncation', () => {
  const bounded = boundedJson({ ['key\u0000']: 'a'.repeat(4094) + '😀' + '\u0000' })
  const serialized = JSON.stringify(bounded)
  expect(serialized).not.toMatch(/\\u(?:0000|d[89ab][0-9a-f]{2}|d[cdef][0-9a-f]{2})/i)
  const [part] = persistToolParts([{ type: 'dynamic-tool', toolCallId: 'x'.repeat(255) + '😀', toolName: '\udc00code\u0000', state: 'output-error', input: null, errorText: 'x'.repeat(1023) + '😀' }])
  expect(part.toolCallId).toBe('x'.repeat(255))
  expect(part.toolName).toBe('code')
  expect(part.errorText).toBe('x'.repeat(1023))
})

it('deduplicates before limiting sources to 128 distinct entries', () => {
  const duplicates = Array.from({ length: 200 }, (_, index) => ({
    sourceId: `duplicate-${index}`, url: 'https://example.com/same',
  }))
  const distinct = Array.from({ length: 140 }, (_, index) => ({
    sourceId: `distinct-${index}`, url: `https://example.com/${index}`,
  }))
  const sources = normalizeSources([...duplicates, ...distinct])
  expect(sources).toHaveLength(128)
  expect(sources[1].sourceId).toBe('distinct-0')
  expect(sources.at(-1)?.sourceId).toBe('distinct-126')
})

it('stores document references in shared parts and rehydrates cards without bodies', () => {
  const parts: UIMessage['parts'] = ['create_document', 'read_document', 'update_document'].map((toolName) => ({
    type: 'dynamic-tool', toolName, toolCallId: toolName,
    state: 'output-available',
    input: { documentId: 'doc', title: 'Plan', kind: 'code', language: 'ts', content: 'SECRET'.repeat(40_000) },
    output: { ok: true, documentId: 'doc', title: 'Plan', version: 2, content: 'SECRET'.repeat(40_000) },
  }))
  const persisted = persistToolParts(parts)
  expect(JSON.stringify(persisted)).not.toContain('SECRET')
  expect(persisted).toHaveLength(3)
  const message = storedMessageToUI({ messageId: 'assistant', role: 'assistant', model: 'model', content: 'Ready', parts: persisted })
  expect(message.parts.slice(0, 3)).toEqual(persisted)
  expect(persisted[0]).toMatchObject({ input: { kind: 'code', language: 'ts' }, output: { documentId: 'doc', version: 2 } })
})

it.each([10, 70])('reserves document cards after %i generic tool parts within both byte and part caps', (count) => {
  const generic: UIMessage['parts'] = Array.from({ length: count }, (_, index) => ({
    type: 'dynamic-tool', toolName: 'code_execution', toolCallId: `code-${index}`,
    state: 'output-available', input: { code: 'x'.repeat(count === 10 ? 15_000 : 1) },
    output: { stdout: 'y'.repeat(count === 10 ? 7_000 : 1) },
  }))
  const card: UIMessage['parts'][number] = { type: 'dynamic-tool', toolName: 'create_document', toolCallId: 'doc',
    state: 'output-available', input: { content: 'SECRET' }, output: { ok: true, documentId: 'doc', title: 'Report', version: 1 } }
  const persisted = persistToolParts([generic[0], card, ...generic.slice(1), { ...card, toolCallId: 'late-doc' }])
  expect(persisted.filter((part) => part.toolName === 'create_document').map((part) => part.toolCallId)).toEqual(['doc', 'late-doc'])
  expect(persisted[0].toolCallId).toBe('code-0')
  expect(persisted[1].toolCallId).toBe('doc')
  expect(persisted.at(-1)?.toolCallId).toBe('late-doc')
  expect(persisted.length).toBeLessThanOrEqual(64)
  expect(new TextEncoder().encode(JSON.stringify(persisted)).byteLength).toBeLessThanOrEqual(131_072)
  expect(rehydrateToolParts(persisted)).toEqual(persisted)
  expect(JSON.stringify(persisted)).not.toContain('SECRET')
})
