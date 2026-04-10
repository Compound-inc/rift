// Renders chat messages and keeps scroll pinned to the latest user message.
import { memo, useCallback, useMemo } from 'react'
import type { RefObject } from 'react'
import { isReasoningUIPart } from 'ai'
import type { UIMessage } from 'ai'
import { useChatMessageActions, useChatMessages } from './chat-context'
import { ChatMessage } from './chat-message'
import { usePinToLastUserMessage } from '@rift/chat-scroll'
import { ChatWelcomeScreen } from './chat-welcome-screen'
import { setComposerDraft } from './composer-draft-store'
import { ReasoningMotionIcon } from './message-parts/components/reasoning-motion-icon'
import { useChatSearchReveal } from './use-chat-search-reveal'
import { m } from '@/paraglide/messages.js'

type BranchSelectorState = {
  parentMessageId: string
  optionMessageIds: readonly string[]
  selectedMessageId: string
}

type ChatThreadMessageRowProps = {
  message: UIMessage
  lastUserMessageId: string | null
  lastMessageId?: string
  isStreaming: boolean
  lastUserMessageRef: RefObject<HTMLDivElement | null>
  branchSelector?: BranchSelectorState
  onRegenerate: (messageId: string) => void
  onEdit: (input: { messageId: string; editedText: string }) => Promise<void>
  onSelectBranchVersion: (input: {
    parentMessageId: string
    childMessageId: string
  }) => Promise<void>
}

function areBranchSelectorsEqual(
  previous?: BranchSelectorState,
  next?: BranchSelectorState,
): boolean {
  if (previous === next) return true
  if (!previous || !next) return previous == null && next == null
  if (previous.parentMessageId !== next.parentMessageId) return false
  if (previous.selectedMessageId !== next.selectedMessageId) return false
  if (previous.optionMessageIds.length !== next.optionMessageIds.length)
    return false
  for (let index = 0; index < previous.optionMessageIds.length; index += 1) {
    if (previous.optionMessageIds[index] !== next.optionMessageIds[index]) {
      return false
    }
  }
  return true
}

const ChatThreadMessageRow = memo(function ChatThreadMessageRow({
  message,
  lastUserMessageId,
  lastMessageId,
  isStreaming,
  lastUserMessageRef,
  branchSelector,
  onRegenerate,
  onEdit,
  onSelectBranchVersion,
}: ChatThreadMessageRowProps) {
  const isLastUserMessage =
    message.role === 'user' &&
    lastUserMessageId != null &&
    message.id === lastUserMessageId
  const isAnimatingMessage =
    isStreaming && lastMessageId === message.id && message.role === 'assistant'

  return (
    <div
      className="mx-auto w-full max-w-2xl"
      ref={isLastUserMessage ? lastUserMessageRef : undefined}
    >
      <ChatMessage
        message={message}
        isAnimating={isAnimatingMessage}
        canRegenerate={!isStreaming}
        canEdit={!isStreaming}
        onRegenerate={onRegenerate}
        onEdit={onEdit}
        branchSelector={
          message.role === 'user' && branchSelector
            ? {
                parentMessageId: branchSelector.parentMessageId,
                optionMessageIds: branchSelector.optionMessageIds,
                selectedMessageId: branchSelector.selectedMessageId,
                disabled: isStreaming,
                onSelectMessageId: (childMessageId: string) => {
                  void onSelectBranchVersion({
                    parentMessageId: branchSelector.parentMessageId,
                    childMessageId,
                  })
                },
              }
            : undefined
        }
      />
    </div>
  )
}, areChatThreadMessageRowPropsEqual)

function areChatThreadMessageRowPropsEqual(
  previous: ChatThreadMessageRowProps,
  next: ChatThreadMessageRowProps,
): boolean {
  return (
    previous.message === next.message &&
    previous.lastUserMessageId === next.lastUserMessageId &&
    previous.lastMessageId === next.lastMessageId &&
    previous.isStreaming === next.isStreaming &&
    previous.lastUserMessageRef === next.lastUserMessageRef &&
    previous.onRegenerate === next.onRegenerate &&
    previous.onEdit === next.onEdit &&
    previous.onSelectBranchVersion === next.onSelectBranchVersion &&
    areBranchSelectorsEqual(previous.branchSelector, next.branchSelector)
  )
}

function hasVisibleAssistantContent(message: UIMessage | undefined): boolean {
  if (!message || message.role !== 'assistant') return false

  return message.parts.some((part) => {
    if (part.type === 'text') return part.text.trim().length > 0
    if (isReasoningUIPart(part)) return part.text.trim().length > 0
    return true
  })
}

export function ChatThread() {
  const {
    messages,
    status,
    activeThreadId,
    hasHydratedActiveThread,
    branchSelectorsByAnchorMessageId,
  } = useChatMessages()
  const {
    regenerateMessage,
    editMessage,
    selectBranchVersion,
    revealMessageBranch,
  } = useChatMessageActions()
  const { disableInitialAlignment } = useChatSearchReveal({
    activeThreadId,
    canResolveReveal: hasHydratedActiveThread,
    messages,
    revealMessageBranch,
  })
  const { userMessageCount, lastUserMessageId } = useMemo(() => {
    let count = 0
    let lastUserId: string | null = null

    for (const message of messages) {
      if (message.role !== 'user') continue
      count += 1
      lastUserId = message.id
    }

    return { userMessageCount: count, lastUserMessageId: lastUserId }
  }, [messages])

  const { lastUserMessageRef, contentEndRef, spacerRef, bottomRef } =
    usePinToLastUserMessage({
      resetKey: activeThreadId,
      userMessageCount,
      lastUserMessageId,
      disableInitialAlignment,
      messages,
      status,
    })

  const isStreaming = status === 'submitted' || status === 'streaming'
  const lastMessage = messages.at(-1)
  const lastAssistantMessage =
    lastMessage?.role === 'assistant' ? lastMessage : undefined
  const showThinking =
    isStreaming && !hasVisibleAssistantContent(lastAssistantMessage)

  const handleSuggestionClick = useCallback((prompt: string) => {
    setComposerDraft(prompt)
  }, [])

  const findScrollParent = useCallback((node: HTMLElement | null) => {
    let current: HTMLElement | null = node?.parentElement ?? null
    while (current) {
      const style = window.getComputedStyle(current)
      const overflowY = style.overflowY
      const isScrollableOverflow =
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowY === 'overlay'
      if (isScrollableOverflow && current.scrollHeight > current.clientHeight) {
        return current
      }
      current = current.parentElement
    }
    return null
  }, [])

  const regenerateWithoutScrollShift = useCallback(
    (messageId: string) => {
      const scrollParent = findScrollParent(contentEndRef.current)
      const preservedScrollTop = scrollParent?.scrollTop

      void regenerateMessage(messageId)

      if (!scrollParent || preservedScrollTop == null) return
      requestAnimationFrame(() => {
        scrollParent.scrollTop = preservedScrollTop
        requestAnimationFrame(() => {
          scrollParent.scrollTop = preservedScrollTop
        })
      })
    },
    [contentEndRef, findScrollParent, regenerateMessage],
  )

  const editWithoutScrollShift = useCallback(
    async (input: { messageId: string; editedText: string }) => {
      const scrollParent = findScrollParent(contentEndRef.current)
      const preservedScrollTop = scrollParent?.scrollTop

      const editPromise = editMessage(input)

      if (!scrollParent || preservedScrollTop == null) {
        await editPromise
        return
      }
      requestAnimationFrame(() => {
        scrollParent.scrollTop = preservedScrollTop
        requestAnimationFrame(() => {
          scrollParent.scrollTop = preservedScrollTop
        })
      })
      await editPromise
    },
    [contentEndRef, editMessage, findScrollParent],
  )

  const selectBranchVersionWithoutScrollShift = useCallback(
    async (input: { parentMessageId: string; childMessageId: string }) => {
      const scrollParent = findScrollParent(contentEndRef.current)
      const preservedScrollTop = scrollParent?.scrollTop

      if (!scrollParent || preservedScrollTop == null) {
        await selectBranchVersion(input)
        return
      }

      const restoreScroll = () => {
        requestAnimationFrame(() => {
          scrollParent.scrollTop = preservedScrollTop
          requestAnimationFrame(() => {
            scrollParent.scrollTop = preservedScrollTop
          })
        })
      }

      // Restore immediately to absorb synchronous layout changes.
      restoreScroll()
      await selectBranchVersion(input)
      // Restore again after branch mutation settles to avoid auto-pin jumps.
      restoreScroll()
    },
    [contentEndRef, findScrollParent, selectBranchVersion],
  )

  return (
    <div
      className="flex h-full min-h-full w-full flex-col"
      role="log"
      aria-live="polite"
      aria-label={m.chat_thread_messages_aria_label()}
    >
      {messages.length === 0 && !activeThreadId && (
        <>
          <div className="relative z-10 flex h-full min-h-0 w-full flex-1 items-center justify-center px-4 py-9">
            <div className="mx-auto flex w-full max-w-2xl translate-y-10 items-center md:translate-y-12">
              <ChatWelcomeScreen
                onSuggestionClick={handleSuggestionClick}
                disabled={isStreaming}
              />
            </div>
          </div>
        </>
      )}
      {messages.map((m) => {
        const hidePendingAssistantShell =
          isStreaming &&
          m.id === lastAssistantMessage?.id &&
          !hasVisibleAssistantContent(lastAssistantMessage)

        if (hidePendingAssistantShell) return null

        return (
          <ChatThreadMessageRow
            key={m.id}
            message={m}
            lastUserMessageId={lastUserMessageId}
            lastMessageId={lastMessage?.id}
            isStreaming={isStreaming}
            lastUserMessageRef={lastUserMessageRef}
            branchSelector={
              m.role === 'user'
                ? branchSelectorsByAnchorMessageId[m.id]
                : undefined
            }
            onRegenerate={regenerateWithoutScrollShift}
            onEdit={editWithoutScrollShift}
            onSelectBranchVersion={selectBranchVersionWithoutScrollShift}
          />
        )
      })}
      {showThinking && (
        <div
          className="group mx-auto flex w-full max-w-2xl items-end gap-2 py-1 is-assistant"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex w-full flex-col gap-3 overflow-hidden text-foreground-strong text-md leading-[21px]">
            <div className="w-full">
              <div className="py-1">
                <ReasoningMotionIcon
                  isAnimating
                  size={36}
                  className="flex size-9 items-center justify-center"
                  aria-hidden="true"
                />
              </div>
            </div>
            {/*
             */}
            <div aria-hidden className="h-8" />
          </div>
        </div>
      )}
      <div ref={contentEndRef} aria-hidden style={{ height: 0 }} />
      <div ref={spacerRef} aria-hidden style={{ height: 0 }} />
      <div ref={bottomRef} />
    </div>
  )
}
