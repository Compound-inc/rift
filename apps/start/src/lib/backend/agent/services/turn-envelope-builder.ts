import type { AgentMessage } from '@mariozechner/pi-agent-core'
import type {
  AssistantMessage,
  AssistantMessageEvent,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from '@mariozechner/pi-ai'
import type { AgentLiveEvent, AgentMessageEnvelope, AgentMessagePart, AgentToolResultEnvelope, AgentTurnEnvelope, AgentTurnStatus } from '@/lib/shared/agent'
import type { AgentConversationRecord } from '../types'

function textPart(text: string): AgentMessagePart {
  return { type: 'text', text }
}

function convertPiToolCall(toolCall: ToolCall): Extract<AgentMessagePart, { type: 'tool_call' }> {
  return {
    type: 'tool_call',
    id: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments ?? {},
  }
}

function convertAssistantParts(message: AssistantMessage): readonly AgentMessagePart[] {
  return message.content.map((part) => {
    switch (part.type) {
      case 'text':
        return textPart(part.text)
      case 'thinking':
        return {
          type: 'thinking',
          thinking: part.thinking,
          signature: part.thinkingSignature,
          redacted: part.redacted,
        }
      case 'toolCall':
        return convertPiToolCall(part)
      default:
        return textPart('')
    }
  })
}

function convertToolResultParts(
  parts: ToolResultMessage['content'],
): readonly AgentMessagePart[] {
  return parts.map((part) =>
    part.type === 'image'
      ? { type: 'image', data: part.data, mimeType: part.mimeType }
      : textPart(part.text),
  )
}

function getStableMessageId(input: {
  readonly turnId: string
  readonly message: AgentMessage
  readonly roleIndex: number
}): string {
  if (input.message.role === 'toolResult') {
    return `${input.turnId}:tool_result:${input.message.toolCallId}:${input.roleIndex}`
  }

  return `${input.turnId}:${input.message.role}:${input.roleIndex}`
}

function convertUserMessage(
  message: UserMessage,
  messageId: string,
): AgentMessageEnvelope {
  const text =
    typeof message.content === 'string'
      ? message.content
      : message.content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n\n')

  return {
    id: messageId,
    role: 'user',
    parts: [textPart(text)],
    createdAt: message.timestamp,
  }
}

export function convertAgentMessageToEnvelope(input: {
  readonly turnId: string
  readonly roleIndex: number
  readonly message: AgentMessage
}): AgentMessageEnvelope | null {
  const messageId = getStableMessageId(input)
  const timestamp =
    'timestamp' in input.message && typeof input.message.timestamp === 'number'
      ? input.message.timestamp
      : Date.now()

  if (input.message.role === 'user') {
    return convertUserMessage(input.message, messageId)
  }

  if (input.message.role === 'assistant') {
    return {
      id: messageId,
      role: 'assistant',
      parts: convertAssistantParts(input.message),
      createdAt: timestamp,
      providerMetadata: {
        api: input.message.api,
        provider: input.message.provider,
        model: input.message.model,
      },
      usage: input.message.usage as unknown as Record<string, unknown>,
    }
  }

  if (input.message.role === 'toolResult') {
    return {
      id: messageId,
      role: 'tool_result',
      parts: convertToolResultParts(input.message.content),
      createdAt: timestamp,
      toolCallId: input.message.toolCallId,
      toolName: input.message.toolName,
      isError: input.message.isError,
    }
  }

  return null
}

export class AgentTurnEnvelopeBuilder {
  private envelope: AgentTurnEnvelope
  private readonly turnId: string

  constructor(input: {
    readonly conversation: AgentConversationRecord
    readonly turnId: string
    readonly turnIndex: number
    readonly startedAt: number
  }) {
    this.turnId = input.turnId
    this.envelope = {
      version: 'pi_turn_v1',
      runtime: 'pi',
      conversation: {
        id: input.conversation.id,
        product: input.conversation.product,
        scopeType: input.conversation.scopeType,
        scopeId: input.conversation.scopeId,
      },
      turnId: input.turnId,
      turnIndex: input.turnIndex,
      messages: [],
      toolCalls: [],
      toolResults: [],
      liveEventLog: [],
      stateTransitions: [{ status: 'pending', timestamp: input.startedAt }],
      startedAt: input.startedAt,
      finalStatus: 'pending',
    }
  }

  get snapshot(): AgentTurnEnvelope {
    return this.envelope
  }

  transition(status: AgentTurnStatus, timestamp: number) {
    this.envelope = {
      ...this.envelope,
      finalStatus: status,
      stateTransitions: [
        ...this.envelope.stateTransitions,
        { status, timestamp },
      ],
      ...(status === 'completed' ||
      status === 'failed' ||
      status === 'aborted'
        ? { completedAt: timestamp }
        : {}),
    }
  }

  pushEvent(event: AgentLiveEvent) {
    const previous = this.envelope.liveEventLog.at(-1)
    if (
      previous?.type === 'message_updated' &&
      event.type === 'message_updated' &&
      previous.payload.messageId === event.payload.messageId &&
      previous.payload.deltaType === event.payload.deltaType &&
      typeof previous.payload.delta === 'string' &&
      typeof event.payload.delta === 'string'
    ) {
      const next = [...this.envelope.liveEventLog]
      next[next.length - 1] = {
        ...previous,
        sequence: event.sequence,
        timestamp: event.timestamp,
        payload: {
          ...previous.payload,
          delta: previous.payload.delta + event.payload.delta,
        },
      }
      this.envelope = {
        ...this.envelope,
        liveEventLog: next,
      }
      return
    }

    this.envelope = {
      ...this.envelope,
      liveEventLog: [...this.envelope.liveEventLog, event],
    }
  }

  syncMessages(messages: readonly AgentMessage[]) {
    let userIndex = 0
    let assistantIndex = 0
    const toolResultCountById = new Map<string, number>()

    const converted = messages
      .map((message) => {
        let roleIndex = 0
        if (message.role === 'user') {
          roleIndex = userIndex
          userIndex += 1
        } else if (message.role === 'assistant') {
          roleIndex = assistantIndex
          assistantIndex += 1
        } else if (message.role === 'toolResult') {
          roleIndex = toolResultCountById.get(message.toolCallId) ?? 0
          toolResultCountById.set(message.toolCallId, roleIndex + 1)
        }

        return convertAgentMessageToEnvelope({
          turnId: this.turnId,
          roleIndex,
          message,
        })
      })
      .filter((message): message is AgentMessageEnvelope => message !== null)

    const toolCalls = converted.flatMap((message) =>
      message.role === 'assistant'
        ? message.parts.filter(
            (part): part is Extract<AgentMessagePart, { type: 'tool_call' }> =>
              part.type === 'tool_call',
          )
        : [],
    )

    const toolResults = converted.flatMap((message) =>
      message.role === 'tool_result'
        ? [
            {
              toolCallId: message.toolCallId ?? '',
              toolName: message.toolName ?? '',
              content: message.parts,
              details:
                messages.find(
                  (candidate): candidate is ToolResultMessage =>
                    candidate.role === 'toolResult' &&
                    candidate.toolCallId === message.toolCallId,
                )?.details,
              isError: Boolean(message.isError),
              createdAt: message.createdAt,
            } satisfies AgentToolResultEnvelope,
          ]
        : [],
    )

    const finalAssistant = [...converted]
      .reverse()
      .find((message) => message.role === 'assistant')

    this.envelope = {
      ...this.envelope,
      messages: converted,
      toolCalls,
      toolResults,
      finalAssistantMessageId: finalAssistant?.id,
      usage: finalAssistant?.usage,
      providerMetadata: finalAssistant?.providerMetadata,
    }
  }
}

export function buildAgentLiveEventFromAssistantUpdate(input: {
  readonly type: AgentLiveEvent['type']
  readonly conversationId: string
  readonly turnId: string
  readonly sequence: number
  readonly timestamp: number
  readonly messageId: string
  readonly assistantEvent: AssistantMessageEvent
  readonly message?: AgentMessageEnvelope
}): AgentLiveEvent {
  const payload: Record<string, unknown> = {
    messageId: input.messageId,
  }

  if (input.assistantEvent.type === 'text_delta') {
    payload.deltaType = 'text'
    payload.delta = input.assistantEvent.delta
  } else if (input.assistantEvent.type === 'thinking_delta') {
    payload.deltaType = 'thinking'
    payload.delta = input.assistantEvent.delta
  } else if (input.assistantEvent.type === 'toolcall_delta') {
    payload.deltaType = 'tool_call'
    payload.delta = input.assistantEvent.delta
  }

  if (input.message) {
    payload.message = input.message
    payload.status = input.type === 'message_completed' ? 'completed' : 'streaming'
  }

  return {
    type: input.type,
    conversationId: input.conversationId,
    turnId: input.turnId,
    sequence: input.sequence,
    timestamp: input.timestamp,
    payload,
  }
}
