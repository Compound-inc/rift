// Renders writing messages and live PI tool execution
'use client'

import { memo, useMemo } from 'react'
import type { RefObject } from 'react'
import { usePinToLastUserMessage } from '@rift/chat-scroll'
import type { AgentToolExecutionState, AgentRenderableMessage } from '@/lib/shared/agent'
import { useWritingChat } from './writing-chat-context'
import { WritingMessage } from './writing-message'
import { WritingToolCallLine } from './message-parts'

type WritingChatThreadMessageRowProps = {
  readonly message: AgentRenderableMessage
  readonly lastUserMessageId: string | null
  readonly lastUserMessageRef: RefObject<HTMLDivElement | null>
}

const WritingChatThreadMessageRow = memo(function WritingChatThreadMessageRow({
  message,
  lastUserMessageId,
  lastUserMessageRef,
}: WritingChatThreadMessageRowProps) {
  const isLastUserMessage =
    message.role === 'user' &&
    lastUserMessageId != null &&
    message.id === lastUserMessageId

  return (
    <div
      className="mx-auto w-full max-w-2xl"
      ref={isLastUserMessage ? lastUserMessageRef : undefined}
    >
      <WritingMessage message={message} />
    </div>
  )
})

function RunningToolCalls({
  toolCalls,
}: {
  readonly toolCalls: readonly AgentToolExecutionState[]
}) {
  if (toolCalls.length === 0) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-1 pt-2">
      {toolCalls.map((toolCall) => (
        <WritingToolCallLine
          key={toolCall.toolCallId}
          toolCall={{
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.args,
            status: toolCall.status,
            isError: Boolean(toolCall.isError),
          }}
        />
      ))}
    </div>
  )
}

function CompletedToolCalls({
  toolCalls,
}: {
  readonly toolCalls: readonly AgentToolExecutionState[]
}) {
  if (toolCalls.length === 0) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-1 pt-2">
      {toolCalls.map((toolCall) => (
        <WritingToolCallLine
          key={toolCall.toolCallId}
          toolCall={{
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.args,
            status: 'completed',
            isError: Boolean(toolCall.isError),
          }}
        />
      ))}
    </div>
  )
}

export function WritingChatThread() {
  const { messages, liveTurn, status, activeConversationId } = useWritingChat()
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
      resetKey: activeConversationId,
      userMessageCount,
      lastUserMessageId,
      disableInitialAlignment: false,
      messages: messages as any,
      status,
    })

  const runningToolCalls = useMemo(
    () =>
      [...liveTurn.pendingToolCalls.values()].filter(
        (toolCall) => toolCall.status === 'running',
      ),
    [liveTurn.pendingToolCalls],
  )
  const completedToolCalls = useMemo(
    () =>
      [...liveTurn.toolResultsById.values()].map((toolResult) => ({
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
        args: toolResult.args,
        status: 'completed' as const,
        isError: toolResult.isError,
      })),
    [liveTurn.toolResultsById],
  )

  if (
    messages.length === 0 &&
    runningToolCalls.length === 0 &&
    completedToolCalls.length === 0
  ) {
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
            lastUserMessageRef={lastUserMessageRef}
          />
        ))}
        <RunningToolCalls toolCalls={runningToolCalls} />
        <CompletedToolCalls toolCalls={completedToolCalls} />
        <div ref={contentEndRef} className="h-0 w-full shrink-0" />
      </div>
      <div ref={spacerRef} className="h-0 w-full shrink-0" />
      <div ref={bottomRef} className="h-px w-full shrink-0" />
    </div>
  )
}
