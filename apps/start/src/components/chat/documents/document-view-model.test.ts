import { describe, expect, it } from 'vitest'
import {
  buildDocumentReference,
  documentFilename,
  documentPreview,
  documentPanelView,
} from './document-view-model'

describe('document views', () => {
  it('handles partial streamed inputs, empty content and successful IDs', () => {
    expect(
      documentPreview(
        {
          type: 'tool-create_document',
          toolCallId: 'call',
          state: 'input-streaming',
          input: { content: '', title: 'Plan' },
        },
        'thread',
      ),
    ).toMatchObject({
      title: 'Plan',
      writing: true,
      content: '',
      documentId: undefined,
    })
    expect(
      documentPreview(
        {
          type: 'dynamic-tool',
          toolName: 'update_document',
          toolCallId: 'call',
          state: 'output-available',
          input: { documentId: 'doc' },
          output: { documentId: 'doc', version: 4, title: 'Plan' },
        },
        'thread',
      ),
    ).toMatchObject({
      title: 'Plan',
      documentId: 'doc',
      version: 4,
      creating: false,
      writing: false,
    })
    expect(
      documentPreview({ type: 'text', text: 'hello' }, 'thread'),
    ).toBeUndefined()
  })
  it('keeps failure state distinct from writing', () => {
    expect(
      documentPreview(
        {
          type: 'tool-update_document',
          toolCallId: 'call',
          state: 'output-error',
          input: { documentId: 'doc' },
          errorText: 'Failed',
        },
        'thread',
      ),
    ).toMatchObject({ failed: true, writing: false })
  })
  it('recognizes a structured tool failure and does not show rejected replacement content', () => {
    const preview = documentPreview(
      {
        type: 'tool-update_document',
        toolCallId: 'failed',
        state: 'output-available',
        input: { documentId: 'doc', content: 'Rejected rewrite' },
        output: {
          ok: false,
          error: { code: 'version_conflict', currentVersion: 3 },
        },
      },
      'thread',
    )
    expect(preview).toMatchObject({ failed: true, writing: false })
    expect(
      documentPanelView({ preview, versions: [], selectedVersion: null }),
    ).toMatchObject({ available: false, content: '' })
  })
  it('builds bounded multiline quoted selections with document and version', () => {
    expect(
      buildDocumentReference({
        documentId: 'doc',
        version: 3,
        title: 'Plan',
        passage: ' First\nSecond ',
      }),
    ).toBe('[Document "Plan" | doc | v3]\n> First\n> Second\n\n')
    expect(
      buildDocumentReference({
        documentId: 'doc',
        version: 1,
        title: 'Plan',
        passage: ' ',
      }),
    ).toBe('')
    expect(
      buildDocumentReference({
        documentId: 'doc',
        version: 1,
        title: 'Plan',
        passage: 'x'.repeat(9000),
      }).length,
    ).toBeLessThan(8100)
  })
  it('exports safe filenames with the language extension', () => {
    expect(documentFilename('../a/b', 'code', 'typescript')).toBe('..ab.ts')
    expect(documentFilename('Plan', 'markdown')).toBe('Plan.md')
    expect(documentFilename('Main', 'code', 'unknown')).toBe('Main.txt')
  })
})

describe('document panel state', () => {
  const preview = {
    callId: 'call',
    threadId: 'thread',
    documentId: 'doc',
    title: 'Plan',
    kind: 'markdown' as const,
    version: 2,
    content: 'new content',
    writing: false,
    failed: false,
    creating: false,
  }
  it('keeps the latest tool result visible while Zero catches up', () => {
    expect(
      documentPanelView({
        preview,
        document: { currentVersion: 1 },
        versions: [{ version: 1, content: 'old' }],
        selectedVersion: null,
      }),
    ).toMatchObject({
      version: 2,
      content: 'new content',
      available: true,
      canEdit: false,
    })
  })
  it('shows partial content live and blocks edits while the model writes', () => {
    expect(
      documentPanelView({
        preview: { ...preview, writing: true, content: 'partial' },
        document: { currentVersion: 2 },
        versions: [{ version: 2, content: 'stored' }],
        selectedVersion: null,
      }),
    ).toMatchObject({ writing: true, content: 'partial', canEdit: false })
  })
  it('shows an explicitly selected older version and never substitutes current content', () => {
    expect(
      documentPanelView({
        preview,
        document: { currentVersion: 2 },
        versions: [{ version: 1, content: 'original' }],
        selectedVersion: 1,
      }),
    ).toMatchObject({ version: 1, content: 'original', writing: false })
    expect(
      documentPanelView({ preview, versions: [], selectedVersion: 1 }),
    ).toMatchObject({ available: false, content: '' })
  })
})

it('renders rehydrated read_document metadata as a document card', () => {
  expect(
    documentPreview(
      {
        type: 'dynamic-tool',
        toolName: 'read_document',
        toolCallId: 'read',
        state: 'output-available',
        input: { documentId: 'doc' },
        output: {
          ok: true,
          documentId: 'doc',
          title: 'Source',
          version: 3,
          kind: 'code',
        },
      },
      'thread',
    ),
  ).toMatchObject({
    reading: true,
    documentId: 'doc',
    title: 'Source',
    version: 3,
    kind: 'code',
    writing: false,
  })
})
