'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { UIMessage } from 'ai'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@rocicorp/zero/react'
import { SharedChatContextProvider } from '@/components/chat/chat-shared-context'
import { queries } from '@/integrations/zero'
import { createWritingChat } from '@/lib/frontend/writing'
import { WRITING_DEFAULT_MODEL_ID } from '@/lib/shared/writing/constants'
import type {
  AiContextWindowMode,
  AiReasoningEffort,
} from '@/lib/shared/ai-catalog/types'
import { parseChatApiError } from '@/components/chat/chat-error-messages'
import type { ChatModeId } from '@/lib/shared/chat-modes'
import type {
  ChatComposerContextValue,
  ChatMessageActionsContextValue,
  ChatMessagesContextValue,
  ChatModelOption,
} from '@/components/chat/chat-shared-context'

type WritingMessageMetadata = {
  readonly model?: string
}

type WritingUIMessage = UIMessage<WritingMessageMetadata>

type WritingChatProviderProps = {
  readonly projectId: string
  readonly initialChatId?: string
  readonly children: ReactNode
}

function toWritingUiMessage(row: {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadataJson?: unknown
}): WritingUIMessage {
  const metadata =
    row.metadataJson && typeof row.metadataJson === 'object'
      ? (row.metadataJson as WritingMessageMetadata)
      : undefined

  return {
    id: row.id,
    role: row.role,
    parts: [
      {
        type: 'text',
        text: row.content,
      },
    ],
    metadata,
  }
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
  initialChatId,
  children,
}: WritingChatProviderProps) {
  const navigate = useNavigate()
  const createChatFn = useServerFn(createWritingChat)
  const [projectRows] = useQuery(queries.writing.projectById({ projectId }))
  const [chats] = useQuery(queries.writing.chatsByProject({ projectId }))
  const project = Array.isArray(projectRows) ? projectRows[0] : projectRows
  const [activeChatId, setActiveChatId] = useState<string | undefined>(initialChatId)
  const [status, setStatus] = useState<'ready' | 'submitted'>('ready')
  const [error, setError] = useState<Error | null>(null)
  const [selectedModelId, setSelectedModelIdState] = useState<string>(
    WRITING_DEFAULT_MODEL_ID,
  )
  const [selectedReasoningEffort, setSelectedReasoningEffort] =
    useState<AiReasoningEffort>()

  useEffect(() => {
    const activeChat = chats.find((chat: any) => chat.id === activeChatId)
    if (activeChat?.modelId) {
      setSelectedModelIdState(activeChat.modelId)
      return
    }

    if (project && typeof project === 'object' && 'modelId' in project) {
      const projectModelId = (project as { modelId?: unknown }).modelId
      if (typeof projectModelId === 'string' && projectModelId.trim().length > 0) {
        setSelectedModelIdState(projectModelId)
      }
    }
  }, [activeChatId, chats, project])

  useEffect(() => {
    if (initialChatId && chats.some((chat: any) => chat.id === initialChatId)) {
      setActiveChatId(initialChatId)
      return
    }

    const fallbackChatId = chats[0]?.id
    if (fallbackChatId) {
      setActiveChatId((current) => current ?? fallbackChatId)
    } else if (!initialChatId) {
      setActiveChatId(undefined)
    }
  }, [chats, initialChatId])

  useEffect(() => {
    if (!activeChatId) return

    const search = { chatId: activeChatId }
    void navigate({
      to: '/writing/projects/$projectId',
      params: { projectId },
      search,
      replace: true,
    })
  }, [activeChatId, navigate, projectId])

  const [messageRows] = useQuery(
    queries.writing.messagesByChat({ chatId: activeChatId ?? '__none__' }),
  )

  const messages = useMemo(
    () =>
      messageRows.map((row: any) =>
        toWritingUiMessage({
          id: row.id,
          role: row.role,
          content: row.content,
          metadataJson: row.metadataJson,
        }),
      ),
    [messageRows],
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

  const ensureActiveChat = useCallback(async () => {
    if (activeChatId) return activeChatId

    const result = (await createChatFn({
      data: {
        projectId,
        modelId: selectedModelId,
      },
    })) as { chatId: string }

    setActiveChatId(result.chatId)
    return result.chatId
  }, [activeChatId, createChatFn, projectId, selectedModelId])

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      setError(null)
      setStatus('submitted')

      try {
        const chatId = await ensureActiveChat()
        const response = await fetch('/api/writing/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            chatId,
            prompt: text,
            modelId: selectedModelId,
          }),
        })

        const payload = await response.json().catch(() => undefined)
        if (!response.ok) {
          const parsed = parseChatApiError(payload)
          throw new Error(parsed?.message ?? 'Writing chat request failed')
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
    [ensureActiveChat, projectId, selectedModelId],
  )

  const setSelectedContextWindowMode = useCallback(
    async (_contextWindowMode: AiContextWindowMode) => {
      return
    },
    [],
  )

  const setSelectedModeId = useCallback(async (_modeId?: ChatModeId) => {
    return
  }, [])

  const setThreadDisabledToolKeys = useCallback(
    async (_disabledToolKeys: readonly string[]) => {
      return
    },
    [],
  )

  const unsupportedMessageAction = useCallback(async () => {
    throw new Error('Writing chat message actions are not available yet')
  }, [])

  const revealMessageBranch = useCallback(async () => false, [])

  const messagesValue = useMemo<ChatMessagesContextValue>(
    () => ({
      messages,
      status,
      activeThreadId: activeChatId,
      hasHydratedActiveThread: true,
      branchSelectorsByAnchorMessageId: {},
      latestAssistantUsage: undefined,
      branchCost: undefined,
      showBranchCost: false,
    }),
    [activeChatId, messages, status],
  )

  const composerValue = useMemo<ChatComposerContextValue>(
    () => ({
      sendMessage,
      status,
      error,
      activeThreadId: activeChatId,
      selectedModelId,
      selectedReasoningEffort,
      selectedContextWindowMode: 'standard',
      selectableModels: modelOptions,
      visibleModels: modelOptions,
      setSelectedModelId,
      setSelectedReasoningEffort,
      setSelectedContextWindowMode,
      selectedModeId: undefined,
      isModeEnforced: true,
      setSelectedModeId,
      visibleTools: [],
      disabledToolKeys: [],
      setThreadDisabledToolKeys,
      activeContextWindow: 128_000,
      contextWindowSupportsMaxMode: false,
      canUploadFiles: false,
      uploadUpgradeCallout: 'Writing chat attachments are not available yet',
    }),
    [
      activeChatId,
      error,
      modelOptions,
      selectedModelId,
      selectedReasoningEffort,
      sendMessage,
      setSelectedContextWindowMode,
      setSelectedModeId,
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
      regenerate: undefined,
      setMessages: undefined,
      resumeStream: undefined,
      clear: undefined,
    }),
    [revealMessageBranch, status, unsupportedMessageAction],
  )

  return (
    <SharedChatContextProvider
      messagesValue={messagesValue}
      composerValue={composerValue}
      messageActionsValue={messageActionsValue}
    >
      {children}
    </SharedChatContextProvider>
  )
}
