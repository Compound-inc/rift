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
import { useQuery } from '@rocicorp/zero/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { queries } from '@/integrations/zero'
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

function toUIMessageFromStoredMessage(message: {
  readonly messageId: string
  readonly role: 'user' | 'assistant' | 'system'
  readonly content: string
  readonly model: string
}): ChatUIMessage {
  return {
    id: message.messageId,
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
    metadata:
      message.role === 'assistant'
        ? {
            model: message.model,
          }
        : undefined,
  }
}

const DEFAULT_THREAD_TITLE = 'Nuevo Chat'
const OPTIMISTIC_THREAD_CREATED_EVENT = 'chat:thread-created'

function emitOptimisticThreadCreated(threadId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(OPTIMISTIC_THREAD_CREATED_EVENT, {
      detail: {
        threadId,
        title: DEFAULT_THREAD_TITLE,
        createdAt: Date.now(),
      },
    }),
  )
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
  // First send after optimistic creation can ask server to create-if-missing.
  const createIfMissingRef = useRef(false)
  // Tracks which thread history has already been copied into useChat state.
  const hydratedThreadRef = useRef<string | undefined>(undefined)
  const [localError, setLocalError] = useState<Error | null>(null)
  const [storedMessages, storedMessagesResult] = useQuery(
    queries.messages.byThread({ threadId: threadId ?? '' }),
  )

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        credentials: 'include',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            threadId: threadIdRef.current,
            message: messages[messages.length - 1],
            createIfMissing: createIfMissingRef.current,
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

    // Reset ephemeral UI state when the route switches to a different thread.
    if (threadId !== hydratedThreadRef.current) {
      setMessages([])
    }

    if (!threadId) {
      createIfMissingRef.current = false
      hydratedThreadRef.current = undefined
      setMessages([])
    }
    setLocalError(null)
  }, [threadId, setMessages])

  useEffect(() => {
    if (!threadId) return
    if (hydratedThreadRef.current === threadId) return
    if (storedMessagesResult.type !== 'complete') return
    // Never clobber messages while a new answer is actively streaming.
    if (status === 'submitted' || status === 'streaming') return

    setMessages(storedMessages.map(toUIMessageFromStoredMessage))
    hydratedThreadRef.current = threadId
  }, [threadId, storedMessages, storedMessagesResult.type, status, setMessages])

  const sendMessage = useCallback<ChatContextValue['sendMessage']>(
    async (message, options) => {
      let resolvedThreadId = threadIdRef.current
      if (!resolvedThreadId) {
        try {
          const inFlight =
            inFlightThreadRef.current ??
            (async () => {
              const newThreadId = crypto.randomUUID()
              emitOptimisticThreadCreated(newThreadId)

              // Server can still create the same thread during first send if this
              // request has not yet created it in upstream Postgres.
              createIfMissingRef.current = true

              return newThreadId
            })().finally(() => {
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
        createIfMissingRef.current = false
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
