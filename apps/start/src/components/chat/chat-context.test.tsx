// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatProvider, useChat } from './chat-context'

type UseAIChatResult = {
  messages: unknown[]
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  error: Error | null
  sendMessage: ReturnType<typeof vi.fn>
  setMessages: ReturnType<typeof vi.fn>
  resumeStream: ReturnType<typeof vi.fn>
}

const navigateMock = vi.fn()
const sessions = new Map<string, UseAIChatResult>()
const useAIChatMock = vi.fn((input: { id: string }) => {
  const existing = sessions.get(input.id)
  if (existing) return existing

  const created: UseAIChatResult = {
    messages: [],
    status: 'ready',
    error: null,
    sendMessage: vi.fn(async () => undefined),
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
  useQuery: () => [[], { type: 'complete' as const }],
}))

vi.mock('@ai-sdk/react', () => ({
  useChat: (input: { id: string }) => useAIChatMock(input),
}))

vi.mock('./thread-status-store', () => ({
  subscribeThreadStatuses: () => () => undefined,
  getThreadStatusesVersion: () => 0,
  getThreadGenerationStatus: () => undefined,
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

describe('ChatProvider', () => {
  const mockedThreadId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    sessions.clear()
    useAIChatMock.mockClear()
    navigateMock.mockClear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockedThreadId)
  })

  it('uses the new thread session (not composer) for first message from /chat', async () => {
    render(
      <ChatProvider threadId={undefined}>
        <Consumer />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
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
    const { rerender } = render(
      <ChatProvider threadId="thread-a">
        <Consumer />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
    })

    rerender(
      <ChatProvider threadId="thread-b">
        <Consumer />
      </ChatProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'send' }))
    })

    expect(sessions.get('chat-ui:thread-a')?.sendMessage).toHaveBeenCalledTimes(1)
    expect(sessions.get('chat-ui:thread-b')?.sendMessage).toHaveBeenCalledTimes(1)
  })
})
