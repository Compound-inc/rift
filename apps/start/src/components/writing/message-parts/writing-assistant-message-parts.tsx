'use client'

import { Streamdown } from 'streamdown'
import type { AgentMessagePart } from '@/lib/shared/agent'
import { WritingToolCallLine } from './writing-tool-call-line'

function getText(parts: readonly AgentMessagePart[]): string {
  return parts
    .filter((part): part is Extract<AgentMessagePart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
    .trim()
}

/**
 * Writing owns its assistant-part renderer so PI-native message blocks can grow
 * independently from `/chat`. The renderer stays close to PI's mental model:
 * assistant text, thinking-capable blocks, and inline tool-call rows rendered
 * from the canonical agent message parts.
 */
export function WritingAssistantMessageParts({
  parts,
}: {
  readonly parts: readonly AgentMessagePart[]
}) {
  const toolCalls = parts.filter(
    (part): part is Extract<AgentMessagePart, { type: 'tool_call' }> =>
      part.type === 'tool_call',
  )
  const text = getText(parts)

  return (
    <div className="space-y-2">
      {toolCalls.length > 0 ? (
        <div className="space-y-1">
          {toolCalls.map((toolCall) => (
            <WritingToolCallLine
              key={toolCall.id}
              toolCall={{
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                args: toolCall.arguments,
                status: 'completed',
                isError: false,
              }}
            />
          ))}
        </div>
      ) : null}

      {text.length > 0 ? (
        <Streamdown
          controls={false}
          mode="static"
          className="chat-streamdown min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        >
          {text}
        </Streamdown>
      ) : null}
    </div>
  )
}
