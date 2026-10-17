import {
  persistToolParts,
  rehydrateToolParts,
} from '@/lib/shared/chat-contracts/generation-parts'
import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import {
  compactDocumentHistory,
  documentReferenceFingerprint,
  documentReferenceFromChunk,
  documentReferencesFromParts,
} from './message-references'

describe('document history', () => {
  it('compacts write inputs and read outputs without replaying content', () => {
    const parts: UIMessage['parts'] = [
      {
        type: 'tool-create_document',
        toolCallId: 'a',
        state: 'output-available',
        input: { content: 'private long body' },
        output: { title: 'Plan', documentId: 'doc', version: 2 },
      },
      {
        type: 'tool-read_document',
        toolCallId: 'b',
        state: 'output-available',
        input: { documentId: 'doc' },
        output: {
          title: 'Plan',
          documentId: 'doc',
          version: 3,
          content: 'latest private body',
        },
      },
      {
        type: 'dynamic-tool',
        toolName: 'update_document',
        toolCallId: 'c',
        state: 'input-streaming',
        input: { content: 'partial body', documentId: 'doc' },
      },
    ]
    const result = compactDocumentHistory([
      { id: 'a', role: 'assistant', parts },
    ])
    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(/private|partial body/)
    expect(serialized).toContain('version 3')
    expect(serialized).toContain('Plan')
    expect(result[0].parts.every((part) => part.type === 'text')).toBe(true)
    expect(parts[0]).toHaveProperty('input.content', 'private long body')
  })
  it('stores compact successful write references and reconstructs cards', () => {
    const reference = documentReferenceFromChunk({
      type: 'tool-result',
      toolName: 'create_document',
      toolCallId: 'call',
      output: {
        documentId: 'doc',
        version: 1,
        title: 'Plan',
        content: 'never store',
      },
    })
    expect(reference).not.toHaveProperty('content')
    const stored = persistToolParts([
      {
        type: 'tool-create_document',
        toolCallId: 'call',
        state: 'output-available',
        input: { content: 'never store' },
        output: { documentId: 'doc', version: 1, title: 'Plan' },
      },
    ])
    expect(documentReferencesFromParts(stored)).toEqual([reference])
    expect(rehydrateToolParts(stored)[0]).toMatchObject({
      type: 'dynamic-tool',
      state: 'output-available',
      output: { documentId: 'doc', version: 1 },
    })
    expect(
      documentReferenceFromChunk({
        type: 'tool-result',
        toolName: 'read_document',
        output: { content: 'large' },
      }),
    ).toBeUndefined()
    expect(documentReferencesFromParts({ malformed: true })).toEqual([])
    expect(JSON.stringify(stored)).not.toContain('never store')
    expect(
      JSON.stringify(
        compactDocumentHistory([
          { id: 'a', role: 'assistant', parts: rehydrateToolParts(stored) },
        ]),
      ),
    ).toContain('version 1')
  })
  it('detects persisted cards independently of assistant text and large tool inputs', () => {
    const refs = [
      {
        documentId: 'doc',
        title: 'Plan',
        version: 1,
        toolName: 'create_document',
        toolCallId: 'call',
      },
    ]
    const parts = rehydrateToolParts(
      persistToolParts(
        refs.map((ref) => ({
          type: 'dynamic-tool',
          toolName: ref.toolName,
          toolCallId: ref.toolCallId,
          state: 'output-available',
          input: {},
          output: ref,
        })),
      ),
    )
    expect(documentReferenceFingerprint(parts)).not.toBe(
      documentReferenceFingerprint([{ type: 'text', text: 'Ready' }]),
    )
    expect(documentReferenceFingerprint(parts)).toContain('doc')
  })
})
