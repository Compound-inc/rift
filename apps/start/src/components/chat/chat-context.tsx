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
import { AI_CATALOG } from '@/lib/ai-catalog'
import { getProviderToolDefinition } from '@/lib/ai-catalog/provider-tools'
import {
  canUseAdvancedProviderTools,
  canUseReasoningControls,
} from '@/lib/ai-feature-flags'
import { evaluateModelAvailability } from '@/lib/model-policy/policy-engine'
import type { ChatMessageMetadata } from '@/lib/chat-contracts/message-metadata'
import type { AiReasoningEffort } from '@/lib/ai-catalog/types'
import {
  getThreadGenerationStatus,
  getThreadStatusesVersion,
  subscribeThreadStatuses,
} from './thread-status-store'

type ChatUIMessage = UIMessage<ChatMessageMetadata>

type ChatModelOption = {
  readonly id: string
  readonly name: string
  readonly providerId: string
  readonly description: string
  readonly capabilities: {
    readonly supportsReasoning: boolean
    readonly supportsTools: boolean
    readonly supportsImageInput: boolean
    readonly supportsPdfInput: boolean
  }
  readonly reasoningEfforts: readonly AiReasoningEffort[]
  readonly defaultReasoningEffort?: AiReasoningEffort
  readonly visibleTools: readonly string[]
}

type ChatActionsContextValue = Pick<
  ReturnType<typeof useAIChat<ChatUIMessage>>,
  'status' | 'error' | 'setMessages' | 'resumeStream'
> & {
  sendMessage: ReturnType<typeof useAIChat<ChatUIMessage>>['sendMessage']
  selectedModelId: string
  selectedReasoningEffort?: AiReasoningEffort
  selectableModels: readonly ChatModelOption[]
  setSelectedModelId: (modelId: string) => void
  setSelectedReasoningEffort: (reasoningEffort?: AiReasoningEffort) => void
  clear: () => void
}

type ChatMessagesContextValue = {
  messages: ChatUIMessage[]
  status: ReturnType<typeof useAIChat<ChatUIMessage>>['status']
  activeThreadId?: string
}

const ChatMessagesContext = createContext<ChatMessagesContextValue | null>(null)
const ChatActionsContext = createContext<ChatActionsContextValue | null>(null)

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
      (part): part is Extract<typeof part, { type: 'text'; text: string }> =>
        part.type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('')
}

function fingerprintMessages(messages: readonly ChatUIMessage[]): string {
  return messages
    .map(
      (message) =>
        `${message.id}:${message.role}:${textFromUIMessage(message)}`,
    )
    .join('\u0001')
}

function mergeStoredMessagesWithLocal(
  localMessages: readonly ChatUIMessage[],
  storedMessages: readonly ChatUIMessage[],
): ChatUIMessage[] {
  const localById = new Map(
    localMessages.map((message) => [message.id, message]),
  )

  return storedMessages.map((storedMessage) => {
    const localMessage = localById.get(storedMessage.id)
    if (!localMessage) return storedMessage
    if (localMessage.role !== storedMessage.role) return storedMessage

    const storedText = textFromUIMessage(storedMessage)
    const localText = textFromUIMessage(localMessage)

    // Preserve object identity when content is equivalent to avoid unnecessary row rerenders.
    if (localText === storedText) {
      return localMessage
    }

    // Keep whichever assistant payload is more complete to avoid text regressions
    // when Zero snapshots momentarily lag behind streamed UI state.
    if (
      storedMessage.role === 'assistant' &&
      localText.length > storedText.length
    ) {
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
  const [orgPolicyRow] = useQuery(queries.orgPolicy.current())
  const [threadRow] = useQuery(
    queries.threads.byId({ threadId: activeThreadId ?? '' }),
    CACHE_CHAT_NAV,
  )
  const [storedMessages, storedMessagesResult] = useQuery(
    queries.messages.byThread({ threadId: activeThreadId ?? '' }),
    CACHE_CHAT_NAV,
  )
  const selectableModels = useMemo<readonly ChatModelOption[]>(() => {
    const hasPolicyRow =
      !!orgPolicyRow &&
      typeof orgPolicyRow === 'object' &&
      'orgWorkosId' in orgPolicyRow &&
      typeof orgPolicyRow.orgWorkosId === 'string'
    const policy = hasPolicyRow
      ? {
          orgWorkosId: orgPolicyRow.orgWorkosId,
          disabledProviderIds:
            'disabledProviderIds' in orgPolicyRow &&
            Array.isArray(orgPolicyRow.disabledProviderIds)
              ? orgPolicyRow.disabledProviderIds
              : [],
          disabledModelIds:
            'disabledModelIds' in orgPolicyRow &&
            Array.isArray(orgPolicyRow.disabledModelIds)
              ? orgPolicyRow.disabledModelIds
              : [],
          complianceFlags:
            'complianceFlags' in orgPolicyRow &&
            typeof orgPolicyRow.complianceFlags === 'object' &&
            orgPolicyRow.complianceFlags
              ? (orgPolicyRow.complianceFlags as Record<string, boolean>)
              : {},
          updatedAt:
            'updatedAt' in orgPolicyRow &&
            typeof orgPolicyRow.updatedAt === 'number'
              ? orgPolicyRow.updatedAt
              : Date.now(),
        }
      : undefined

    return AI_CATALOG
      .filter((model) =>
        evaluateModelAvailability({
          model,
          policy,
        }).allowed,
      )
      .map((model) => ({
        id: model.id,
        name: model.name,
        providerId: model.providerId,
        description: model.description,
        capabilities: {
          supportsReasoning: model.capabilities.supportsReasoning,
          supportsTools: model.capabilities.supportsTools,
          supportsImageInput: model.capabilities.supportsImageInput,
          supportsPdfInput: model.capabilities.supportsPdfInput,
        },
        reasoningEfforts: canUseReasoningControls()
          ? model.reasoningEfforts
          : [],
        defaultReasoningEffort: canUseReasoningControls()
          ? model.defaultReasoningEffort
          : undefined,
        visibleTools: model.providerToolIds
          .map((toolId) => getProviderToolDefinition(model.providerId, toolId))
          .filter((tool) =>
            tool
              ? canUseAdvancedProviderTools() || !tool.advanced
              : false,
          )
          .map((tool) => tool!.name),
      }))
  }, [orgPolicyRow])
  const [selectedModelId, setSelectedModelId] = useState(
    selectableModels[0]?.id ?? AI_CATALOG[0]?.id ?? 'openai/gpt-4o-mini',
  )
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState<
    AiReasoningEffort | undefined
  >(undefined)
  const selectedModelIdRef = useRef(selectedModelId)
  const selectedReasoningEffortRef = useRef(selectedReasoningEffort)
  selectedModelIdRef.current = selectedModelId
  selectedReasoningEffortRef.current = selectedReasoningEffort
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
            modelId: selectedModelIdRef.current,
            reasoningEffort: selectedReasoningEffortRef.current,
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
    onError: (chatError) => {
      setLocalError(chatError)
    },
  })
  const sendAIMessageRef = useRef(sendAIMessage)
  sendAIMessageRef.current = sendAIMessage

  useEffect(() => {
    if (selectableModels.length === 0) return
    if (!selectableModels.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(selectableModels[0].id)
      setSelectedReasoningEffort(selectableModels[0].defaultReasoningEffort)
    }
  }, [selectableModels, selectedModelId])

  useEffect(() => {
    if (
      !threadRow ||
      typeof threadRow !== 'object' ||
      !('model' in threadRow) ||
      typeof threadRow.model !== 'string'
    ) {
      return
    }
    if (!selectableModels.some((model) => model.id === threadRow.model)) return

    setSelectedModelId(threadRow.model)
    setSelectedReasoningEffort(
      'reasoningEffort' in threadRow &&
        typeof threadRow.reasoningEffort === 'string'
        ? (threadRow.reasoningEffort as AiReasoningEffort)
        : undefined,
    )
  }, [threadRow, selectableModels])

  useEffect(() => {
    threadIdRef.current = activeThreadId
    const previousThreadId = previousThreadIdRef.current
    const hasStoredSnapshot = storedMessagesResult.type === 'complete'

    // Reset ephemeral UI state when the route switches to a different thread.
    if (activeThreadId !== previousThreadId) {
      const shouldPreserveDuringFirstSendTransition =
        !previousThreadId &&
        !!activeThreadId &&
        (status === 'submitted' || status === 'streaming')

      if (
        !shouldPreserveDuringFirstSendTransition &&
        (!activeThreadId || !hasStoredSnapshot)
      ) {
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
  }, [
    activeThreadId,
    provisionalThreadId,
    setMessages,
    status,
    storedMessagesResult.type,
    threadId,
  ])

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

  const sendMessage = useCallback<ChatActionsContextValue['sendMessage']>(
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
  const setModelSelection = useCallback((modelId: string) => {
    const nextModel = selectableModels.find((model) => model.id === modelId)
    if (!nextModel) return
    setSelectedModelId(nextModel.id)
    setSelectedReasoningEffort(nextModel.defaultReasoningEffort)
  }, [selectableModels])
  const setReasoningSelection = useCallback((reasoningEffort?: AiReasoningEffort) => {
    const model = selectableModels.find((entry) => entry.id === selectedModelId)
    if (!model) return
    if (!reasoningEffort) {
      setSelectedReasoningEffort(undefined)
      return
    }
    if (!model.reasoningEfforts.includes(reasoningEffort)) return
    setSelectedReasoningEffort(reasoningEffort)
  }, [selectableModels, selectedModelId])

  const messagesValue = useMemo<ChatMessagesContextValue>(
    () => ({
      messages,
      status,
      activeThreadId,
    }),
    [messages, status, activeThreadId],
  )

  const actionsValue = useMemo<ChatActionsContextValue>(
    () => ({
      status,
      error: localError ?? error,
      sendMessage,
      selectedModelId,
      selectedReasoningEffort,
      selectableModels,
      setSelectedModelId: setModelSelection,
      setSelectedReasoningEffort: setReasoningSelection,
      setMessages,
      resumeStream,
      clear,
    }),
    [
      status,
      error,
      localError,
      sendMessage,
      selectedModelId,
      selectedReasoningEffort,
      selectableModels,
      setModelSelection,
      setReasoningSelection,
      setMessages,
      resumeStream,
      clear,
    ],
  )

  return (
    <ChatMessagesContext.Provider value={messagesValue}>
      <ChatActionsContext.Provider value={actionsValue}>
        {children}
      </ChatActionsContext.Provider>
    </ChatMessagesContext.Provider>
  )
}

export function useChatMessages() {
  const ctx = useContext(ChatMessagesContext)
  if (!ctx) {
    throw new Error('useChatMessages must be used within ChatProvider')
  }
  return ctx
}

export function useChatActions() {
  const ctx = useContext(ChatActionsContext)
  if (!ctx) {
    throw new Error('useChatActions must be used within ChatProvider')
  }
  return ctx
}

export function useChat() {
  return {
    ...useChatMessages(),
    ...useChatActions(),
  }
}
