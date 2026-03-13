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
import type { LanguageModelUsage, UIMessage  } from 'ai'
import { useQuery, useZero  } from '@rocicorp/zero/react'
import { DefaultChatTransport } from 'ai'
import { flushSync } from 'react-dom'
import { mutators, queries } from '@/integrations/zero'
import { CACHE_CHAT_NAV } from '@/integrations/zero/query-cache-policy'
import { AI_CATALOG } from '@/lib/shared/ai-catalog'
import {
  coerceWorkspacePlanId,
  getFeatureAccessState,
  getModelAccess,
  hasFeatureAccess
  
  
} from '@/lib/shared/access-control'
import type {AccessContext, PaidWorkspacePlanId} from '@/lib/shared/access-control';
import { getLocalizedFeatureAccessGateMessage } from '@/lib/frontend/access-control'
import {
  getLocalizedToolCopy,
  getToolDisplayLabel,
} from '@/lib/shared/ai-catalog/tool-ui'
import { canUseReasoningControls } from '@/utils/app-feature-flags'
import {
  isChatModeId,
  resolveEffectiveChatMode
  
} from '@/lib/shared/chat-modes'
import type {ChatModeId} from '@/lib/shared/chat-modes';
import { resolveToolPolicy } from '@/lib/shared/chat/tool-policy'
import { evaluateModelAvailability } from '@/lib/shared/model-policy/policy-engine'
import {
  DEFAULT_ORG_TOOL_POLICY,
  EMPTY_ORG_PROVIDER_KEY_STATUS
  
} from '@/lib/shared/model-policy/types'
import type {OrgAiPolicy} from '@/lib/shared/model-policy/types';
import type {
  ChatAttachment,
  ChatAttachmentInput,
} from '@/lib/shared/chat-contracts/attachments'
import type { ChatMessageMetadata } from '@/lib/shared/chat-contracts/message-metadata'
import { getChatErrorMessage } from '@/lib/shared/chat-contracts/error-messages'
import { ChatErrorCode } from '@/lib/shared/chat-contracts/error-codes'
import type { AiReasoningEffort } from '@/lib/shared/ai-catalog/types'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { useOrgBillingSummary } from '@/lib/frontend/billing/use-org-billing'
import {
  getThreadGenerationStatus,
  getThreadStatusesVersion,
  setThreadGenerationStatus,
  subscribeThreadStatuses,
} from './thread-status-store'
import {
  ROOT_BRANCH_PARENT_KEY,
  normalizeActiveChildByParent,
  resolveBranchSelectionPath,
  resolveCanonicalBranch,
} from '@/lib/shared/chat-branching/branch-resolver'

type ChatUIMessage = UIMessage<ChatMessageMetadata>

type ChatModelOption = {
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

type ChatActionsContextValue = Pick<
  ReturnType<typeof useAIChat<ChatUIMessage>>,
  'status' | 'error' | 'setMessages' | 'resumeStream' | 'regenerate'
> & {
  sendMessage: (input: {
    text: string
    attachments?: readonly ChatAttachmentInput[]
    attachmentManifest?: readonly ChatAttachment[]
  }) => Promise<void>
  activeThreadId?: string
  selectedModelId: string
  selectedReasoningEffort?: AiReasoningEffort
  selectableModels: readonly ChatModelOption[]
  visibleModels: readonly ChatModelOption[]
  setSelectedModelId: (modelId: string) => void
  setSelectedReasoningEffort: (reasoningEffort?: AiReasoningEffort) => void
  selectedModeId?: ChatModeId
  isModeEnforced: boolean
  setSelectedModeId: (modeId?: ChatModeId) => Promise<void>
  visibleTools: readonly ChatVisibleTool[]
  disabledToolKeys: readonly string[]
  setThreadDisabledToolKeys: (
    disabledToolKeys: readonly string[],
  ) => Promise<void>
  canUploadFiles: boolean
  uploadUpgradeCallout?: string
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
  clear: () => void
}

type ChatComposerContextValue = Pick<
  ChatActionsContextValue,
  | 'status'
  | 'error'
  | 'sendMessage'
  | 'activeThreadId'
  | 'selectedModelId'
  | 'selectedReasoningEffort'
  | 'selectableModels'
  | 'visibleModels'
  | 'setSelectedModelId'
  | 'setSelectedReasoningEffort'
  | 'selectedModeId'
  | 'isModeEnforced'
  | 'setSelectedModeId'
  | 'visibleTools'
  | 'disabledToolKeys'
  | 'setThreadDisabledToolKeys'
  | 'canUploadFiles'
  | 'uploadUpgradeCallout'
>

type ChatMessageActionsContextValue = Pick<
  ChatActionsContextValue,
  | 'status'
  | 'regenerate'
  | 'regenerateMessage'
  | 'editMessage'
  | 'selectBranchVersion'
  | 'revealMessageBranch'
  | 'setMessages'
  | 'resumeStream'
  | 'clear'
>

type BranchSelectorState = {
  readonly parentMessageId: string
  readonly optionMessageIds: readonly string[]
  readonly selectedMessageId: string
}

type PendingBranchSelectorState = {
  readonly anchorMessageId: string
  readonly parentMessageId: string
  readonly placeholderMessageId: string
  readonly optionMessageIds: readonly string[]
  readonly expectedOptionCount: number
}

type OptimisticThreadBranchState = {
  readonly activeChildByParent: Record<string, string>
  readonly branchVersion: number
}

type ChatMessagesContextValue = {
  messages: ChatUIMessage[]
  status: ReturnType<typeof useAIChat<ChatUIMessage>>['status']
  activeThreadId?: string
  hasHydratedActiveThread: boolean
  branchSelectorsByAnchorMessageId: Record<string, BranchSelectorState>
  branchUsage?: LanguageModelUsage
  branchCost?: number
  showBranchCost: boolean
}

const ChatMessagesContext = createContext<ChatMessagesContextValue | null>(null)
const ChatComposerContext = createContext<ChatComposerContextValue | null>(null)
const ChatMessageActionsContext =
  createContext<ChatMessageActionsContextValue | null>(null)

type PendingOptimisticAttachmentManifest = {
  readonly text: string
  readonly attachments: readonly ChatAttachment[]
}

/**
 * Zero query rows are structurally typed. Normalizing them once keeps the chat
 * surface aligned with the server-side policy shape and avoids repeating
 * defensive property checks across model/tool selectors.
 */
function toOrgAiPolicy(row: unknown): OrgAiPolicy | undefined {
  if (!row || typeof row !== 'object') return undefined
  if (!('organizationId' in row) || typeof row.organizationId !== 'string') {
    return undefined
  }

  const enforcedModeId =
    'enforcedModeId' in row && typeof row.enforcedModeId === 'string'
      ? row.enforcedModeId
      : undefined

  return {
    organizationId: row.organizationId,
    disabledProviderIds:
      'disabledProviderIds' in row && Array.isArray(row.disabledProviderIds)
        ? row.disabledProviderIds
        : [],
    disabledModelIds:
      'disabledModelIds' in row && Array.isArray(row.disabledModelIds)
        ? row.disabledModelIds
        : [],
    complianceFlags:
      'complianceFlags' in row &&
      typeof row.complianceFlags === 'object' &&
      row.complianceFlags
        ? (row.complianceFlags as Record<string, boolean>)
        : {},
    toolPolicy: {
      providerNativeToolsEnabled:
        'providerNativeToolsEnabled' in row &&
        typeof row.providerNativeToolsEnabled === 'boolean'
          ? row.providerNativeToolsEnabled
          : DEFAULT_ORG_TOOL_POLICY.providerNativeToolsEnabled,
      externalToolsEnabled:
        'externalToolsEnabled' in row &&
        typeof row.externalToolsEnabled === 'boolean'
          ? row.externalToolsEnabled
          : DEFAULT_ORG_TOOL_POLICY.externalToolsEnabled,
      disabledToolKeys:
        'disabledToolKeys' in row && Array.isArray(row.disabledToolKeys)
          ? row.disabledToolKeys
          : DEFAULT_ORG_TOOL_POLICY.disabledToolKeys,
    },
    orgKnowledgeEnabled:
      'orgKnowledgeEnabled' in row && typeof row.orgKnowledgeEnabled === 'boolean'
        ? row.orgKnowledgeEnabled
        : false,
    activeOrgKnowledgeCount:
      'activeOrgKnowledgeCount' in row &&
      typeof row.activeOrgKnowledgeCount === 'number'
        ? row.activeOrgKnowledgeCount
        : 0,
    providerKeyStatus:
      'providerKeyStatus' in row &&
      typeof row.providerKeyStatus === 'object' &&
      row.providerKeyStatus &&
      'providers' in row.providerKeyStatus &&
      typeof row.providerKeyStatus.providers === 'object' &&
      row.providerKeyStatus.providers &&
      'openai' in row.providerKeyStatus.providers &&
      'anthropic' in row.providerKeyStatus.providers
        ? {
            syncedAt:
              'syncedAt' in row.providerKeyStatus &&
              typeof row.providerKeyStatus.syncedAt === 'number'
                ? row.providerKeyStatus.syncedAt
                : EMPTY_ORG_PROVIDER_KEY_STATUS.syncedAt,
            hasAnyProviderKey:
              Boolean(row.providerKeyStatus.providers.openai) ||
              Boolean(row.providerKeyStatus.providers.anthropic),
            providers: {
              openai: Boolean(row.providerKeyStatus.providers.openai),
              anthropic: Boolean(row.providerKeyStatus.providers.anthropic),
            },
          }
        : undefined,
    enforcedModeId:
      enforcedModeId && isChatModeId(enforcedModeId)
        ? enforcedModeId
        : undefined,
    updatedAt:
      'updatedAt' in row && typeof row.updatedAt === 'number'
        ? row.updatedAt
        : Date.now(),
  }
}

function toUIMessageFromStoredMessage(message: {
  readonly messageId: string
  readonly role: 'user' | 'assistant' | 'system'
  readonly content: string
  readonly reasoning?: string | null
  readonly model: string
  readonly sources?:
    | readonly { sourceId: string; url: string; title?: string }[]
    | null
}): ChatUIMessage {
  const attachments = Array.isArray(message.sources)
    ? message.sources
        .filter(
          (
            source,
          ): source is { sourceId: string; url: string; title?: string } =>
            !!source &&
            typeof source.sourceId === 'string' &&
            typeof source.url === 'string',
        )
        .map((source) => ({
          id: source.sourceId,
          key: source.sourceId,
          url: source.url,
          name: source.title ?? 'Attachment',
          size: 0,
          contentType: 'application/octet-stream',
        }))
    : []
  const parts: ChatUIMessage['parts'] = []
  if (
    message.role === 'assistant' &&
    typeof message.reasoning === 'string' &&
    message.reasoning.trim().length > 0
  ) {
    parts.push({ type: 'reasoning', text: message.reasoning, state: 'done' })
  }
  parts.push({ type: 'text', text: message.content })

  return {
    id: message.messageId,
    role: message.role,
    parts,
    metadata: {
      ...(message.role === 'assistant' ? { model: message.model } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    },
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
    const storedAttachmentCount = Array.isArray(
      storedMessage.metadata?.attachments,
    )
      ? storedMessage.metadata.attachments.length
      : 0
    const localAttachmentCount = Array.isArray(
      localMessage.metadata?.attachments,
    )
      ? localMessage.metadata.attachments.length
      : 0

    // Preserve object identity when content is equivalent to avoid unnecessary row rerenders.
    if (localText === storedText) {
      // Stored payload carries authoritative attachment metadata after persistence.
      if (storedAttachmentCount > localAttachmentCount) {
        return storedMessage
      }
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

function buildCanonicalUIMessageSnapshot(input: {
  readonly storedMessages: readonly {
    readonly messageId: string
    readonly role: 'user' | 'assistant' | 'system'
    readonly parentMessageId?: string | null
    readonly branchIndex: number
    readonly created_at: number
    readonly content: string
    readonly reasoning?: string | null
    readonly model: string
    readonly sources?:
      | readonly { sourceId: string; url: string; title?: string }[]
      | null
  }[]
  readonly activeChildByParent: Record<string, string>
}): ChatUIMessage[] {
  const messageById = new Map(
    input.storedMessages.map((message) => [message.messageId, message]),
  )
  const canonicalIds = resolveCanonicalBranch(
    input.storedMessages.map((message) => ({
      messageId: message.messageId,
      role: message.role,
      parentMessageId: message.parentMessageId ?? undefined,
      branchIndex: message.branchIndex,
      createdAt: message.created_at,
    })),
    input.activeChildByParent,
  ).canonicalMessageIds

  return canonicalIds
    .map((messageId) => messageById.get(messageId))
    .filter((message): message is NonNullable<typeof message> => !!message)
    .map(toUIMessageFromStoredMessage)
}

function addDefined(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  return left == null && right == null ? undefined : (left ?? 0) + (right ?? 0)
}

function buildBranchUsage(
  messages: readonly {
    readonly role: 'user' | 'assistant' | 'system'
    readonly inputTokens?: number | null
    readonly outputTokens?: number | null
    readonly totalTokens?: number | null
    readonly reasoningTokens?: number | null
    readonly textTokens?: number | null
    readonly cacheReadTokens?: number | null
    readonly cacheWriteTokens?: number | null
    readonly noCacheTokens?: number | null
  }[],
): LanguageModelUsage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'assistant') continue

    const hasAnyUsage =
      message.inputTokens != null ||
      message.outputTokens != null ||
      message.totalTokens != null

    if (!hasAnyUsage) continue

    return {
      inputTokens: message.inputTokens ?? undefined,
      inputTokenDetails: {
        noCacheTokens: message.noCacheTokens ?? undefined,
        cacheReadTokens: message.cacheReadTokens ?? undefined,
        cacheWriteTokens: message.cacheWriteTokens ?? undefined,
      },
      outputTokens: message.outputTokens ?? undefined,
      outputTokenDetails: {
        textTokens: message.textTokens ?? undefined,
        reasoningTokens: message.reasoningTokens ?? undefined,
      },
      totalTokens:
        message.totalTokens ??
        addDefined(
          message.inputTokens ?? undefined,
          message.outputTokens ?? undefined,
        ),
      reasoningTokens: message.reasoningTokens ?? undefined,
      cachedInputTokens: message.cacheReadTokens ?? undefined,
    }
  }

  return undefined
}

function buildBranchCost(
  messages: readonly {
    readonly role: 'user' | 'assistant' | 'system'
    readonly publicCost?: number | null
  }[],
): { branchCost?: number; showBranchCost: boolean } {
  let branchCost = 0
  let hasVisibleCost = false

  for (const message of messages) {
    if (message.role !== 'assistant' || message.publicCost == null) continue
    branchCost += message.publicCost
    hasVisibleCost = true
  }

  return {
    branchCost: hasVisibleCost ? Number(branchCost.toFixed(12)) : undefined,
    showBranchCost: hasVisibleCost,
  }
}

const DEFAULT_THREAD_TITLE = 'Nuevo Chat'
const OPTIMISTIC_THREAD_CREATED_EVENT = 'chat:thread-created'
const PENDING_REGEN_BRANCH_PREFIX = '__pending_regen_branch__'
const PENDING_EDIT_BRANCH_PREFIX = '__pending_edit_branch__'

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

function findRegenerationAnchorMessageId(input: {
  readonly messages: readonly ChatUIMessage[]
  readonly targetMessageId: string
}): string | null {
  const { messages, targetMessageId } = input
  const targetIndex = messages.findIndex(
    (message) => message.id === targetMessageId,
  )
  if (targetIndex < 0) return null
  const target = messages[targetIndex]
  if (target.role === 'user') return target.id
  if (target.role !== 'assistant') return null

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return messages[index].id
  }
  return null
}

function findCurrentAssistantForAnchor(input: {
  readonly messages: readonly ChatUIMessage[]
  readonly anchorMessageId: string
}): string | null {
  const { messages, anchorMessageId } = input
  const anchorIndex = messages.findIndex(
    (message) => message.id === anchorMessageId,
  )
  if (anchorIndex < 0) return null
  for (let index = anchorIndex + 1; index < messages.length; index += 1) {
    const message = messages[index]
    if (message?.role === 'assistant') return message.id
    if (message?.role === 'user') break
  }
  return null
}

function uniqueMessageIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}

function hasActiveOrgKeyForModel(input: {
  readonly providers: readonly string[]
  readonly providerKeyStatus?: {
    readonly syncedAt: number
    readonly providers: {
      readonly openai: boolean
      readonly anthropic: boolean
    }
  }
}): boolean {
  const { providerKeyStatus } = input
  if (!providerKeyStatus || providerKeyStatus.syncedAt <= 0) {
    return false
  }

  /**
   * `require_org_provider_key` is currently enforced for BYOK-capable providers.
   * As additional BYOK providers are added, expand this set and snapshot shape.
   */
  return input.providers.some((providerId) => {
    if (providerId === 'openai') return providerKeyStatus.providers.openai
    if (providerId === 'anthropic') return providerKeyStatus.providers.anthropic
    return false
  })
}

function areBranchSelectionsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)
  if (leftEntries.length !== rightEntries.length) {
    return false
  }

  for (const [parentId, childId] of leftEntries) {
    if (right[parentId] !== childId) {
      return false
    }
  }

  return true
}

export function ChatProvider({
  children,
  threadId,
}: {
  children: ReactNode
  threadId?: string
}) {
  const navigate = useNavigate()
  const z = useZero()
  const { isAnonymous, activeOrganizationId } = useAppAuth()
  const { entitlement } = useOrgBillingSummary()
  // Mutable refs avoid stale values inside async callbacks owned by the transport hook.
  const threadIdRef = useRef<string | undefined>(threadId)
  const previousThreadIdRef = useRef<string | undefined>(threadId)
  const lastAppliedBranchVersionRef = useRef<number | undefined>(undefined)
  const allowShrinkOnNextBranchVersionRef = useRef(false)
  const resumeAttemptedThreadIdRef = useRef<string | undefined>(undefined)
  // Prevents duplicate thread creation during quick repeated submissions.
  const inFlightThreadRef = useRef<Promise<string> | null>(null)
  // First send after optimistic creation can ask server to create-if-missing.
  const createIfMissingRef = useRef(false)
  const [provisionalThreadId, setProvisionalThreadId] = useState<
    string | undefined
  >(undefined)
  const [localError, setLocalError] = useState<Error | null>(null)
  const [pendingBranchSelector, setPendingBranchSelector] =
    useState<PendingBranchSelectorState | null>(null)
  const [optimisticBranchStateByThreadId, setOptimisticBranchStateByThreadId] =
    useState<Record<string, OptimisticThreadBranchState>>({})
  const activeThreadId = threadId ?? provisionalThreadId
  const [orgPolicyRow] = useQuery(queries.orgPolicy.current())
  const [threadRow] = useQuery(
    queries.threads.byId({
      threadId: activeThreadId ?? '',
      organizationId: activeOrganizationId?.trim() ?? '__missing_org__',
    }),
    CACHE_CHAT_NAV,
  )
  const scopedThreadId =
    threadRow?.threadId && threadRow.threadId === activeThreadId
      ? activeThreadId
      : ''
  const effectiveBranchState = useMemo<
    OptimisticThreadBranchState | undefined
  >(() => {
    if (!activeThreadId) return undefined

    const optimisticState = optimisticBranchStateByThreadId[activeThreadId]
    const persistedSelections = normalizeActiveChildByParent(
      threadRow?.activeChildByParent,
    )
    const persistedVersion =
      threadRow?.threadId === activeThreadId &&
      typeof threadRow.branchVersion === 'number'
        ? threadRow.branchVersion
        : 1

    if (!optimisticState) {
      return {
        activeChildByParent: persistedSelections,
        branchVersion: persistedVersion,
      }
    }

    return {
      activeChildByParent: {
        ...persistedSelections,
        ...optimisticState.activeChildByParent,
      },
      branchVersion: Math.max(persistedVersion, optimisticState.branchVersion),
    }
  }, [activeThreadId, optimisticBranchStateByThreadId, threadRow])
  const [storedMessages, storedMessagesResult] = useQuery(
    queries.messages.byThread({ threadId: scopedThreadId }),
    CACHE_CHAT_NAV,
  )

  useEffect(() => {
    if (!threadRow?.threadId) return

    setThreadGenerationStatus(
      threadRow.threadId,
      threadRow.generationStatus as
        | 'pending'
        | 'generation'
        | 'completed'
        | 'failed'
        | undefined,
    )
  }, [threadRow?.generationStatus, threadRow?.threadId])

  const hasHydratedActiveThread = !activeThreadId
    ? true
    : storedMessagesResult.type === 'complete'
  const { canonicalStoredMessages, storedBranchSelectorsByAnchorMessageId } =
    useMemo(() => {
      const messageById = new Map(
        storedMessages.map((message) => [message.messageId, message]),
      )
      const resolution = resolveCanonicalBranch(
        storedMessages.map((message) => ({
          messageId: message.messageId,
          role: message.role,
          parentMessageId: message.parentMessageId ?? undefined,
          branchIndex: message.branchIndex,
          createdAt: message.created_at,
        })),
        effectiveBranchState?.activeChildByParent,
      )
      const canonical = resolution.canonicalMessageIds
        .map((messageId) => messageById.get(messageId))
        .filter((message): message is NonNullable<typeof message> => !!message)
      const selectors: Record<string, BranchSelectorState> = {}

      for (const [parentMessageId, optionMessageIds] of Object.entries(
        resolution.branchOptionsByParent,
      )) {
        if (optionMessageIds.length <= 1) continue
        const assistantOptionIds = optionMessageIds.filter(
          (optionMessageId) => {
            const option = messageById.get(optionMessageId)
            return option?.role === 'assistant'
          },
        )
        if (assistantOptionIds.length > 1) {
          const parent = messageById.get(parentMessageId)
          if (parent && parent.role === 'user') {
            const selectedMessageId =
              resolution.selectedChildByParent[parentMessageId] &&
              assistantOptionIds.includes(
                resolution.selectedChildByParent[parentMessageId],
              )
                ? resolution.selectedChildByParent[parentMessageId]
                : assistantOptionIds[assistantOptionIds.length - 1]

            selectors[parent.messageId] = {
              parentMessageId,
              optionMessageIds: assistantOptionIds,
              selectedMessageId,
            }
          }
        }

        const userOptionIds = optionMessageIds.filter((optionMessageId) => {
          const option = messageById.get(optionMessageId)
          return option?.role === 'user'
        })
        if (userOptionIds.length <= 1) continue
        const selectedUserMessageId =
          resolution.selectedChildByParent[parentMessageId] &&
          userOptionIds.includes(
            resolution.selectedChildByParent[parentMessageId],
          )
            ? resolution.selectedChildByParent[parentMessageId]
            : userOptionIds[userOptionIds.length - 1]
        selectors[selectedUserMessageId] = {
          parentMessageId,
          optionMessageIds: userOptionIds,
          selectedMessageId: selectedUserMessageId,
        }
      }

      return {
        canonicalStoredMessages: canonical,
        storedBranchSelectorsByAnchorMessageId: selectors,
      }
    }, [effectiveBranchState?.activeChildByParent, storedMessages])
  const branchSelectorsByAnchorMessageId = useMemo(() => {
    if (!pendingBranchSelector) return storedBranchSelectorsByAnchorMessageId
    return {
      ...storedBranchSelectorsByAnchorMessageId,
      [pendingBranchSelector.anchorMessageId]: {
        parentMessageId: pendingBranchSelector.parentMessageId,
        optionMessageIds: pendingBranchSelector.optionMessageIds,
        selectedMessageId: pendingBranchSelector.placeholderMessageId,
      },
    }
  }, [pendingBranchSelector, storedBranchSelectorsByAnchorMessageId])
  const branchUsage = useMemo(
    () => buildBranchUsage(canonicalStoredMessages),
    [canonicalStoredMessages],
  )
  const { branchCost, showBranchCost } = useMemo(
    () => buildBranchCost(canonicalStoredMessages),
    [canonicalStoredMessages],
  )
  const orgPolicy = useMemo(() => toOrgAiPolicy(orgPolicyRow), [orgPolicyRow])
  const accessContext = useMemo<AccessContext>(
    () => ({
      isAnonymous,
      planId: activeOrganizationId
        ? coerceWorkspacePlanId(entitlement?.planId)
        : 'free',
    }),
    [activeOrganizationId, entitlement?.planId, isAnonymous],
  )
  const uploadPermission = useMemo(
    () =>
      getFeatureAccessState({
        feature: 'chat.fileUpload',
        planId: accessContext.planId,
      }),
    [accessContext.planId],
  )
  const visibleModels = useMemo<readonly ChatModelOption[]>(() => {
    return AI_CATALOG.filter((model) => {
      const policyAvailability = evaluateModelAvailability({
        model,
        policy: orgPolicy,
      })
      if (!policyAvailability.allowed) {
        return false
      }
      if (!orgPolicy?.complianceFlags?.require_org_provider_key) return true
      return hasActiveOrgKeyForModel({
        providers: model.providers,
        providerKeyStatus: orgPolicy.providerKeyStatus,
      })
    }).map((model) => {
      const modelAccess = getModelAccess({
        modelId: model.id,
        context: accessContext,
      })
      return {
        id: model.id,
        name: model.name,
        reasoningEfforts: canUseReasoningControls()
          ? model.reasoningEfforts
          : [],
        defaultReasoningEffort: canUseReasoningControls()
          ? model.defaultReasoningEffort
          : undefined,
        locked: !modelAccess.allowed,
        minimumPlanId: modelAccess.minimumPlanId,
      }
    })
  }, [accessContext, orgPolicy])
  const selectableModels = useMemo<readonly ChatModelOption[]>(() => {
    return visibleModels.filter((model) => {
      return !model.locked
    })
  }, [visibleModels])
  const orgEnforcedModeId = useMemo<ChatModeId | undefined>(() => {
    return orgPolicy?.enforcedModeId
  }, [orgPolicy])
  const threadModeId = useMemo<ChatModeId | undefined>(() => {
    if (!threadRow || typeof threadRow !== 'object') return undefined
    const candidate =
      'modeId' in threadRow && typeof threadRow.modeId === 'string'
        ? threadRow.modeId
        : undefined
    return candidate && isChatModeId(candidate) ? candidate : undefined
  }, [threadRow])
  const isModeEnforced = Boolean(orgEnforcedModeId)
  const effectiveModeId = orgEnforcedModeId ?? threadModeId
  const [selectedModelId, setSelectedModelId] = useState(
    selectableModels[0]?.id ?? '',
  )
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState<
    AiReasoningEffort | undefined
  >(undefined)
  const [threadDisabledToolKeysById, setThreadDisabledToolKeysById] = useState<
    Record<string, readonly string[]>
  >({})
  const [draftDisabledToolKeys, setDraftDisabledToolKeys] = useState<
    readonly string[]
  >([])
  const hydratedModelSelectionThreadIdRef = useRef<string | undefined>(
    undefined,
  )
  const selectedModelIdRef = useRef(selectedModelId)
  const selectedReasoningEffortRef = useRef(selectedReasoningEffort)
  const branchVersionByThreadIdRef = useRef<Record<string, number>>({})
  const pendingAttachmentsRef = useRef<
    readonly ChatAttachmentInput[] | undefined
  >(undefined)
  // Tracks attachment pills that should be rendered on the optimistic user row
  // immediately after send (before server persistence snapshots catch up).
  const pendingOptimisticAttachmentManifestsRef = useRef<
    PendingOptimisticAttachmentManifest[]
  >([])
  const persistedThreadDisabledToolKeys =
    threadRow &&
    'disabledToolKeys' in threadRow &&
    Array.isArray(threadRow.disabledToolKeys)
      ? threadRow.disabledToolKeys
      : undefined
  const threadDisabledToolKeys = activeThreadId
    ? (threadDisabledToolKeysById[activeThreadId] ??
      persistedThreadDisabledToolKeys ??
      [])
    : draftDisabledToolKeys
  const visibleTools = useMemo<readonly ChatVisibleTool[]>(() => {
    const resolvedMode = resolveEffectiveChatMode({
      orgEnforcedModeId: orgPolicy?.enforcedModeId,
      threadModeId,
    })
    const toolPolicy = resolveToolPolicy({
      modelId:
        resolvedMode?.modeId === 'study'
          ? resolvedMode.definition.fixedModelId
          : selectedModelId,
      mode: resolvedMode,
      orgPolicy,
      threadDisabledToolKeys,
    })
    const duplicateLabels = new Set(
      Object.entries(
        toolPolicy.toolEntries.reduce<Record<string, number>>((acc, entry) => {
          const label = getLocalizedToolCopy(entry.key).label
          acc[label] = (acc[label] ?? 0) + 1
          return acc
        }, {}),
      )
        .filter(([, count]) => count > 1)
        .map(([label]) => label),
    )

    return toolPolicy.toolEntries.map(({ key, entry, enabled, reasons }) => ({
      key,
      label: getToolDisplayLabel({
        toolKey: key,
        providerId: entry.providerId,
        duplicateLabels,
      }),
      description: getLocalizedToolCopy(key).description,
      enabled,
      disabled:
        reasons.includes('blocked_by_org_master_switch') ||
        reasons.includes('blocked_by_org_policy') ||
        reasons.includes('blocked_by_external_tools_switch'),
      advanced: entry.advanced,
    }))
  }, [orgPolicy, selectedModelId, threadModeId, threadDisabledToolKeys])
  selectedModelIdRef.current = selectedModelId
  selectedReasoningEffortRef.current = selectedReasoningEffort
  const disabledToolKeysRef = useRef(threadDisabledToolKeys)
  disabledToolKeysRef.current = threadDisabledToolKeys
  if (
    activeThreadId &&
    threadRow &&
    threadRow.threadId === activeThreadId &&
    typeof threadRow.branchVersion === 'number'
  ) {
    // Track CAS versions per thread so navigation never leaks version state
    // from another thread while still remaining monotonic for this thread.
    const existing = branchVersionByThreadIdRef.current[activeThreadId]
    branchVersionByThreadIdRef.current[activeThreadId] =
      typeof existing === 'number'
        ? Math.max(existing, threadRow.branchVersion)
        : threadRow.branchVersion
  }
  useEffect(() => {
    if (!activeThreadId) return

    const optimisticState = optimisticBranchStateByThreadId[activeThreadId]
    if (!optimisticState) return

    const persistedSelections = normalizeActiveChildByParent(
      threadRow?.activeChildByParent,
    )
    const persistedVersion =
      threadRow?.threadId === activeThreadId &&
      typeof threadRow.branchVersion === 'number'
        ? threadRow.branchVersion
        : undefined

    if (
      typeof persistedVersion === 'number' &&
      persistedVersion >= optimisticState.branchVersion &&
      areBranchSelectionsEqual(
        optimisticState.activeChildByParent,
        persistedSelections,
      )
    ) {
      setOptimisticBranchStateByThreadId((current) => {
        if (!(activeThreadId in current)) return current
        const next = { ...current }
        delete next[activeThreadId]
        return next
      })
    }
  }, [activeThreadId, optimisticBranchStateByThreadId, threadRow])
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
        prepareSendMessagesRequest: ({
          messages,
          trigger,
          messageId,
          body,
        }) => {
          const attachments = pendingAttachmentsRef.current
          // Consume once to avoid leaking metadata into later turns.
          pendingAttachmentsRef.current = undefined
          const currentThreadId = threadIdRef.current
          const branchVersion = currentThreadId
            ? (branchVersionByThreadIdRef.current[currentThreadId] ?? 1)
            : 1

          const bodyObject =
            body && typeof body === 'object'
              ? (body as Record<string, unknown>)
              : {}
          const requestTrigger =
            typeof bodyObject.trigger === 'string'
              ? bodyObject.trigger
              : trigger
          const requestMessageId =
            typeof bodyObject.messageId === 'string'
              ? bodyObject.messageId
              : messageId
          const editedText =
            typeof bodyObject.editedText === 'string'
              ? bodyObject.editedText
              : undefined

          return {
            body: {
              threadId: threadIdRef.current,
              trigger: requestTrigger,
              messageId: requestMessageId,
              editedText,
              expectedBranchVersion: branchVersion,
              message:
                requestTrigger === 'submit-message'
                  ? messages[messages.length - 1]
                  : undefined,
              attachments:
                requestTrigger === 'submit-message' ? attachments : undefined,
              createIfMissing: createIfMissingRef.current,
              modelId: selectedModelIdRef.current,
              reasoningEffort: selectedReasoningEffortRef.current,
              disabledToolKeys: disabledToolKeysRef.current,
            },
          }
        },
      }),
    [],
  )

  const {
    messages,
    status,
    error,
    sendMessage: sendAIMessage,
    regenerate,
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
  const messagesRef = useRef(messages)
  const statusRef = useRef(status)
  const activeThreadIdRef = useRef(activeThreadId)
  const storedMessagesRef = useRef(storedMessages)
  const storedBranchSelectorsRef = useRef(
    storedBranchSelectorsByAnchorMessageId,
  )
  const threadRowRef = useRef(threadRow)
  const regenerateRef = useRef(regenerate)
  const setMessagesRef = useRef(setMessages)
  messagesRef.current = messages
  statusRef.current = status
  activeThreadIdRef.current = activeThreadId
  storedMessagesRef.current = storedMessages
  storedBranchSelectorsRef.current = storedBranchSelectorsByAnchorMessageId
  threadRowRef.current =
    threadRow && activeThreadId
      ? {
          ...threadRow,
          activeChildByParent:
            effectiveBranchState?.activeChildByParent ??
            normalizeActiveChildByParent(threadRow.activeChildByParent),
          branchVersion:
            effectiveBranchState?.branchVersion ?? threadRow.branchVersion,
        }
      : threadRow
  regenerateRef.current = regenerate
  setMessagesRef.current = setMessages

  useEffect(() => {
    if (selectableModels.length === 0) return
    if (
      !activeThreadId &&
      !selectableModels.some((model) => model.id === selectedModelId)
    ) {
      setSelectedModelId(selectableModels[0].id)
      setSelectedReasoningEffort(selectableModels[0].defaultReasoningEffort)
    }
  }, [activeThreadId, selectableModels, selectedModelId])

  useEffect(() => {
    if (!activeThreadId) {
      hydratedModelSelectionThreadIdRef.current = undefined
      return
    }
    if (hydratedModelSelectionThreadIdRef.current === activeThreadId) return
    if (
      !threadRow ||
      typeof threadRow !== 'object' ||
      !('model' in threadRow) ||
      typeof threadRow.model !== 'string'
    ) {
      return
    }
    const model = visibleModels.find((m) => m.id === threadRow.model)
    if (!model) return

    hydratedModelSelectionThreadIdRef.current = activeThreadId
    setSelectedModelId(threadRow.model)
    const threadEffort =
      'reasoningEffort' in threadRow &&
      typeof threadRow.reasoningEffort === 'string'
        ? (threadRow.reasoningEffort as AiReasoningEffort)
        : undefined
    setSelectedReasoningEffort(
      threadEffort && model.reasoningEfforts.includes(threadEffort)
        ? threadEffort
        : model.defaultReasoningEffort,
    )
  }, [activeThreadId, threadRow, visibleModels])

  useEffect(() => {
    if (!activeThreadId) return
    const persistedDisabledToolKeys = persistedThreadDisabledToolKeys ?? []

    setThreadDisabledToolKeysById((current) => {
      const existing = current[activeThreadId] ?? []
      const same =
        existing.length === persistedDisabledToolKeys.length &&
        existing.every(
          (value, index) => value === persistedDisabledToolKeys[index],
        )
      if (same) return current
      return {
        ...current,
        [activeThreadId]: persistedDisabledToolKeys,
      }
    })
  }, [activeThreadId, persistedThreadDisabledToolKeys])

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
      setPendingBranchSelector(null)
      resumeAttemptedThreadIdRef.current = undefined
      lastAppliedBranchVersionRef.current = undefined
      allowShrinkOnNextBranchVersionRef.current = false
    }

    if (!activeThreadId) {
      createIfMissingRef.current = false
      setPendingBranchSelector(null)
      setOptimisticBranchStateByThreadId({})
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
    if (activeThreadId) return
    if (messages.length === 0) return
    setMessages([])
  }, [activeThreadId, messages.length, setMessages])

  useEffect(() => {
    if (!pendingBranchSelector) return
    const persistedSelector =
      storedBranchSelectorsByAnchorMessageId[
        pendingBranchSelector.anchorMessageId
      ]
    if (
      persistedSelector &&
      persistedSelector.optionMessageIds.length >=
        pendingBranchSelector.expectedOptionCount &&
      !persistedSelector.optionMessageIds.some((optionId) =>
        optionId.startsWith(PENDING_REGEN_BRANCH_PREFIX),
      )
    ) {
      setPendingBranchSelector(null)
    }
  }, [pendingBranchSelector, storedBranchSelectorsByAnchorMessageId])

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
    if (pendingOptimisticAttachmentManifestsRef.current.length === 0) return
    if (messages.length === 0) return

    const pendingManifests = pendingOptimisticAttachmentManifestsRef.current
    const consumedMessageIds = new Set<string>()
    const nextPending: PendingOptimisticAttachmentManifest[] = []
    const nextMessages = [...messages]
    let shouldPatchMessages = false

    for (const manifest of pendingManifests) {
      let targetIndex = -1
      for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
        const candidate = nextMessages[index]
        if (!candidate || candidate.role !== 'user') continue
        if (consumedMessageIds.has(candidate.id)) continue
        const hasExistingAttachments =
          Array.isArray(candidate.metadata?.attachments) &&
          candidate.metadata.attachments.length > 0
        if (hasExistingAttachments) continue
        if (textFromUIMessage(candidate) !== manifest.text) continue
        targetIndex = index
        break
      }

      if (targetIndex < 0) {
        nextPending.push(manifest)
        continue
      }

      const targetMessage = nextMessages[targetIndex]
      nextMessages[targetIndex] = {
        ...targetMessage,
        metadata: {
          ...(targetMessage.metadata ?? {}),
          attachments: manifest.attachments,
        },
      }
      consumedMessageIds.add(targetMessage.id)
      shouldPatchMessages = true
    }

    pendingOptimisticAttachmentManifestsRef.current = nextPending
    if (shouldPatchMessages) {
      setMessages(nextMessages)
    }
  }, [messages, setMessages])

  useEffect(() => {
    if (!activeThreadId) return
    if (storedMessagesResult.type !== 'complete') return
    // Never clobber messages while a new answer is actively streaming.
    if (status === 'submitted' || status === 'streaming') return

    const nextMessages = mergeStoredMessagesWithLocal(
      messages,
      canonicalStoredMessages.map(toUIMessageFromStoredMessage),
    )
    const currentBranchVersion = effectiveBranchState?.branchVersion
    const branchVersionChanged =
      typeof currentBranchVersion === 'number' &&
      typeof lastAppliedBranchVersionRef.current === 'number' &&
      currentBranchVersion !== lastAppliedBranchVersionRef.current
    const allowShrinkForThisVersion =
      branchVersionChanged && allowShrinkOnNextBranchVersionRef.current

    // Zero may return a completed but stale snapshot (for example, empty) while
    // optimistic/streaming messages are still only in local useChat state.
    if (
      messages.length > 0 &&
      nextMessages.length < messages.length &&
      !allowShrinkForThisVersion
    ) {
      if (typeof currentBranchVersion === 'number') {
        lastAppliedBranchVersionRef.current = currentBranchVersion
      }
      return
    }

    if (
      nextMessages.length === messages.length &&
      fingerprintMessages(nextMessages) === fingerprintMessages(messages)
    ) {
      if (typeof currentBranchVersion === 'number') {
        lastAppliedBranchVersionRef.current = currentBranchVersion
      }
      return
    }

    if (typeof currentBranchVersion === 'number') {
      lastAppliedBranchVersionRef.current = currentBranchVersion
    }
    if (branchVersionChanged) {
      allowShrinkOnNextBranchVersionRef.current = false
    }
    setMessages(nextMessages)
  }, [
    activeThreadId,
    canonicalStoredMessages,
    pendingBranchSelector,
    storedMessagesResult.type,
    status,
    messages,
    effectiveBranchState?.branchVersion,
    setMessages,
  ])

  useEffect(() => {
    if (!activeThreadId) return
    if (storedMessagesResult.type !== 'complete') return
    if (status === 'submitted' || status === 'streaming') return
    if (localError || error) return
    if (!threadRow || threadRow.generationStatus !== 'failed') return

    const latestAssistantFailure = [...canonicalStoredMessages]
      .reverse()
      .find(
        (message) =>
          message.role === 'assistant' &&
          message.status === 'error' &&
          !!message.serverError &&
          typeof message.serverError === 'object',
      )

    const serverErrorMessage =
      latestAssistantFailure &&
      typeof latestAssistantFailure.serverError === 'object' &&
      latestAssistantFailure.serverError !== null &&
      'message' in latestAssistantFailure.serverError &&
      typeof latestAssistantFailure.serverError.message === 'string'
        ? latestAssistantFailure.serverError.message
        : undefined

    setLocalError(
      new Error(
        serverErrorMessage ??
          getChatErrorMessage(ChatErrorCode.ModelNotAllowed),
      ),
    )
  }, [
    activeThreadId,
    error,
    localError,
    status,
    canonicalStoredMessages,
    storedMessagesResult.type,
    threadRow,
  ])

  const sendMessage = useCallback<ChatActionsContextValue['sendMessage']>(
    async ({ text, attachments, attachmentManifest }) => {
      const selectedModel = visibleModels.find(
        (model) => model.id === selectedModelIdRef.current,
      )
      if (selectedModel?.locked) {
        const message = selectedModel.minimumPlanId
          ? getLocalizedFeatureAccessGateMessage(selectedModel.minimumPlanId)
          : 'This model is available on paid plans only.'
        setLocalError(new Error(message))
        throw new Error(message)
      }
      if (
        attachments &&
        attachments.length > 0 &&
        !hasFeatureAccess('chat.fileUpload', accessContext)
      ) {
        const message = getLocalizedFeatureAccessGateMessage(
          uploadPermission.minimumPlanId,
        )
        setLocalError(new Error(message))
        throw new Error(message)
      }
      // Follow-up sends should not permit branch-snapshot shrink handling.
      allowShrinkOnNextBranchVersionRef.current = false
      let resolvedThreadId = threadIdRef.current
      if (!resolvedThreadId) {
        try {
          const inFlight =
            inFlightThreadRef.current ??
            (async () => {
              const newThreadId = crypto.randomUUID()
              emitOptimisticThreadCreated(newThreadId)
              branchVersionByThreadIdRef.current[newThreadId] = 1
              setThreadDisabledToolKeysById((current) => ({
                ...current,
                [newThreadId]: draftDisabledToolKeys,
              }))

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
        const creatingThread = createIfMissingRef.current
        const optimisticManifestEntry =
          attachmentManifest && attachmentManifest.length > 0
            ? {
                text,
                attachments: attachmentManifest,
              }
            : null
        if (optimisticManifestEntry) {
          pendingOptimisticAttachmentManifestsRef.current = [
            ...pendingOptimisticAttachmentManifestsRef.current,
            optimisticManifestEntry,
          ]
        }

        pendingAttachmentsRef.current = attachments
        await sendAIMessageRef.current({ text })
        createIfMissingRef.current = false
        if (creatingThread) {
          setDraftDisabledToolKeys([])
        }
        setLocalError(null)
        return
      } catch (sendError) {
        if (attachmentManifest && attachmentManifest.length > 0) {
          pendingOptimisticAttachmentManifestsRef.current =
            pendingOptimisticAttachmentManifestsRef.current.filter(
              (entry) =>
                !(
                  entry.text === text &&
                  entry.attachments === attachmentManifest
                ),
            )
        }
        pendingAttachmentsRef.current = undefined
        setLocalError(
          sendError instanceof Error
            ? sendError
            : new Error('Failed to send message'),
        )
        throw sendError
      }
    },
    [
      accessContext,
      draftDisabledToolKeys,
      navigate,
      uploadPermission.minimumPlanId,
      visibleModels,
    ],
  )

  const regenerateMessage = useCallback<
    ChatActionsContextValue['regenerateMessage']
  >(async (messageId) => {
    const currentStatus = statusRef.current
    const currentThreadId = activeThreadIdRef.current
    const currentMessages = messagesRef.current
    const currentStoredMessages = storedMessagesRef.current
    const currentStoredBranchSelectors = storedBranchSelectorsRef.current
    const currentThreadRow = threadRowRef.current

    if (
      !messageId ||
      currentStatus === 'submitted' ||
      currentStatus === 'streaming'
    ) {
      return
    }
    if (!currentThreadId) return
    const anchorMessageId = findRegenerationAnchorMessageId({
      messages: currentMessages,
      targetMessageId: messageId,
    })
    if (!anchorMessageId) return

    const targetMessage = currentMessages.find(
      (message) => message.id === messageId,
    )
    const existingSelector = currentStoredBranchSelectors[anchorMessageId]
    const currentAssistantId = findCurrentAssistantForAnchor({
      messages: currentMessages,
      anchorMessageId,
    })
    const selectedStoredAssistantId =
      currentThreadRow &&
      currentThreadRow.activeChildByParent &&
      typeof currentThreadRow.activeChildByParent === 'object' &&
      typeof currentThreadRow.activeChildByParent[anchorMessageId] === 'string'
        ? currentThreadRow.activeChildByParent[anchorMessageId]
        : undefined
    const storedAssistantChildren = currentStoredMessages
      .filter(
        (message) =>
          message.role === 'assistant' &&
          message.parentMessageId === anchorMessageId,
      )
      .slice()
      .sort((left, right) => {
        const leftBranch = left.branchIndex
        const rightBranch = right.branchIndex
        if (leftBranch !== rightBranch) return leftBranch - rightBranch
        return left.messageId.localeCompare(right.messageId)
      })
      .map((message) => message.messageId)
    const baseOptionIds = uniqueMessageIds([
      ...(existingSelector?.optionMessageIds ?? []),
      ...storedAssistantChildren,
      ...(selectedStoredAssistantId ? [selectedStoredAssistantId] : []),
      ...(targetMessage?.role === 'assistant' ? [targetMessage.id] : []),
      ...(currentAssistantId ? [currentAssistantId] : []),
    ])
    const placeholderMessageId = `${PENDING_REGEN_BRANCH_PREFIX}${anchorMessageId}:${Date.now()}`
    const pendingOptionIds = uniqueMessageIds([
      ...baseOptionIds,
      placeholderMessageId,
    ])

    const anchorIndex = currentMessages.findIndex(
      (message) => message.id === anchorMessageId,
    )
    const targetIndex = currentMessages.findIndex(
      (message) => message.id === messageId,
    )
    const truncateInclusiveIndex =
      targetMessage?.role === 'assistant' && targetIndex >= 0
        ? targetIndex
        : anchorIndex
    if (truncateInclusiveIndex >= 0) {
      // Regeneration forks from the anchor user, but the target message must
      // remain present for AI SDK regenerate(messageId) lookup. Keep the
      // target row (assistant/user) and prune only descendants.
      setMessagesRef.current(
        currentMessages.slice(0, truncateInclusiveIndex + 1),
      )
    }

    setPendingBranchSelector({
      anchorMessageId,
      parentMessageId: anchorMessageId,
      placeholderMessageId,
      optionMessageIds: pendingOptionIds,
      expectedOptionCount: pendingOptionIds.length,
    })
    // Regeneration now performs local deterministic truncation above, so we
    // do not need snapshot-shrink exceptions for this flow.
    allowShrinkOnNextBranchVersionRef.current = false
    setLocalError(null)
    try {
      await regenerateRef.current({ messageId })
    } catch (regenerateError) {
      setPendingBranchSelector(null)
      throw regenerateError
    }
  }, [])

  const editMessage = useCallback<ChatActionsContextValue['editMessage']>(
    async ({ messageId, editedText }) => {
      const currentStatus = statusRef.current
      const currentThreadId = activeThreadIdRef.current
      const currentMessages = messagesRef.current
      const currentStoredMessages = storedMessagesRef.current

      if (
        !messageId ||
        currentStatus === 'submitted' ||
        currentStatus === 'streaming'
      ) {
        return
      }
      if (!currentThreadId) return

      const normalizedText = editedText.trim()
      if (normalizedText.length === 0) {
        setLocalError(new Error('Message text cannot be empty.'))
        return
      }
      const targetMessage = currentMessages.find(
        (message) => message.id === messageId,
      )
      if (!targetMessage || targetMessage.role !== 'user') return

      const targetStoredRow = currentStoredMessages.find(
        (message) => message.messageId === messageId,
      )
      const parentMessageId =
        targetStoredRow &&
        typeof targetStoredRow.parentMessageId === 'string' &&
        targetStoredRow.parentMessageId.trim().length > 0
          ? targetStoredRow.parentMessageId
          : ROOT_BRANCH_PARENT_KEY
      const siblingUserIds = currentStoredMessages
        .filter((message) => {
          if (message.role !== 'user') return false
          const candidateParentId =
            typeof message.parentMessageId === 'string' &&
            message.parentMessageId.trim().length > 0
              ? message.parentMessageId
              : ROOT_BRANCH_PARENT_KEY
          return candidateParentId === parentMessageId
        })
        .slice()
        .sort((left, right) => {
          const leftBranch = left.branchIndex
          const rightBranch = right.branchIndex
          if (leftBranch !== rightBranch) return leftBranch - rightBranch
          return left.messageId.localeCompare(right.messageId)
        })
        .map((message) => message.messageId)

      const placeholderMessageId = `${PENDING_EDIT_BRANCH_PREFIX}${messageId}:${Date.now()}`
      const pendingOptionIds = uniqueMessageIds([
        ...siblingUserIds,
        messageId,
        placeholderMessageId,
      ])
      setPendingBranchSelector({
        anchorMessageId: messageId,
        parentMessageId,
        placeholderMessageId,
        optionMessageIds: pendingOptionIds,
        expectedOptionCount: pendingOptionIds.length,
      })

      const targetIndex = currentMessages.findIndex(
        (message) => message.id === messageId,
      )
      if (targetIndex >= 0) {
        const truncatedMessages = currentMessages.slice(0, targetIndex + 1)
        const target = truncatedMessages[targetIndex]
        if (target && target.role === 'user') {
          truncatedMessages[targetIndex] = {
            ...target,
            parts: target.parts.map((part) =>
              part.type === 'text' ? { ...part, text: normalizedText } : part,
            ),
          }
        }
        setMessagesRef.current(truncatedMessages)
      }

      allowShrinkOnNextBranchVersionRef.current = false
      setLocalError(null)
      try {
        await regenerateRef.current({
          messageId,
          body: {
            trigger: 'edit-message',
            messageId,
            editedText: normalizedText,
          },
        })
      } catch (editError) {
        setPendingBranchSelector(null)
        throw editError
      }
    },
    [],
  )

  const selectBranchVersion = useCallback<
    ChatActionsContextValue['selectBranchVersion']
  >(
    async ({ parentMessageId, childMessageId }) => {
      const currentThreadId = activeThreadIdRef.current
      const currentStatus = statusRef.current

      if (!currentThreadId) return
      if (currentStatus === 'submitted' || currentStatus === 'streaming') return
      if (!parentMessageId || !childMessageId) return

      // Explicit branch selection can legitimately switch to shorter history.
      allowShrinkOnNextBranchVersionRef.current = true
      const expectedBranchVersion =
        branchVersionByThreadIdRef.current[currentThreadId] ?? 1
      try {
        await z.mutate(
          mutators.threads.selectBranchChild({
            threadId: currentThreadId,
            parentMessageId,
            childMessageId,
            expectedBranchVersion,
          }),
        ).client
        // Keep transport CAS version in sync immediately after local mutation,
        // even if query propagation to `threadRow` lags one render.
        branchVersionByThreadIdRef.current[currentThreadId] =
          expectedBranchVersion + 1
        let nextSelections: Record<string, string> | null = null
        setOptimisticBranchStateByThreadId((current) => {
          const previous = current[currentThreadId]
          const baseSelections =
            previous?.activeChildByParent ??
            normalizeActiveChildByParent(
              threadRowRef.current?.activeChildByParent,
            )
          nextSelections = {
            ...baseSelections,
            [parentMessageId]: childMessageId,
          }
          return {
            ...current,
            [currentThreadId]: {
              activeChildByParent: nextSelections,
              branchVersion: expectedBranchVersion + 1,
            },
          }
        })
        if (nextSelections) {
          setMessagesRef.current(
            buildCanonicalUIMessageSnapshot({
              storedMessages: storedMessagesRef.current,
              activeChildByParent: nextSelections,
            }),
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('branch_switch_while_generating')) {
          setLocalError(
            new Error(
              'Please wait until the current response finishes before switching branches.',
            ),
          )
          return
        }
        setLocalError(
          new Error(
            'This chat changed in another tab or session. Refresh and try again.',
          ),
        )
      }
    },
    [z],
  )

  const revealMessageBranch = useCallback<
    ChatActionsContextValue['revealMessageBranch']
  >(
    async ({ messageId }) => {
      const currentThreadId = activeThreadIdRef.current
      const currentStatus = statusRef.current
      const currentThreadRow = threadRowRef.current
      const currentStoredMessages = storedMessagesRef.current

      if (!currentThreadId) return false
      if (currentStatus === 'submitted' || currentStatus === 'streaming') {
        return false
      }
      if (
        !currentThreadRow ||
        typeof currentThreadRow !== 'object' ||
        currentThreadRow.threadId !== currentThreadId
      ) {
        return false
      }

      const requiredSelections = resolveBranchSelectionPath(
        currentStoredMessages.map((message) => ({
          messageId: message.messageId,
          role: message.role,
          parentMessageId: message.parentMessageId ?? undefined,
          branchIndex: message.branchIndex,
          createdAt: message.created_at,
        })),
        currentThreadRow.activeChildByParent,
        messageId,
      )
      if (!requiredSelections) {
        return false
      }
      if (requiredSelections.length === 0) {
        return true
      }

      // Search reveal may target a hidden branch path. Activate the full
      // root->leaf selection set in one CAS-protected mutator so deeply nested
      // paths do not require multiple round trips or partial branch updates.
      allowShrinkOnNextBranchVersionRef.current = true
      const expectedBranchVersion =
        branchVersionByThreadIdRef.current[currentThreadId] ??
        (typeof currentThreadRow.branchVersion === 'number'
          ? currentThreadRow.branchVersion
          : 1)
      const optimisticSelections = {
        ...normalizeActiveChildByParent(currentThreadRow.activeChildByParent),
      }
      for (const selection of requiredSelections) {
        optimisticSelections[selection.parentMessageId] =
          selection.childMessageId
      }
      const nextBranchVersion = expectedBranchVersion + 1

      try {
        await z.mutate(
          mutators.threads.activateBranchPath({
            threadId: currentThreadId,
            selections: [...requiredSelections],
            expectedBranchVersion,
          }),
        ).client

        branchVersionByThreadIdRef.current[currentThreadId] = nextBranchVersion
        setOptimisticBranchStateByThreadId((current) => ({
          ...current,
          [currentThreadId]: {
            activeChildByParent: optimisticSelections,
            branchVersion: nextBranchVersion,
          },
        }))
        setMessagesRef.current(
          buildCanonicalUIMessageSnapshot({
            storedMessages: currentStoredMessages,
            activeChildByParent: optimisticSelections,
          }),
        )
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('branch_switch_while_generating')) {
          setLocalError(
            new Error(
              'Please wait until the current response finishes before switching branches.',
            ),
          )
          return false
        }
        setLocalError(
          new Error(
            'This chat changed in another tab or session. Refresh and try again.',
          ),
        )
        return false
      }
    },
    [z],
  )

  const clear = useCallback(() => {
    setDraftDisabledToolKeys([])
    setMessages([])
  }, [setMessages])
  const setModelSelection = useCallback(
    (modelId: string) => {
      const nextModel = selectableModels.find((model) => model.id === modelId)
      if (!nextModel) return
      setSelectedModelId(nextModel.id)
      setSelectedReasoningEffort(nextModel.defaultReasoningEffort)
    },
    [selectableModels],
  )
  const setReasoningSelection = useCallback(
    (reasoningEffort?: AiReasoningEffort) => {
      const model = selectableModels.find(
        (entry) => entry.id === selectedModelId,
      )
      if (!model) return
      if (!reasoningEffort) {
        setSelectedReasoningEffort(undefined)
        return
      }
      if (!model.reasoningEfforts.includes(reasoningEffort)) return
      setSelectedReasoningEffort(reasoningEffort)
    },
    [selectableModels, selectedModelId],
  )
  const setModeSelection = useCallback(
    async (modeId?: ChatModeId) => {
      if (!activeThreadId) return
      if (orgEnforcedModeId) return
      await z.mutate(
        mutators.threads.setMode({
          threadId: activeThreadId,
          modeId: modeId ?? null,
        }),
      ).client
    },
    [activeThreadId, orgEnforcedModeId, z],
  )
  const setThreadDisabledToolKeys = useCallback(
    async (nextDisabledToolKeys: readonly string[]) => {
      const normalizedDisabledToolKeys = [...new Set(nextDisabledToolKeys)]
      if (!activeThreadId) {
        setDraftDisabledToolKeys(normalizedDisabledToolKeys)
        return
      }
      setThreadDisabledToolKeysById((current) => ({
        ...current,
        [activeThreadId]: normalizedDisabledToolKeys,
      }))

      try {
        await z.mutate(
          mutators.threads.setDisabledToolKeys({
            threadId: activeThreadId,
            disabledToolKeys: normalizedDisabledToolKeys,
          }),
        ).client
      } catch (toolError) {
        const fallbackDisabledToolKeys =
          threadRowRef.current &&
          typeof threadRowRef.current === 'object' &&
          'disabledToolKeys' in threadRowRef.current &&
          Array.isArray(threadRowRef.current.disabledToolKeys)
            ? threadRowRef.current.disabledToolKeys
            : []
        setThreadDisabledToolKeysById((current) => ({
          ...current,
          [activeThreadId]: fallbackDisabledToolKeys,
        }))
        setLocalError(
          toolError instanceof Error
            ? toolError
            : new Error('Failed to update thread tools'),
        )
      }
    },
    [activeThreadId, z],
  )

  const messagesValue = useMemo<ChatMessagesContextValue>(
    () => ({
      messages,
      status,
      activeThreadId,
      hasHydratedActiveThread,
      branchSelectorsByAnchorMessageId,
      branchUsage,
      branchCost,
      showBranchCost,
    }),
    [
      messages,
      status,
      activeThreadId,
      hasHydratedActiveThread,
      branchSelectorsByAnchorMessageId,
      branchUsage,
      branchCost,
      showBranchCost,
    ],
  )

  const composerValue = useMemo<ChatComposerContextValue>(
    () => ({
      status,
      error: localError ?? error,
      sendMessage,
      activeThreadId,
      selectedModelId,
      selectedReasoningEffort,
      selectedModeId: effectiveModeId,
      isModeEnforced,
      selectableModels,
      visibleModels,
      setSelectedModelId: setModelSelection,
      setSelectedReasoningEffort: setReasoningSelection,
      setSelectedModeId: setModeSelection,
      visibleTools,
      disabledToolKeys: threadDisabledToolKeys,
      setThreadDisabledToolKeys,
      canUploadFiles: hasFeatureAccess('chat.fileUpload', accessContext),
      uploadUpgradeCallout: getLocalizedFeatureAccessGateMessage(
        uploadPermission.minimumPlanId,
      ),
    }),
    [
      status,
      error,
      localError,
      sendMessage,
      activeThreadId,
      selectedModelId,
      selectedReasoningEffort,
      effectiveModeId,
      isModeEnforced,
      selectableModels,
      visibleModels,
      setModelSelection,
      setReasoningSelection,
      setModeSelection,
      visibleTools,
      threadDisabledToolKeys,
      setThreadDisabledToolKeys,
      accessContext,
      uploadPermission.minimumPlanId,
    ],
  )

  const messageActionsValue = useMemo<ChatMessageActionsContextValue>(
    () => ({
      status,
      regenerate,
      regenerateMessage,
      editMessage,
      selectBranchVersion,
      revealMessageBranch,
      setMessages,
      resumeStream,
      clear,
    }),
    [
      status,
      regenerate,
      regenerateMessage,
      editMessage,
      selectBranchVersion,
      revealMessageBranch,
      setMessages,
      resumeStream,
      clear,
    ],
  )

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
