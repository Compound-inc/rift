// Renders writing chat messages with the same pinned-scroll behavior as `/chat`.
'use client'

import { memo, useMemo } from 'react'
import type { RefObject } from 'react'
import type { UIMessage } from 'ai'
import { useChatMessages } from '@/components/chat'
import { ChatMessage } from '@/components/chat/chat-message'
import { usePinToLastUserMessage } from '@rift/chat-scroll'

type WritingChatThreadMessageRowProps = {
  readonly message: UIMessage
  readonly lastUserMessageId: string | null
  readonly lastMessageId?: string
  readonly isStreaming: boolean
  readonly lastUserMessageRef: RefObject<HTMLDivElement | null>
}

const WritingChatThreadMessageRow = memo(function WritingChatThreadMessageRow({
  message,
  lastUserMessageId,
  lastMessageId,
  isStreaming,
  lastUserMessageRef,
}: WritingChatThreadMessageRowProps) {
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
        canRegenerate={false}
        canEdit={false}
        onRegenerate={() => undefined}
        onEdit={async () => undefined}
      />
    </div>
  )
})

/**
 * Writing currently supports linear project chats only, but the message list
 * still reuses the same pinned-scroll contract as the main chat surface so the
 * interaction feels identical while the backend catches up on advanced actions.
 */
export function WritingChatThread() {
  const { messages, status, activeThreadId } = useChatMessages()
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
      disableInitialAlignment: false,
      messages,
      status,
    })

  const isStreaming = status === 'submitted'
  const lastMessageId = messages.at(-1)?.id

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-full w-full flex-col px-3 py-4 md:px-4 md:py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-6" />
        <div ref={contentEndRef} className="h-0 w-full shrink-0" />
        <div ref={spacerRef} className="h-0 w-full shrink-0" />
        <div ref={bottomRef} className="h-px w-full shrink-0" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-full w-full flex-col px-3 py-4 md:px-4 md:py-5">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-6">
        {messages.map((message) => (
          <WritingChatThreadMessageRow
            key={message.id}
            message={message}
            lastUserMessageId={lastUserMessageId}
            lastMessageId={lastMessageId}
            isStreaming={isStreaming}
            lastUserMessageRef={lastUserMessageRef}
          />
        ))}
        <div ref={contentEndRef} className="h-0 w-full shrink-0" />
      </div>
      <div ref={spacerRef} className="h-0 w-full shrink-0" />
      <div ref={bottomRef} className="h-px w-full shrink-0" />
    </div>
  )
}
