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
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useChat as useAIChat } from '@ai-sdk/react'
import { useQuery } from '@rocicorp/zero/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { flushSync } from 'react-dom'
import { queries } from '@/integrations/zero'
import { CACHE_CHAT_NAV } from '@/integrations/zero/query-cache-policy'
import type { ChatMessageMetadata } from '@/lib/chat-contracts/message-metadata'
import {
  getThreadGenerationStatus,
  getThreadStatusesVersion,
  subscribeThreadStatuses,
} from './thread-status-store'

type ChatUIMessage = UIMessage<ChatMessageMetadata>

type ChatContextValue = Pick<
  ReturnType<typeof useAIChat<ChatUIMessage>>,
  'messages' | 'status' | 'error' | 'setMessages' | 'resumeStream'
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

function textFromUIMessage(message: ChatUIMessage): string {
  return message.parts
    .filter(
      (
        part,
      ): part is Extract<typeof part, { type: 'text'; text: string }> =>
        part.type === 'text' && typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('')
}

function fingerprintMessages(messages: readonly ChatUIMessage[]): string {
  return messages
    .map((message) => `${message.id}:${message.role}:${textFromUIMessage(message)}`)
    .join('\u0001')
}

function mergeStoredMessagesWithLocal(
  localMessages: readonly ChatUIMessage[],
  storedMessages: readonly ChatUIMessage[],
): ChatUIMessage[] {
  const localById = new Map(localMessages.map((message) => [message.id, message]))

  return storedMessages.map((storedMessage) => {
    const localMessage = localById.get(storedMessage.id)
    if (!localMessage) return storedMessage
    if (localMessage.role !== storedMessage.role) return storedMessage

    const storedText = textFromUIMessage(storedMessage)
    const localText = textFromUIMessage(localMessage)

    // Keep whichever assistant payload is more complete to avoid text regressions
    // when Zero snapshots momentarily lag behind streamed UI state.
    if (storedMessage.role === 'assistant' && localText.length > storedText.length) {
      return localMessage
    }

    return storedMessage
  })
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
  const previousThreadIdRef = useRef<string | undefined>(threadId)
  const resumeAttemptedThreadIdRef = useRef<string | undefined>(undefined)
  // Prevents duplicate thread creation during quick repeated submissions.
  const inFlightThreadRef = useRef<Promise<string> | null>(null)
  // First send after optimistic creation can ask server to create-if-missing.
  const createIfMissingRef = useRef(false)
  const [provisionalThreadId, setProvisionalThreadId] = useState<
    string | undefined
  >(undefined)
  const [localError, setLocalError] = useState<Error | null>(null)
  const activeThreadId = threadId ?? provisionalThreadId
  const [storedMessages, storedMessagesResult] = useQuery(
    queries.messages.byThread({ threadId: activeThreadId ?? '' }),
    CACHE_CHAT_NAV,
  )
  const threadStatusesVersion = useSyncExternalStore(
    subscribeThreadStatuses,
    getThreadStatusesVersion,
    getThreadStatusesVersion,
  )
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        credentials: 'include',
        prepareReconnectToStreamRequest: () => ({
          api: threadIdRef.current
            ? `/api/chat?threadId=${encodeURIComponent(threadIdRef.current)}`
            : '/api/chat',
          credentials: 'include',
        }),
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
    setMessages,
    resumeStream,
  } = useAIChat<ChatUIMessage>({
    id: activeThreadId ? `chat-ui:${activeThreadId}` : 'chat-ui:composer',
    transport,
  })
  const sendAIMessageRef = useRef(sendAIMessage)
  sendAIMessageRef.current = sendAIMessage

  useEffect(() => {
    threadIdRef.current = activeThreadId
    const previousThreadId = previousThreadIdRef.current

    // Reset ephemeral UI state when the route switches to a different thread.
    if (activeThreadId !== previousThreadId) {
      const shouldPreserveDuringFirstSendTransition =
        !previousThreadId &&
        !!activeThreadId &&
        (status === 'submitted' || status === 'streaming')

      if (!shouldPreserveDuringFirstSendTransition) {
        setMessages([])
      }
      setLocalError(null)
      resumeAttemptedThreadIdRef.current = undefined
    }

    if (!activeThreadId) {
      createIfMissingRef.current = false
      previousThreadIdRef.current = activeThreadId
      return
    }

    previousThreadIdRef.current = activeThreadId
    if (threadId && provisionalThreadId === threadId) {
      setProvisionalThreadId(undefined)
    }
  }, [activeThreadId, provisionalThreadId, setMessages, status, threadId])

  useEffect(() => {
    if (!activeThreadId) return
    if (status === 'submitted' || status === 'streaming') return
    if (resumeAttemptedThreadIdRef.current === activeThreadId) return

    const generationStatus = getThreadGenerationStatus(activeThreadId)
    if (!generationStatus) return

    const shouldResume =
      generationStatus === 'pending' || generationStatus === 'generation'
    if (!shouldResume) return

    resumeAttemptedThreadIdRef.current = activeThreadId
    void resumeStream().catch(() => {
      // Resume is best-effort; fall back to Zero snapshot hydration.
    })
  }, [activeThreadId, threadStatusesVersion, status, resumeStream])

  useEffect(() => {
    if (!activeThreadId) return
    if (storedMessagesResult.type !== 'complete') return
    // Never clobber messages while a new answer is actively streaming.
    if (status === 'submitted' || status === 'streaming') return

    const nextMessages = mergeStoredMessagesWithLocal(
      messages,
      storedMessages.map(toUIMessageFromStoredMessage),
    )

    // Zero may return a completed but stale snapshot (for example, empty) while
    // optimistic/streaming messages are still only in local useChat state.
    if (messages.length > 0 && nextMessages.length < messages.length) return

    if (
      nextMessages.length === messages.length &&
      fingerprintMessages(nextMessages) === fingerprintMessages(messages)
    ) {
      return
    }

    setMessages(nextMessages)
  }, [
    activeThreadId,
    storedMessages,
    storedMessagesResult.type,
    status,
    messages,
    setMessages,
  ])

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
          flushSync(() => {
            setProvisionalThreadId(resolvedThreadId)
          })
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
        const result = await sendAIMessageRef.current(message, options)
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
    [navigate],
  )

  const clear = useCallback(() => setMessages([]), [setMessages])

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      status,
      error: localError ?? error,
      sendMessage,
      setMessages,
      resumeStream,
      clear,
    }),
    [messages, status, error, localError, sendMessage, setMessages, resumeStream, clear],
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
