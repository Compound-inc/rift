'use client'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { ChatStatus } from 'ai'
import { useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@rocicorp/zero/react'
import { SharedChatContextProvider } from '@/components/chat/chat-shared-context'
import { parseChatApiError } from '@/components/chat/chat-error-messages'
import type {
  ChatComposerContextValue,
  ChatMessageActionsContextValue,
  ChatMessagesContextValue,
  ChatModelOption,
} from '@/components/chat/chat-shared-context'
import { queries } from '@/integrations/zero'
import { createWritingChat } from '@/lib/frontend/writing'
import {
  EMPTY_AGENT_LIVE_TURN_STATE,
  readAgentLiveEvents,
  reduceAgentLiveTurnEvent,
} from '@/lib/shared/agent'
import type {
  AgentLiveTurnState,
  AgentMessagePart,
  AgentRenderableMessage,
} from '@/lib/shared/agent'
import { WRITING_DEFAULT_MODEL_ID } from '@/lib/shared/writing/constants'
import type {
  AiContextWindowMode,
  AiReasoningEffort,
} from '@/lib/shared/ai-catalog/types'
import type { ChatModeId } from '@/lib/shared/chat-modes'

type WritingChatProviderProps = {
  readonly projectId: string
  readonly initialConversationId?: string
  readonly children: ReactNode
}

type WritingChatContextValue = {
  readonly activeConversationId?: string
  readonly messages: readonly AgentRenderableMessage[]
  readonly liveTurn: AgentLiveTurnState
  readonly status: ChatStatus
  readonly error: Error | null
}

const WritingChatContext = createContext<WritingChatContextValue | null>(null)

function asMessageParts(value: unknown): readonly AgentMessagePart[] {
  return Array.isArray(value) ? (value as AgentMessagePart[]) : []
}

function toRenderableMessage(row: {
  readonly id: string
  readonly role: 'user' | 'assistant' | 'tool_result' | 'system'
  readonly status: ChatStatus
  readonly partsJson?: unknown
  readonly toolCallId?: string | null
  readonly toolName?: string | null
  readonly isError?: boolean | null
  readonly createdAt: number
}): AgentRenderableMessage {
  return {
    id: row.id,
    role: row.role,
    parts: asMessageParts(row.partsJson),
    status:
      row.status === 'submitted'
        ? 'streaming'
        : (row.status as AgentRenderableMessage['status']),
    createdAt: row.createdAt,
    toolCallId: row.toolCallId ?? undefined,
    toolName: row.toolName ?? undefined,
    isError: row.isError ?? undefined,
  }
}

function mergeRenderableMessages(input: {
  readonly persistedMessages: readonly AgentRenderableMessage[]
  readonly liveMessages: readonly AgentRenderableMessage[]
}): readonly AgentRenderableMessage[] {
  const merged = new Map<string, AgentRenderableMessage>()

  for (const message of input.persistedMessages) {
    merged.set(message.id, message)
  }
  for (const message of input.liveMessages) {
    merged.set(message.id, message)
  }

  return [...merged.values()].sort((left, right) => left.createdAt - right.createdAt)
}

function formatWritingModelLabel(modelId: string): string {
  const normalized = modelId.split('/').pop() ?? modelId
  return normalized
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export function WritingChatProvider({
  projectId,
  initialConversationId,
  children,
}: WritingChatProviderProps) {
  const navigate = useNavigate()
  const createChatFn = useServerFn(createWritingChat)
  const liveTurnRef = useRef<AgentLiveTurnState>(EMPTY_AGENT_LIVE_TURN_STATE)
  const [projectRows] = useQuery(queries.writing.projectById({ projectId }))
  const [conversations] = useQuery(
    queries.writing.conversationsByProject({ projectId }),
  )
  const project = Array.isArray(projectRows) ? projectRows[0] : projectRows
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    initialConversationId,
  )
  const [status, setStatus] = useState<ChatStatus>('ready')
  const [error, setError] = useState<Error | null>(null)
  const [liveTurn, setLiveTurn] = useState<AgentLiveTurnState>(
    EMPTY_AGENT_LIVE_TURN_STATE,
  )
  const [selectedModelId, setSelectedModelIdState] = useState<string>(
    WRITING_DEFAULT_MODEL_ID,
  )
  const [selectedReasoningEffort, setSelectedReasoningEffort] =
    useState<AiReasoningEffort>()

  useEffect(() => {
    const activeConversation = conversations.find(
      (conversation: any) => conversation.id === activeConversationId,
    )
    if (activeConversation?.defaultModelId) {
      setSelectedModelIdState(activeConversation.defaultModelId)
      return
    }

    if (
      project &&
      typeof project === 'object' &&
      'defaultConversationId' in project &&
      typeof project.defaultConversationId === 'string' &&
      project.defaultConversationId.length > 0
    ) {
      setSelectedModelIdState(WRITING_DEFAULT_MODEL_ID)
    }
  }, [activeConversationId, conversations, project])

  useEffect(() => {
    if (
      initialConversationId &&
      conversations.some((conversation: any) => conversation.id === initialConversationId)
    ) {
      setActiveConversationId(initialConversationId)
      return
    }

    const fallbackConversationId = conversations[0]?.id
    if (fallbackConversationId) {
      setActiveConversationId((current) => current ?? fallbackConversationId)
    } else if (!initialConversationId) {
      setActiveConversationId(undefined)
    }
  }, [conversations, initialConversationId])

  useEffect(() => {
    if (!activeConversationId) {
      return
    }

    void navigate({
      to: '/writing/projects/$projectId',
      params: { projectId },
      search: { conversationId: activeConversationId },
      replace: true,
    })
  }, [activeConversationId, navigate, projectId])

  useEffect(() => {
    liveTurnRef.current = liveTurn
  }, [liveTurn])

  useEffect(() => {
    if (liveTurn.conversationId === activeConversationId) {
      return
    }

    setLiveTurn(EMPTY_AGENT_LIVE_TURN_STATE)
    liveTurnRef.current = EMPTY_AGENT_LIVE_TURN_STATE
  }, [activeConversationId, liveTurn.conversationId])

  const [messageRows] = useQuery(
    queries.writing.messagesByConversation({
      conversationId: activeConversationId ?? '__none__',
    }),
  )

  const persistedMessages = useMemo(
    () =>
      messageRows.map((row: any) =>
        toRenderableMessage({
          id: row.id,
          role: row.role,
          status: row.status,
          partsJson: row.partsJson,
          toolCallId: row.toolCallId,
          toolName: row.toolName,
          isError: row.isError,
          createdAt: row.createdAt,
        }),
      ),
    [messageRows],
  )

  const messages = useMemo(
    () =>
      mergeRenderableMessages({
        persistedMessages,
        liveMessages:
          liveTurn.conversationId === activeConversationId ? liveTurn.messages : [],
      }),
    [activeConversationId, liveTurn.conversationId, liveTurn.messages, persistedMessages],
  )

  const modelOptions = useMemo<readonly ChatModelOption[]>(
    () => [
      {
        id: selectedModelId,
        name: formatWritingModelLabel(selectedModelId),
        reasoningEfforts: [],
        locked: false,
      },
    ],
    [selectedModelId],
  )

  const setSelectedModelId = useCallback((modelId: string) => {
    setSelectedModelIdState(modelId)
  }, [])

  const ensureActiveConversation = useCallback(async () => {
    if (activeConversationId) {
      return activeConversationId
    }

    const result = (await createChatFn({
      data: {
        projectId,
        modelId: selectedModelId,
      },
    })) as { conversationId: string }

    setActiveConversationId(result.conversationId)
    return result.conversationId
  }, [activeConversationId, createChatFn, projectId, selectedModelId])

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      setError(null)
      setStatus('submitted')

      try {
        const conversationId = await ensureActiveConversation()
        setLiveTurn(EMPTY_AGENT_LIVE_TURN_STATE)
        liveTurnRef.current = EMPTY_AGENT_LIVE_TURN_STATE

        const response = await fetch('/api/writing/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            conversationId,
            prompt: text,
            modelId: selectedModelId,
          }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => undefined)
          const parsed = parseChatApiError(payload)
          throw new Error(parsed?.message ?? 'Writing chat request failed')
        }

        const stream = response.body
        if (!stream) {
          throw new Error('Writing stream did not return a response body')
        }

        setStatus('streaming')
        let streamError: Error | null = null

        await readAgentLiveEvents({
          stream,
          onEvent: (event) => {
            setLiveTurn((current) => {
              const nextState = reduceAgentLiveTurnEvent(current, event)
              liveTurnRef.current = nextState
              if (nextState.status === 'failed' && nextState.errorMessage) {
                streamError = new Error(nextState.errorMessage)
              }
              return nextState
            })
          },
        })

        if (streamError) {
          throw streamError
        }
      } catch (caughtError) {
        const normalized =
          caughtError instanceof Error
            ? caughtError
            : new Error('Writing chat request failed')
        setError(normalized)
        throw normalized
      } finally {
        setStatus('ready')
      }
    },
    [ensureActiveConversation, projectId, selectedModelId],
  )

  const setSelectedContextWindowMode = useCallback(
    async (_contextWindowMode: AiContextWindowMode) => undefined,
    [],
  )

  const setSelectedModeId = useCallback(async (_modeId?: ChatModeId) => undefined, [])

  const setThreadDisabledToolKeys = useCallback(
    async (_disabledToolKeys: readonly string[]) => undefined,
    [],
  )

  const unsupportedMessageAction = useCallback(async () => {
    throw new Error('Writing message actions are not available')
  }, [])

  const revealMessageBranch = useCallback(async () => false, [])

  const messagesValue = useMemo<ChatMessagesContextValue>(
    () => ({
      messages: [],
      status,
      activeThreadId: activeConversationId,
      hasHydratedActiveThread: true,
      branchSelectorsByAnchorMessageId: {},
      latestAssistantUsage: undefined,
      branchCost: undefined,
      showBranchCost: false,
    }),
    [activeConversationId, status],
  )

  const composerValue = useMemo<ChatComposerContextValue>(
    () => ({
      sendMessage,
      status,
      error,
      activeThreadId: activeConversationId,
      selectedModelId,
      selectedReasoningEffort,
      selectedContextWindowMode: 'standard',
      selectableModels: modelOptions,
      visibleModels: modelOptions,
      setSelectedModelId,
      setSelectedReasoningEffort,
      setSelectedContextWindowMode,
      selectedModeId: undefined,
      isModeEnforced: false,
      setSelectedModeId,
      visibleTools: [],
      disabledToolKeys: [],
      setThreadDisabledToolKeys,
      activeContextWindow: 1_000_000,
      contextWindowSupportsMaxMode: false,
      canUploadFiles: false,
      uploadUpgradeCallout: undefined,
    }),
    [
      activeConversationId,
      error,
      modelOptions,
      selectedModelId,
      selectedReasoningEffort,
      sendMessage,
      setSelectedContextWindowMode,
      setSelectedModeId,
      setSelectedModelId,
      setThreadDisabledToolKeys,
      status,
    ],
  )

  const messageActionsValue = useMemo<ChatMessageActionsContextValue>(
    () => ({
      status,
      regenerateMessage: unsupportedMessageAction,
      editMessage: unsupportedMessageAction,
      selectBranchVersion: unsupportedMessageAction,
      revealMessageBranch,
    }),
    [revealMessageBranch, status, unsupportedMessageAction],
  )

  const writingValue = useMemo<WritingChatContextValue>(
    () => ({
      activeConversationId,
      messages,
      liveTurn,
      status,
      error,
    }),
    [activeConversationId, error, liveTurn, messages, status],
  )

  return (
    <WritingChatContext.Provider value={writingValue}>
      <SharedChatContextProvider
        messagesValue={messagesValue}
        composerValue={composerValue}
        messageActionsValue={messageActionsValue}
      >
        {children}
      </SharedChatContextProvider>
    </WritingChatContext.Provider>
  )
}

export function useWritingChat() {
  const value = use(WritingChatContext)
  if (!value) {
    throw new Error('useWritingChat must be used within WritingChatProvider')
  }

  return value
}
