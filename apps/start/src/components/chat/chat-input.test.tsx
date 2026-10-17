// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import type { FormEventHandler, ReactNode, TextareaHTMLAttributes } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatInput } from './chat-input'
import { MessageGenerationStatus } from './message-generation-status'
import { m } from '@/paraglide/messages.js'
import {
  clearComposerDraft,
  getComposerDraftValue,
  setComposerDraft,
} from './composer-draft-store'

import { generationQueue } from './generation-queue-store'
import type { UIMessage } from 'ai'
import type { ChatMessageMetadata } from '@/lib/shared/chat-contracts/message-metadata'

const sendMessageMock = vi.fn(async () => undefined)
const addFilesMock = vi.fn()
const retryLastMessageMock = vi.fn(async () => undefined)
let composerStatus = 'ready'
let composerError: Error | null = null
let errorMessageId: string | undefined
let composerMessages: UIMessage<ChatMessageMetadata>[] = []
let uploadError: string | undefined
const { embeddingFlagState } = vi.hoisted(() => ({
  embeddingFlagState: {
    enabled: true,
  },
}))

vi.mock('./chat-context', () => ({
  useChatMessages: () => ({
    branchCost: 0,
    latestAssistantUsage: undefined,
    messages: composerMessages,
    showBranchCost: false,
  }),
  useChatComposer: () => ({
    sendMessage: sendMessageMock,
    status: composerStatus,
    stopGeneration: vi.fn(async () => undefined),
    retryLastMessage: retryLastMessageMock,
    canRetryLastMessage: true,
    error: composerError,
    errorMessageId,
    visibleModels: [],
    selectedModelId: 'test-model',
    selectedReasoningEffort: undefined,
    selectedContextWindowMode: 'standard',
    setSelectedModelId: vi.fn(),
    setSelectedReasoningEffort: vi.fn(),
    setSelectedContextWindowMode: vi.fn(async () => undefined),
    selectedModeId: undefined,
    isModeEnforced: false,
    setSelectedModeId: vi.fn(async () => undefined),
    visibleTools: [],
    disabledToolKeys: [],
    setThreadDisabledToolKeys: vi.fn(async () => undefined),
    activeThreadId: 'thread-1',
    activeContextWindow: 100_000,
    contextWindowSupportsMaxMode: true,
    canUploadFiles: true,
    uploadUpgradeCallout: undefined,
  }),
}))

vi.mock('./skills/skill-slash-host', () => ({
  SkillSlashHost: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/utils/app-feature-flags', () => ({
  get isEmbeddingFeatureEnabled() {
    return embeddingFlagState.enabled
  },
}))

vi.mock('./composer-bar', () => ({
  ModelSelectorPanel: () => null,
  ReasoningSelectorPanel: () => null,
  Context: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ContextContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ContextContentBody: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
  ContextContentFooter: () => null,
  ContextContentHeader: () => null,
  ContextInputUsage: () => null,
  ContextOutputUsage: () => null,
  ContextReasoningUsage: () => null,
  ContextCacheUsage: () => null,
  ContextTrigger: () => null,
}))

vi.mock('./prompt-input', () => ({
  PromptInputRoot: ({
    children,
    onSubmit,
    slots,
  }: {
    children: ReactNode
    onSubmit?: FormEventHandler<HTMLFormElement>
    slots?: { top?: ReactNode; bottom?: ReactNode }
  }) => (
    <form onSubmit={onSubmit}>
      {slots?.top}
      {children}
      {slots?.bottom}
    </form>
  ),
  PromptInputTextarea: ({
    value,
    onChange,
    onPaste,
    inputRef: _inputRef,
    onEscape: _onEscape,
    ...props
  }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
    inputRef?: unknown
    onEscape?: () => void
  }) => (
    <textarea value={value} onChange={onChange} onPaste={onPaste} {...props} />
  ),
  PromptInputToolbar: ({ middle }: { middle?: ReactNode }) => (
    <div>{middle}</div>
  ),
  PromptInputError: ({
    error,
    onRetry,
  }: {
    error: string
    onRetry?: () => void
  }) => (
    <div role="alert">
      {error}
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  ),
  PromptInputAttachments: () => null,
  PromptInputDropHint: () => null,
}))

vi.mock('../../hooks/chat/upload/use-file-attachments', () => ({
  useFileAttachments: () => ({
    files: uploadError ? [{ id: 'upload-1', uploadError }] : [],
    addFiles: addFilesMock,
    handleFileSelect: vi.fn(),
    handleFilesDrop: vi.fn(),
    handleRemoveFile: vi.fn(),
    clearFiles: vi.fn(),
    canAddMore: true,
    maxFiles: 10,
  }),
}))

describe('ChatInput paste-to-attachment behavior', () => {
  beforeEach(() => {
    addFilesMock.mockReset()
    embeddingFlagState.enabled = true
    clearComposerDraft()
    composerStatus = 'ready'
    composerError = null
    errorMessageId = undefined
    composerMessages = []
    sendMessageMock.mockClear()
    retryLastMessageMock.mockClear()
    uploadError = undefined
    generationQueue.clear('thread-1')
  })

  afterEach(() => {
    clearComposerDraft()
  })

  it.each([undefined, 'sdk-answer', 'failed-answer'])(
    'keeps only the inline failure when the transport message ID is %s',
    (transportMessageId) => {
      const failureMessage = m.error_chat_unknown()
      composerMessages = [
        {
          id: 'failed-answer',
          role: 'assistant',
          metadata: { status: 'error', errorMessage: failureMessage },
          parts: [],
        },
      ]
      composerError = new Error(failureMessage)
      errorMessageId = transportMessageId
      const regenerateMessage = vi.fn()
      const view = render(
        <>
          <MessageGenerationStatus
            messageId="failed-answer"
            status="error"
            errorMessage={failureMessage}
            canRetry
            onRetry={regenerateMessage}
          />
          <ChatInput />
        </>,
      )
      expect(view.getAllByRole('alert')).toHaveLength(1)
      fireEvent.click(view.getByRole('button', { name: 'Retry' }))
      expect(regenerateMessage).toHaveBeenCalledExactlyOnceWith('failed-answer')
      expect(retryLastMessageMock).not.toHaveBeenCalled()
    },
  )

  it('suppresses the matching default inline error without error metadata', () => {
    composerMessages = [
      {
        id: 'failed-answer',
        role: 'assistant',
        metadata: { status: 'error' },
        parts: [],
      },
    ]
    composerError = new Error(m.error_chat_unknown())
    expect(render(<ChatInput />).queryByRole('alert')).toBeNull()
  })

  it.each([
    { messages: [] },
    { messages: [{ id: 'user-turn', role: 'user' as const, parts: [] }] },
  ])(
    'shows a failure and retries the same turn without an assistant message: %j',
    ({ messages }) => {
      composerMessages = messages
      composerError = new Error('Provider request rejected')
      const view = render(<ChatInput />)
      expect(view.getByRole('alert').textContent).toContain(
        'Provider request rejected',
      )
      fireEvent.click(view.getByRole('button', { name: 'Retry' }))
      expect(retryLastMessageMock).toHaveBeenCalledOnce()
    },
  )

  it('keeps upload errors visible alongside an inline generation failure', () => {
    composerMessages = [
      {
        id: 'failed-answer',
        role: 'assistant',
        metadata: { status: 'error' },
        parts: [],
      },
    ]
    composerError = new Error(m.error_chat_unknown())
    errorMessageId = 'failed-answer'
    uploadError = 'Upload failed'
    const view = render(<ChatInput />)
    expect(view.getByRole('alert').textContent).toBe('Upload failed')
    expect(view.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('shows a new pre-send error after a failed assistant response', () => {
    composerMessages = [
      {
        id: 'failed-answer',
        role: 'assistant',
        metadata: { status: 'error' },
        parts: [],
      },
    ]
    composerError = new Error('The selected model is locked')
    const view = render(<ChatInput />)
    expect(view.getByRole('alert').textContent).toContain(
      'The selected model is locked',
    )
  })
  it('suppresses only the error associated with the failed message row', () => {
    composerMessages = [
      {
        id: 'failed-answer',
        role: 'assistant',
        metadata: { status: 'error' },
        parts: [],
      },
    ]
    composerError = new Error('Provider failed')
    errorMessageId = 'failed-answer'
    const view = render(<ChatInput />)
    expect(view.queryByRole('alert')).toBeNull()
    composerError = new Error('Uploads are disabled')
    errorMessageId = undefined
    view.rerender(<ChatInput />)
    expect(view.getByRole('alert').textContent).toContain(
      'Uploads are disabled',
    )
  })
  it('queues Enter submissions during generation without sending another turn', () => {
    composerStatus = 'streaming'
    setComposerDraft('send after this response')
    const view = render(<ChatInput />)
    fireEvent.submit(view.container.querySelector('form')!)
    expect(generationQueue.get('thread-1').items[0]?.text).toBe(
      'send after this response',
    )
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(getComposerDraftValue()).toBe('')
  })

  it('converts long plain-text paste into a synthetic txt file', () => {
    render(<ChatInput />)

    const textarea = screen.getByRole('textbox')
    const event = createClipboardPasteEvent({
      plainText: 'a'.repeat(2_000),
      types: ['text/plain'],
      items: [{ kind: 'string', type: 'text/plain' }],
    })

    fireEvent(textarea, event)

    expect(event.defaultPrevented).toBe(true)
    expect(addFilesMock).toHaveBeenCalledTimes(1)

    const [files] = addFilesMock.mock.calls[0] as [File[]]
    expect(files).toHaveLength(1)
    expect(files[0]).toBeInstanceOf(File)
    expect(files[0].name).toMatch(
      /^pasted-text-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.txt$/,
    )
    expect(files[0].type).toBe('text/plain;charset=utf-8')
    expect(getComposerDraftValue()).toBe('')
  })

  it('preserves normal paste behavior for short plain-text paste', () => {
    render(<ChatInput />)

    const textarea = screen.getByRole('textbox')
    const event = createClipboardPasteEvent({
      plainText: 'short paste',
      types: ['text/plain'],
      items: [{ kind: 'string', type: 'text/plain' }],
    })

    fireEvent(textarea, event)

    expect(event.defaultPrevented).toBe(false)
    expect(addFilesMock).not.toHaveBeenCalled()
  })

  it('does not convert clipboard file pastes into synthetic attachments', () => {
    render(<ChatInput />)

    const textarea = screen.getByRole('textbox')
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const event = createClipboardPasteEvent({
      plainText: 'a'.repeat(3_000),
      types: ['Files', 'text/plain'],
      files: [file],
      items: [{ kind: 'file', type: 'text/plain', getAsFile: () => file }],
    })

    fireEvent(textarea, event)

    expect(event.defaultPrevented).toBe(false)
    expect(addFilesMock).not.toHaveBeenCalled()
  })

  it('falls back to normal textarea paste when embeddings are disabled', () => {
    embeddingFlagState.enabled = false

    render(<ChatInput />)

    const textarea = screen.getByRole('textbox')
    const event = createClipboardPasteEvent({
      plainText: 'a'.repeat(3_000),
      types: ['text/plain'],
      items: [{ kind: 'string', type: 'text/plain' }],
    })

    fireEvent(textarea, event)

    expect(event.defaultPrevented).toBe(false)
    expect(addFilesMock).not.toHaveBeenCalled()
  })
})

function createClipboardPasteEvent({
  plainText,
  types,
  items,
  files = [],
}: {
  plainText: string
  types: string[]
  items: Array<{
    kind: string
    type: string
    getAsFile?: () => File | null
  }>
  files?: File[]
}) {
  const event = new Event('paste', {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent

  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => (type === 'text/plain' ? plainText : ''),
      types,
      items,
      files,
    },
  })

  return event
}
