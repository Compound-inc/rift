// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react'
// @ts-expect-error jsdom types are not installed in this workspace test setup.
import { JSDOM } from 'jsdom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatProvider, useChat } from './chat-context'

type UseAIChatResult = {
  messages: unknown[]
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  error: Error | null
  sendMessage: ReturnType<typeof vi.fn>
  regenerate: ReturnType<typeof vi.fn>
  setMessages: ReturnType<typeof vi.fn>
  resumeStream: ReturnType<typeof vi.fn>
}

const navigateMock = vi.fn()
const zeroMutateMock = vi.fn(() => ({
  client: Promise.resolve(),
}))
const useQueryMock = vi.fn()
const sessions = new Map<string, UseAIChatResult>()
const queryState = {
  orgPolicyRow: undefined as unknown,
  threadRow: undefined as
    | {
        id: string
        threadId: string
        userId: string
        title: string
        createdAt: number
        updatedAt: number
        lastMessageAt: number
        generationStatus: 'idle' | 'pending' | 'generation' | 'failed'
        model: string
        pinned: boolean
        activeChildByParent?: Record<string, string>
        branchVersion: number
        ownerOrgId: string
        reasoningEffort?: string | null
        disabledToolKeys?: readonly string[] | null
        contextWindowMode?: 'standard' | 'max'
      }
    | undefined,
  storedMessages: [] as Array<{
    messageId: string
    role: 'user' | 'assistant' | 'system'
    parentMessageId?: string
    branchIndex: number
    created_at: number
    content: string
    reasoning?: string | null
    model: string
  }>,
}
const useAIChatMock = vi.fn((input: { id: string }) => {
  const existing = sessions.get(input.id)
  if (existing) return existing

  const created: UseAIChatResult = {
    messages: [],
    status: 'ready',
    error: null,
    sendMessage: vi.fn(async () => undefined),
    regenerate: vi.fn(async () => undefined),
    setMessages: vi.fn(),
    resumeStream: vi.fn(async () => undefined),
  }
  sessions.set(input.id, created)
  return created
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { __type?: string; args?: Record<string, unknown> }) =>
    useQueryMock(query),
  useZero: () => ({
    mutate: zeroMutateMock,
  }),
}))

vi.mock('@ai-sdk/react', () => ({
  useChat: (input: { id: string }) => useAIChatMock(input),
}))

vi.mock('./thread-status-store', () => ({
  subscribeThreadStatuses: () => () => undefined,
  getThreadStatusesVersion: () => 0,
  getThreadGenerationStatus: () => undefined,
  setThreadGenerationStatus: vi.fn(),
}))

vi.mock('@/lib/frontend/auth/use-auth', () => ({
  useAppAuth: () => ({
    isAnonymous: false,
    activeOrganizationId: '__missing_org__',
  }),
}))

vi.mock('@/lib/frontend/billing/use-org-billing', () => ({
  useOrgBillingSummary: () => ({
    entitlement: {
      planId: 'free',
    },
  }),
}))

vi.mock('@/lib/frontend/auth/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: null,
      error: null,
      isPending: false,
    }),
  },
}))

vi.mock('@/integrations/zero', () => ({
  queries: {
    orgPolicy: {
      current: () => ({ __type: 'orgPolicy' }),
    },
    threads: {
      byId: (args: Record<string, unknown>) => ({ __type: 'threadById', args }),
    },
    messages: {
      byThread: (args: Record<string, unknown>) => ({
        __type: 'messagesByThread',
        args,
      }),
    },
  },
  mutators: {
    threads: {
      selectBranchChild: (args: Record<string, unknown>) => ({
        __mutator: 'selectBranchChild',
        args,
      }),
      activateBranchPath: (args: Record<string, unknown>) => ({
        __mutator: 'activateBranchPath',
        args,
      }),
      setMode: (args: Record<string, unknown>) => ({
        __mutator: 'setMode',
        args,
      }),
      setDisabledToolKeys: (args: Record<string, unknown>) => ({
        __mutator: 'setDisabledToolKeys',
        args,
      }),
      setContextWindowMode: (args: Record<string, unknown>) => ({
        __mutator: 'setContextWindowMode',
        args,
      }),
    },
  },
}))

function Consumer() {
  const { sendMessage } = useChat()
  return (
    <button
      type="button"
      onClick={() => {
        void sendMessage({ text: 'hello' } as never)
      }}
    >
      send
    </button>
  )
}

function RegenerateConsumer({ messageId }: { messageId: string }) {
  const { regenerateMessage } = useChat()
  return (
    <button
      type="button"
      onClick={() => {
        void regenerateMessage(messageId)
      }}
    >
      regen
    </button>
  )
}

function BranchSwitchConsumer() {
  const { selectBranchVersion } = useChat()
  return (
    <button
      type="button"
      onClick={() => {
        void selectBranchVersion({
          parentMessageId: 'u2',
          childMessageId: 'a2',
        })
      }}
    >
      switch
    </button>
  )
}

function EditConsumer({
  messageId,
  editedText,
}: {
  messageId: string
  editedText: string
}) {
  const { editMessage } = useChat()
  return (
    <button
      type="button"
      onClick={() => {
        void editMessage({ messageId, editedText })
      }}
    >
      edit
    </button>
  )
}

function RevealBranchConsumer({ messageId }: { messageId: string }) {
  const { revealMessageBranch, branchSelectorsByAnchorMessageId } = useChat()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void revealMessageBranch({ messageId })
        }}
      >
        reveal
      </button>
      <output data-testid="selectors">
        {JSON.stringify(branchSelectorsByAnchorMessageId)}
      </output>
    </>
  )
}

function ContextWindowModeConsumer() {
  const { selectedContextWindowMode, setSelectedContextWindowMode } = useChat()
  return (
    <>
      <output data-testid="context-mode">{selectedContextWindowMode}</output>
      <button
        type="button"
        onClick={() => {
          void setSelectedContextWindowMode('standard')
        }}
      >
        standard
      </button>
      <button
        type="button"
        onClick={() => {
          void setSelectedContextWindowMode('max')
        }}
      >
        max
      </button>
    </>
  )
}

describe('ChatProvider', () => {
  const mockedThreadId = '00000000-0000-0000-0000-000000000001'
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>')
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      CustomEvent: dom.window.CustomEvent,
    })
    sessions.clear()
    useAIChatMock.mockClear()
    navigateMock.mockClear()
    zeroMutateMock.mockClear()
    useQueryMock.mockImplementation(
      (query: { __type?: string; args?: Record<string, unknown> }) => {
        if (query?.__type === 'orgPolicy') {
          return [queryState.orgPolicyRow, { type: 'complete' as const }]
        }
        if (query?.__type === 'threadById') {
          const threadId = query.args?.threadId
          return [
            queryState.threadRow?.threadId === threadId
              ? queryState.threadRow
              : undefined,
            { type: 'complete' as const },
          ]
        }
        if (query?.__type === 'messagesByThread') {
          const threadId = query.args?.threadId
          return [
            queryState.threadRow?.threadId === threadId
              ? queryState.storedMessages
              : [],
            { type: 'complete' as const },
          ]
        }
        return [[], { type: 'complete' as const }]
      },
    )
    queryState.orgPolicyRow = undefined
    queryState.threadRow = undefined
    queryState.storedMessages = []
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockedThreadId)
  })

  it('uses the new thread session (not composer) for first message from /chat', async () => {
    const view = render(
      <ChatProvider threadId={undefined}>
        <Consumer />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'send' }))
    })

    const composer = sessions.get('chat-ui:composer')
    const newThread = sessions.get(`chat-ui:${mockedThreadId}`)

    expect(newThread?.sendMessage).toHaveBeenCalledTimes(1)
    expect(composer?.sendMessage).toHaveBeenCalledTimes(0)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/chat/$threadId',
      params: { threadId: mockedThreadId },
    })
  })

  it('keeps chat sessions isolated per thread when route threadId changes', async () => {
    const view = render(
      <ChatProvider threadId="thread-a">
        <Consumer />
      </ChatProvider>,
    )
    const { rerender } = view

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'send' }))
    })

    rerender(
      <ChatProvider threadId="thread-b">
        <Consumer />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'send' }))
    })

    expect(sessions.get('chat-ui:thread-a')?.sendMessage).toHaveBeenCalledTimes(
      1,
    )
    expect(sessions.get('chat-ui:thread-b')?.sendMessage).toHaveBeenCalledTimes(
      1,
    )
  })

  it('keeps assistant target row while truncating descendants before regenerate', async () => {
    const threadId = 'thread-regen'
    const sessionId = `chat-ui:${threadId}`
    const session: UseAIChatResult = {
      messages: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'q1' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'a1' }] },
        { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'q2' }] },
        { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: 'a2' }] },
        { id: 'u3', role: 'user', parts: [{ type: 'text', text: 'q3' }] },
      ],
      status: 'ready',
      error: null,
      sendMessage: vi.fn(async () => undefined),
      regenerate: vi.fn(async () => undefined),
      setMessages: vi.fn(),
      resumeStream: vi.fn(async () => undefined),
    }
    sessions.set(sessionId, session)

    const view = render(
      <ChatProvider threadId={threadId}>
        <RegenerateConsumer messageId="a2" />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'regen' }))
    })

    const truncatedHistory = session.messages.slice(0, 4)
    const didTruncateAtAnchor = session.setMessages.mock.calls.some(
      ([candidate]) =>
        JSON.stringify(candidate) === JSON.stringify(truncatedHistory),
    )
    expect(didTruncateAtAnchor).toBe(true)
    expect(session.regenerate).toHaveBeenCalledTimes(1)
    expect(session.regenerate).toHaveBeenCalledWith({ messageId: 'a2' })
  })

  it('ignores branch switching requests while streaming', async () => {
    const threadId = 'thread-streaming'
    sessions.set(`chat-ui:${threadId}`, {
      messages: [],
      status: 'streaming',
      error: null,
      sendMessage: vi.fn(async () => undefined),
      regenerate: vi.fn(async () => undefined),
      setMessages: vi.fn(),
      resumeStream: vi.fn(async () => undefined),
    })

    const view = render(
      <ChatProvider threadId={threadId}>
        <BranchSwitchConsumer />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'switch' }))
    })

    expect(zeroMutateMock).not.toHaveBeenCalled()
  })

  it('routes user edits through regenerate with edit trigger payload', async () => {
    const threadId = 'thread-edit'
    const sessionId = `chat-ui:${threadId}`
    const session: UseAIChatResult = {
      messages: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'original' }] },
        {
          id: 'a1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'answer' }],
        },
      ],
      status: 'ready',
      error: null,
      sendMessage: vi.fn(async () => undefined),
      regenerate: vi.fn(async () => undefined),
      setMessages: vi.fn(),
      resumeStream: vi.fn(async () => undefined),
    }
    sessions.set(sessionId, session)

    useAIChatMock.mockClear()

    const view = render(
      <ChatProvider threadId={threadId}>
        <EditConsumer messageId="u1" editedText="edited question" />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'edit' }))
    })

    expect(session.regenerate).toHaveBeenCalledTimes(1)
    expect(session.regenerate).toHaveBeenCalledWith({
      messageId: 'u1',
      body: {
        trigger: 'edit-message',
        messageId: 'u1',
        editedText: 'edited question',
      },
    })
  })

  it('reveals a hidden nested branch through the batched branch-path mutator and keeps selectors visible', async () => {
    const threadId = 'thread-hidden-branch'
    queryState.threadRow = {
      id: 'thread-row-1',
      threadId,
      userId: 'user-1',
      title: 'Thread',
      createdAt: 1,
      updatedAt: 10,
      lastMessageAt: 10,
      generationStatus: 'idle',
      model: 'gpt-test',
      pinned: false,
      activeChildByParent: {
        u1: 'a1',
        a1: 'u2',
        u2: 'a2-v1',
      },
      branchVersion: 3,
      ownerOrgId: '__missing_org__',
      disabledToolKeys: [],
      contextWindowMode: 'max',
    }
    queryState.storedMessages = [
      {
        messageId: 'u1',
        role: 'user',
        branchIndex: 1,
        created_at: 1,
        content: 'root',
        model: 'gpt-test',
      },
      {
        messageId: 'a1',
        role: 'assistant',
        parentMessageId: 'u1',
        branchIndex: 1,
        created_at: 2,
        content: 'answer',
        model: 'gpt-test',
      },
      {
        messageId: 'u2',
        role: 'user',
        parentMessageId: 'a1',
        branchIndex: 1,
        created_at: 3,
        content: 'branch here',
        model: 'gpt-test',
      },
      {
        messageId: 'a2-v1',
        role: 'assistant',
        parentMessageId: 'u2',
        branchIndex: 1,
        created_at: 4,
        content: 'visible branch',
        model: 'gpt-test',
      },
      {
        messageId: 'a2-v2',
        role: 'assistant',
        parentMessageId: 'u2',
        branchIndex: 2,
        created_at: 5,
        content: 'hidden branch',
        model: 'gpt-test',
      },
      {
        messageId: 'u3-v2',
        role: 'user',
        parentMessageId: 'a2-v2',
        branchIndex: 1,
        created_at: 6,
        content: 'deep follow up',
        model: 'gpt-test',
      },
      {
        messageId: 'a3-v2a',
        role: 'assistant',
        parentMessageId: 'u3-v2',
        branchIndex: 1,
        created_at: 7,
        content: 'nested one',
        model: 'gpt-test',
      },
      {
        messageId: 'a3-v2b',
        role: 'assistant',
        parentMessageId: 'u3-v2',
        branchIndex: 2,
        created_at: 8,
        content: 'search target',
        model: 'gpt-test',
      },
    ]

    const session: UseAIChatResult = {
      messages: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'root' }] },
        {
          id: 'a1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'answer' }],
        },
        {
          id: 'u2',
          role: 'user',
          parts: [{ type: 'text', text: 'branch here' }],
        },
        {
          id: 'a2-v1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'visible branch' }],
        },
      ],
      status: 'ready',
      error: null,
      sendMessage: vi.fn(async () => undefined),
      regenerate: vi.fn(async () => undefined),
      setMessages: vi.fn(),
      resumeStream: vi.fn(async () => undefined),
    }
    sessions.set(`chat-ui:${threadId}`, session)

    const view = render(
      <ChatProvider threadId={threadId}>
        <RevealBranchConsumer messageId="a3-v2b" />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'reveal' }))
    })

    expect(zeroMutateMock).toHaveBeenCalledWith({
      __mutator: 'activateBranchPath',
      args: {
        threadId,
        selections: [
          { parentMessageId: '__root__', childMessageId: 'u1' },
          { parentMessageId: 'u2', childMessageId: 'a2-v2' },
          { parentMessageId: 'a2-v2', childMessageId: 'u3-v2' },
          { parentMessageId: 'u3-v2', childMessageId: 'a3-v2b' },
        ],
        expectedBranchVersion: 3,
      },
    })

    const didPublishCanonicalSnapshot = session.setMessages.mock.calls.some(
      ([candidate]) =>
        JSON.stringify(
          (candidate as Array<{ id: string }>).map((message) => message.id),
        ) === JSON.stringify(['u1', 'a1', 'u2', 'a2-v2', 'u3-v2', 'a3-v2b']),
    )
    expect(didPublishCanonicalSnapshot).toBe(true)

    expect(view.getByTestId('selectors').textContent).toContain('"u2"')
    expect(view.getByTestId('selectors').textContent).toContain(
      '"selectedMessageId":"a2-v2"',
    )
    expect(view.getByTestId('selectors').textContent).toContain('"u3-v2"')
    expect(view.getByTestId('selectors').textContent).toContain(
      '"selectedMessageId":"a3-v2b"',
    )
  })

  it('hydrates persisted context mode and persists changes through the thread mutator', async () => {
    const threadId = 'thread-context-window'
    queryState.threadRow = {
      id: 'thread-context-row',
      threadId,
      userId: 'user-1',
      title: 'Thread',
      createdAt: 1,
      updatedAt: 2,
      lastMessageAt: 2,
      generationStatus: 'idle',
      model: 'anthropic/claude-opus-4.6',
      pinned: false,
      activeChildByParent: {},
      branchVersion: 1,
      ownerOrgId: '__missing_org__',
      disabledToolKeys: [],
      contextWindowMode: 'max',
    }

    const view = render(
      <ChatProvider threadId={threadId}>
        <ContextWindowModeConsumer />
      </ChatProvider>,
    )

    expect(view.getByTestId('context-mode').textContent).toBe('max')

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'standard' }))
    })

    expect(zeroMutateMock).toHaveBeenCalledWith({
      __mutator: 'setContextWindowMode',
      args: {
        threadId,
        contextWindowMode: 'standard',
      },
    })
  })

})
