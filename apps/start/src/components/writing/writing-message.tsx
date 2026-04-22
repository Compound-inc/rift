'use client'

import { useMemo } from 'react'
import { Streamdown } from 'streamdown'
import { useDirection } from '@rift/ui/direction'
import type { AgentMessagePart, AgentRenderableMessage } from '@/lib/shared/agent'
import {
  WritingAssistantMessageParts,
  WritingToolCallLine,
} from './message-parts'

function getRawMessageText(parts: readonly AgentMessagePart[]): string {
  return parts
    .filter((part): part is Extract<AgentMessagePart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
    .trim()
}

function WritingToolResultMessage({
  message,
}: {
  readonly message: AgentRenderableMessage
}) {
  const text = getRawMessageText(message.parts)

  return (
    <div className="space-y-1">
      <WritingToolCallLine
        toolCall={{
          toolCallId: message.toolCallId ?? message.id,
          toolName: message.toolName ?? 'tool_result',
          args: {},
          status: 'completed',
          isError: Boolean(message.isError),
        }}
      />
      {text.length > 0 ? (
        <div className="pl-6 text-sm text-foreground-secondary">
          <Streamdown
            controls={false}
            mode="static"
            className="chat-streamdown min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          >
            {text}
          </Streamdown>
        </div>
      ) : null}
    </div>
  )
}

export function WritingMessage({
  message,
}: {
  readonly message: AgentRenderableMessage
}) {
  const direction = useDirection()
  const isUser = message.role === 'user'
  const text = useMemo(() => getRawMessageText(message.parts), [message.parts])

  if (isUser) {
    return (
      <div
        className="group flex w-full scroll-mt-24 items-end justify-end gap-2 pt-8 pb-1"
        data-role={message.role}
        data-message-id={message.id}
        id={`writing-message-${message.id}`}
      >
        <div
          dir={direction}
          className="relative flex min-h-7 max-w-[80%] flex-col gap-3 overflow-hidden rounded-3xl border border-border-base bg-surface-overlay px-4 py-1.5 text-md ltr:rounded-br-lg rtl:rounded-bl-lg"
        >
          <div className="whitespace-pre-wrap break-words text-md leading-7">
            {text || '\u00a0'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group flex w-full scroll-mt-24 items-end gap-2 py-1"
      data-role={message.role}
      data-message-id={message.id}
      id={`writing-message-${message.id}`}
    >
      <div
        dir={direction}
        className="flex w-full flex-col gap-3 overflow-hidden rounded-2xl px-2 py-1 text-foreground-strong leading-[21px]"
      >
        {message.role === 'tool_result' ? (
          <WritingToolResultMessage message={message} />
        ) : (
          <WritingAssistantMessageParts parts={message.parts} />
        )}
      </div>
    </div>
  )
}
