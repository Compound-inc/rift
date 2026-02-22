// Client-side chat state and transport wiring. Keeps server concerns out of React.
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useChat as useAIChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import type { ChatMessageMetadata } from '@/lib/chat-contracts/message-metadata'

type ChatUIMessage = UIMessage<ChatMessageMetadata>

type ChatContextValue = Pick<
  ReturnType<typeof useAIChat<ChatUIMessage>>,
  'messages' | 'status' | 'error' | 'stop' | 'setMessages'
> & {
  sendMessage: ReturnType<typeof useAIChat<ChatUIMessage>>['sendMessage']
  clear: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

// Bootstraps a server thread so the URL can be updated before streaming starts.
async function createServerThread(): Promise<string> {
  const response = await fetch('/api/chat/threads', {
    method: 'POST',
    credentials: 'include',
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
        ? payload.error.message
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
  // Mutable refs avoid stale values inside async callbacks owned by the transport hook.
  const threadIdRef = useRef<string | undefined>(threadId)
  // Prevents duplicate thread creation during quick repeated submissions.
  const inFlightThreadRef = useRef<Promise<string> | null>(null)
  const [localError, setLocalError] = useState<Error | null>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        credentials: 'include',
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
    setLocalError(null)
  }, [threadId, setMessages])

  const sendMessage = useCallback<ChatContextValue['sendMessage']>(
    async (message, options) => {
      let resolvedThreadId = threadIdRef.current
      if (!resolvedThreadId) {
        try {
          const inFlight =
            inFlightThreadRef.current ??
            createServerThread().finally(() => {
              inFlightThreadRef.current = null
            })
          inFlightThreadRef.current = inFlight

          resolvedThreadId = await inFlight
          threadIdRef.current = resolvedThreadId
          setLocalError(null)
          navigate({
            to: '/chat/$threadId',
            params: { threadId: resolvedThreadId },
          })
        } catch (threadCreateError) {
          setLocalError(
            threadCreateError instanceof Error
              ? threadCreateError
              : new Error('Failed to create thread'),
          )
          throw threadCreateError
        }
      }

      try {
        const result = await sendAIMessage(message, options)
        setLocalError(null)
        return result
      } catch (sendError) {
        setLocalError(
          sendError instanceof Error
            ? sendError
            : new Error('Failed to send message'),
        )
        throw sendError
      }
    },
    [navigate, sendAIMessage],
  )

  const clear = useCallback(() => setMessages([]), [setMessages])

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      status,
      error: localError ?? error,
      sendMessage,
      stop,
      setMessages,
      clear,
    }),
    [messages, status, error, localError, sendMessage, stop, setMessages, clear],
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
