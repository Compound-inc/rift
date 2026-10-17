// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { DocumentPanel } from './document-panel'
import { publishDocumentPreview } from './document-preview-store'
import { m } from '@/paraglide/messages.js'

const state = vi.hoisted(() => ({
  documents: [
    { id: 'doc', title: 'Plan', kind: 'markdown', currentVersion: 2 },
  ],
  versions: [
    { version: 1, content: 'Original content' },
    { version: 2, content: 'Latest content' },
  ],
  close: vi.fn(),
  save: vi.fn(),
  setDraft: vi.fn(),
  guard: vi.fn(() => () => {}),
}))
vi.mock('@/integrations/zero', () => ({
  queries: {
    documents: {
      byThread: () => ({ kind: 'documents' }),
      version: (args: object) => ({ kind: 'version', ...args }),
    },
  },
  mutators: { documents: { save: (args: unknown) => args } },
}))
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: state.save }),
  useQuery: (query: { kind: string; version?: number }) => [
    query.kind === 'documents'
      ? state.documents
      : state.versions.find((row) => row.version === query.version),
    { type: 'complete' },
  ],
}))
vi.mock('@/components/layout/right-sidebar-context', () => ({
  useRightSidebar: () => ({
    close: state.close,
    registerCloseGuard: state.guard,
  }),
}))
vi.mock('../message-parts/renderers/assistant-text-part', () => ({
  AssistantTextPart: ({ text }: { text: string }) => <div>{text}</div>,
}))
vi.mock('../message-parts/components/code-block', () => ({
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>,
}))
vi.mock('../composer-draft-store', () => ({
  getComposerDraftValue: () => 'Please revise',
  setComposerDraft: state.setDraft,
}))

beforeEach(() => {
  state.close.mockClear()
  state.save
    .mockReset()
    .mockReturnValue({ server: Promise.resolve({ type: 'success' }) })
  state.setDraft.mockClear()
  publishDocumentPreview({
    callId: 'panel-call',
    documentId: 'doc',
    title: 'Plan',
    kind: 'markdown',
    threadId: 'thread',
    version: 2,
    writing: false,
    failed: false,
    creating: true,
  })
})
afterEach(cleanup)

describe('document panel interactions', () => {
  it('saves a user edit with the version captured when editing began', async () => {
    render(<DocumentPanel callId="panel-call" threadId="thread" />)
    fireEvent.click(screen.getByRole('button', { name: m.document_edit() }))
    fireEvent.change(
      screen.getByRole('textbox', { name: m.document_editor() }),
      { target: { value: 'User revision' } },
    )
    fireEvent.click(screen.getByRole('button', { name: m.document_save() }))
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        documentId: 'doc',
        threadId: 'thread',
        expectedVersion: 2,
        content: 'User revision',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  })
  it('retains the draft after a conflict and blocks the close action', async () => {
    state.save.mockReturnValue({ server: Promise.resolve({ type: 'error' }) })
    render(<DocumentPanel callId="panel-call" threadId="thread" />)
    fireEvent.click(screen.getByRole('button', { name: m.document_edit() }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Keep this draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.document_save() }))
    await screen.findByRole('alert')
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(
      'Keep this draft',
    )
    fireEvent.click(screen.getByRole('button', { name: m.document_close() }))
    expect(state.close).not.toHaveBeenCalled()
  })
  it('restores an earlier version by appending through the save mutator', async () => {
    render(<DocumentPanel callId="panel-call" threadId="thread" />)
    fireEvent.click(
      screen.getByRole('button', { name: m.document_previous_version() }),
    )
    expect(screen.getByText('Original content')).toBeTruthy()
    const edit = screen.getByRole('button', { name: m.document_edit() })
    expect(edit.hasAttribute('disabled')).toBe(true)
    fireEvent.click(edit)
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: m.document_restore() }))
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        documentId: 'doc',
        threadId: 'thread',
        expectedVersion: 2,
        content: 'Original content',
      }),
    )
  })
  it('routes a new streamed revision into a document already open from an earlier card', () => {
    render(<DocumentPanel callId="panel-call" threadId="thread" />)
    act(() =>
      publishDocumentPreview({
        callId: 'update-call',
        documentId: 'doc',
        title: 'Plan',
        kind: 'markdown',
        threadId: 'thread',
        content: 'Streaming revision',
        writing: true,
        failed: false,
        creating: false,
      }),
    )
    expect(screen.getByText('Streaming revision')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: m.document_edit() })
        .hasAttribute('disabled'),
    ).toBe(true)
  })
  it('quotes a selected passage into the existing composer draft', () => {
    render(<DocumentPanel callId="panel-call" threadId="thread" />)
    const content = screen.getByText('Latest content')
    const range = document.createRange()
    range.selectNodeContents(content)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    fireEvent.mouseUp(content)
    fireEvent.click(screen.getByRole('button', { name: m.document_ask() }))
    expect(state.setDraft).toHaveBeenCalledWith(
      'Please revise\n\n[Document "Plan" | doc | v2]\n> Latest content\n\n',
    )
    expect(state.close).toHaveBeenCalled()
  })
  it('keeps an open document connected after the preview cache reaches its bound', () => {
    render(<DocumentPanel callId="panel-call" threadId="thread" />)
    act(() => {
      for (let index = 0; index < 105; index++) publishDocumentPreview({ callId: `revision-${index}`, documentId: 'doc', title: 'Plan', kind: 'markdown', threadId: 'thread', content: `Revision ${index}`, writing: true, failed: false, creating: false })
    })
    expect(screen.getByText('Revision 104')).toBeTruthy()
  })

})
