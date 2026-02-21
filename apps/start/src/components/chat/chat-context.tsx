'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useChat as useAIChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import type { ChatMessageMetadata } from '@/lib/chat-backend'

type ChatUIMessage = UIMessage<ChatMessageMetadata>

type ChatContextValue = Pick<
  ReturnType<typeof useAIChat<ChatUIMessage>>,
  'messages' | 'status' | 'error' | 'stop' | 'setMessages'
> & {
  sendMessage: ReturnType<typeof useAIChat<ChatUIMessage>>['sendMessage']
  clear: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

async function createServerThread(): Promise<string> {
  const response = await fetch('/api/chat/threads', { method: 'POST' })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : payload &&
            typeof payload === 'object' &&
            'details' in payload &&
            payload.details &&
            typeof payload.details === 'object' &&
            'message' in payload.details
          ? String(payload.details.message)
        : 'Failed to create thread'

    throw new Error(message)
  }

  if (!payload || typeof payload !== 'object' || typeof payload.threadId !== 'string') {
    throw new Error('Invalid thread creation response')
  }

  return payload.threadId
}

export function ChatProvider({
  children,
  threadId,
}: {
  children: ReactNode
  threadId?: string
}) {
  const navigate = useNavigate()
  const threadIdRef = useRef<string | undefined>(threadId)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            threadId: threadIdRef.current,
            message: messages[messages.length - 1],
          },
        }),
      }),
    [],
  )

  const {
    messages,
    status,
    error,
    sendMessage: sendAIMessage,
    stop,
    setMessages,
  } = useAIChat<ChatUIMessage>({ transport })

  useEffect(() => {
    threadIdRef.current = threadId

    if (!threadId) {
      setMessages([])
    }
  }, [threadId, setMessages])

  const sendMessage = useCallback<ChatContextValue['sendMessage']>(
    async (message, options) => {
      let resolvedThreadId = threadIdRef.current
      if (!resolvedThreadId) {
        resolvedThreadId = await createServerThread()
        threadIdRef.current = resolvedThreadId
        navigate({
          to: '/chat/$threadId',
          params: { threadId: resolvedThreadId },
        })
      }

      return sendAIMessage(message, options)
    },
    [navigate, sendAIMessage],
  )

  const clear = useCallback(() => setMessages([]), [setMessages])

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      status,
      error,
      sendMessage,
      stop,
      setMessages,
      clear,
    }),
    [messages, status, error, sendMessage, stop, setMessages, clear],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return ctx
}
