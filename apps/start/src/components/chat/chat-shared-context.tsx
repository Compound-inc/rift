'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ChatStatus, LanguageModelUsage, UIMessage } from 'ai'
import type { ChatMessageMetadata } from '@/lib/shared/chat-contracts/message-metadata'
import type {
  ChatAttachment,
  ChatAttachmentInput,
} from '@/lib/shared/chat-contracts/attachments'
import type {
  AiContextWindowMode,
  AiReasoningEffort,
} from '@/lib/shared/ai-catalog/types'
import type { PaidWorkspacePlanId } from '@/lib/shared/access-control'
import type { ChatModeId } from '@/lib/shared/chat-modes'

type ChatUIMessage = UIMessage<ChatMessageMetadata>

export type ChatModelOption = {
  readonly id: string
  readonly name: string
  readonly reasoningEfforts: readonly AiReasoningEffort[]
  readonly defaultReasoningEffort?: AiReasoningEffort
  readonly locked: boolean
  readonly minimumPlanId?: PaidWorkspacePlanId
}

export type ChatVisibleTool = {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly enabled: boolean
  readonly disabled: boolean
  readonly advanced: boolean
}

export type BranchSelectorState = {
  readonly parentMessageId: string
  readonly optionMessageIds: readonly string[]
  readonly selectedMessageId: string
}

export type ChatMessagesContextValue = {
  messages: ChatUIMessage[]
  status: ChatStatus
  activeThreadId?: string
  hasHydratedActiveThread: boolean
  branchSelectorsByAnchorMessageId: Record<string, BranchSelectorState>
  latestAssistantUsage?: LanguageModelUsage
  branchCost?: number
  showBranchCost: boolean
}

export type ChatComposerContextValue = {
  sendMessage: (input: {
    text: string
    attachments?: readonly ChatAttachmentInput[]
    attachmentManifest?: readonly ChatAttachment[]
  }) => Promise<void>
  status: ChatStatus
  error: Error | null | undefined
  activeThreadId?: string
  selectedModelId: string
  selectedReasoningEffort?: AiReasoningEffort
  selectedContextWindowMode: AiContextWindowMode
  selectableModels: readonly ChatModelOption[]
  visibleModels: readonly ChatModelOption[]
  setSelectedModelId: (modelId: string) => void
  setSelectedReasoningEffort: (reasoningEffort?: AiReasoningEffort) => void
  setSelectedContextWindowMode: (
    contextWindowMode: AiContextWindowMode,
  ) => Promise<void>
  selectedModeId?: ChatModeId
  isModeEnforced: boolean
  setSelectedModeId: (modeId?: ChatModeId) => Promise<void>
  visibleTools: readonly ChatVisibleTool[]
  disabledToolKeys: readonly string[]
  setThreadDisabledToolKeys: (
    disabledToolKeys: readonly string[],
  ) => Promise<void>
  activeContextWindow: number
  contextWindowSupportsMaxMode: boolean
  canUploadFiles: boolean
  uploadUpgradeCallout?: string
}

export type ChatMessageActionsContextValue = {
  status: ChatStatus
  regenerateMessage: (messageId: string) => Promise<void>
  editMessage: (input: {
    messageId: string
    editedText: string
  }) => Promise<void>
  selectBranchVersion: (input: {
    parentMessageId: string
    childMessageId: string
  }) => Promise<void>
  revealMessageBranch: (input: { messageId: string }) => Promise<boolean>
  regenerate?: unknown
  setMessages?: unknown
  resumeStream?: unknown
  clear?: () => void
}

const ChatMessagesContext = createContext<ChatMessagesContextValue | null>(null)
const ChatComposerContext = createContext<ChatComposerContextValue | null>(null)
const ChatMessageActionsContext =
  createContext<ChatMessageActionsContextValue | null>(null)

export function SharedChatContextProvider({
  messagesValue,
  composerValue,
  messageActionsValue,
  children,
}: {
  messagesValue: ChatMessagesContextValue
  composerValue: ChatComposerContextValue
  messageActionsValue: ChatMessageActionsContextValue
  children: ReactNode
}) {
  return (
    <ChatMessagesContext.Provider value={messagesValue}>
      <ChatComposerContext.Provider value={composerValue}>
        <ChatMessageActionsContext.Provider value={messageActionsValue}>
          {children}
        </ChatMessageActionsContext.Provider>
      </ChatComposerContext.Provider>
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

export function useChatComposer() {
  const ctx = useContext(ChatComposerContext)
  if (!ctx) {
    throw new Error('useChatComposer must be used within ChatProvider')
  }
  return ctx
}

export function useChatMessageActions() {
  const ctx = useContext(ChatMessageActionsContext)
  if (!ctx) {
    throw new Error('useChatMessageActions must be used within ChatProvider')
  }
  return ctx
}

export function useChatActions() {
  return {
    ...useChatComposer(),
    ...useChatMessageActions(),
  }
}

export function useChat() {
  return {
    ...useChatMessages(),
    ...useChatActions(),
  }
}
