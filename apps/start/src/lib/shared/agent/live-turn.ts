import type {
  AgentLiveEvent,
  AgentLiveTurnState,
  AgentMessageEnvelope,
  AgentMessagePart,
  AgentRenderableMessage,
  AgentToolExecutionState,
  AgentToolResultViewModel,
} from './types'

export const EMPTY_AGENT_LIVE_TURN_STATE: AgentLiveTurnState = {
  conversationId: null,
  turnId: null,
  status: 'idle',
  messages: [],
  pendingToolCalls: new Map(),
  toolResultsById: new Map(),
  lastSequence: -1,
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

function getMessageFromPayload(payload: Record<string, unknown>): AgentRenderableMessage | null {
  const message = asRecord(payload.message)
  if (!message) return null
  if (typeof message.id !== 'string') return null
  if (
    message.role !== 'user' &&
    message.role !== 'assistant' &&
    message.role !== 'tool_result' &&
    message.role !== 'system'
  ) {
    return null
  }
  if (!Array.isArray(message.parts)) return null

  return {
    id: message.id,
    role: message.role,
    parts: message.parts as AgentMessagePart[],
    status:
      payload.status === 'pending' ||
      payload.status === 'streaming' ||
      payload.status === 'completed' ||
      payload.status === 'failed' ||
      payload.status === 'aborted'
        ? payload.status
        : 'streaming',
    createdAt: typeof message.createdAt === 'number' ? message.createdAt : Date.now(),
    toolCallId: typeof message.toolCallId === 'string' ? message.toolCallId : undefined,
    toolName: typeof message.toolName === 'string' ? message.toolName : undefined,
    isError: typeof message.isError === 'boolean' ? message.isError : undefined,
    providerMetadata: asRecord(message.providerMetadata),
    usage: asRecord(message.usage),
  }
}

function getMessageStatus(payload: Record<string, unknown>): AgentRenderableMessage['status'] {
  return payload.status === 'pending' ||
    payload.status === 'streaming' ||
    payload.status === 'completed' ||
    payload.status === 'failed' ||
    payload.status === 'aborted'
    ? payload.status
    : 'streaming'
}

function createStreamingAssistantMessage(
  payload: Record<string, unknown>,
  existingMessage?: AgentRenderableMessage,
): AgentRenderableMessage | null {
  const payloadMessage = getMessageFromPayload(payload)
  if (payloadMessage) {
    return payloadMessage
  }

  if (existingMessage) {
    return {
      ...existingMessage,
      status: getMessageStatus(payload),
    }
  }

  const messageId = typeof payload.messageId === 'string' ? payload.messageId : ''
  if (!messageId) return null

  return {
    id: messageId,
    role: 'assistant',
    parts: [],
    status: getMessageStatus(payload),
    createdAt: Date.now(),
  }
}

function appendDeltaPart(
  parts: readonly AgentMessagePart[],
  input: {
    readonly deltaType?: unknown
    readonly delta?: unknown
  },
): readonly AgentMessagePart[] {
  if (typeof input.delta !== 'string' || input.delta.length === 0) {
    return parts
  }

  if (input.deltaType === 'text') {
    const lastPart = parts.at(-1)
    if (lastPart?.type === 'text') {
      return [
        ...parts.slice(0, -1),
        {
          type: 'text',
          text: lastPart.text + input.delta,
        },
      ]
    }

    return [...parts, { type: 'text', text: input.delta }]
  }

  if (input.deltaType === 'thinking') {
    const lastPart = parts.at(-1)
    if (lastPart?.type === 'thinking') {
      return [
        ...parts.slice(0, -1),
        {
          ...lastPart,
          thinking: lastPart.thinking + input.delta,
        },
      ]
    }

    return [...parts, { type: 'thinking', thinking: input.delta }]
  }

  return parts
}

function mergeStreamingMessage(
  currentMessage: AgentRenderableMessage | undefined,
  payload: Record<string, unknown>,
): AgentRenderableMessage | null {
  const baseMessage = createStreamingAssistantMessage(payload, currentMessage)
  if (!baseMessage) return null

  return {
    ...baseMessage,
    parts:
      payload.deltaType === 'tool_call'
        ? baseMessage.parts
        : appendDeltaPart(currentMessage?.parts ?? [], {
            deltaType: payload.deltaType,
            delta: payload.delta,
          }),
  }
}

function upsertMessage(
  messages: readonly AgentRenderableMessage[],
  nextMessage: AgentRenderableMessage,
): readonly AgentRenderableMessage[] {
  const index = messages.findIndex((message) => message.id === nextMessage.id)
  if (index < 0) return [...messages, nextMessage]

  const nextMessages = [...messages]
  nextMessages[index] = nextMessage
  return nextMessages
}

function removePendingToolCall(
  pendingToolCalls: ReadonlyMap<string, AgentToolExecutionState>,
  toolCallId: string,
): ReadonlyMap<string, AgentToolExecutionState> {
  const next = new Map(pendingToolCalls)
  next.delete(toolCallId)
  return next
}

export function reduceAgentLiveTurnEvent(
  state: AgentLiveTurnState,
  event: AgentLiveEvent,
): AgentLiveTurnState {
  if (event.sequence <= state.lastSequence) return state

  switch (event.type) {
    case 'turn_started':
      return {
        conversationId: event.conversationId,
        turnId: event.turnId,
        status: 'streaming',
        messages: [],
        pendingToolCalls: new Map(),
        toolResultsById: new Map(),
        lastSequence: event.sequence,
      }

    case 'message_started':
    case 'message_completed': {
      const nextMessage = getMessageFromPayload(event.payload)
      const status =
        event.type === 'message_completed'
          ? 'streaming'
          : state.status === 'idle'
            ? 'streaming'
            : state.status

      return {
        ...state,
        status,
        messages: nextMessage ? upsertMessage(state.messages, nextMessage) : state.messages,
        lastSequence: event.sequence,
      }
    }

    case 'message_updated': {
      const messageId =
        typeof event.payload.messageId === 'string' ? event.payload.messageId : ''
      const currentMessage = state.messages.find((message) => message.id === messageId)
      const nextMessage = mergeStreamingMessage(currentMessage, event.payload)

      return {
        ...state,
        status: state.status === 'idle' ? 'streaming' : state.status,
        messages: nextMessage ? upsertMessage(state.messages, nextMessage) : state.messages,
        lastSequence: event.sequence,
      }
    }

    case 'tool_execution_started': {
      const args = asRecord(event.payload.args) ?? {}
      const toolCallId =
        typeof event.payload.toolCallId === 'string' ? event.payload.toolCallId : ''
      const toolName =
        typeof event.payload.toolName === 'string' ? event.payload.toolName : ''
      const nextPendingToolCalls = new Map(state.pendingToolCalls)
      nextPendingToolCalls.set(toolCallId, {
        toolCallId,
        toolName,
        args,
        status: 'running',
      })

      return {
        ...state,
        pendingToolCalls: nextPendingToolCalls,
        lastSequence: event.sequence,
      }
    }

    case 'tool_execution_updated': {
      const toolCallId =
        typeof event.payload.toolCallId === 'string' ? event.payload.toolCallId : ''
      const current = state.pendingToolCalls.get(toolCallId)
      if (!current) {
        return {
          ...state,
          lastSequence: event.sequence,
        }
      }
      const nextPendingToolCalls = new Map(state.pendingToolCalls)
      nextPendingToolCalls.set(toolCallId, {
        ...current,
        partialResult: event.payload.partialResult,
      })
      return {
        ...state,
        pendingToolCalls: nextPendingToolCalls,
        lastSequence: event.sequence,
      }
    }

    case 'tool_execution_completed': {
      const toolCallId =
        typeof event.payload.toolCallId === 'string' ? event.payload.toolCallId : ''
      const current = state.pendingToolCalls.get(toolCallId)
      const nextPendingToolCalls = new Map(state.pendingToolCalls)
      if (current) {
        nextPendingToolCalls.set(toolCallId, {
          ...current,
          status: 'completed',
          result: event.payload.result,
          isError: Boolean(event.payload.isError),
        })
      }
      return {
        ...state,
        pendingToolCalls: nextPendingToolCalls,
        lastSequence: event.sequence,
      }
    }

    case 'tool_result_completed': {
      const toolCallId =
        typeof event.payload.toolCallId === 'string' ? event.payload.toolCallId : ''
      const toolName =
        typeof event.payload.toolName === 'string' ? event.payload.toolName : ''
      const message = getMessageFromPayload(event.payload)
      const current = state.pendingToolCalls.get(toolCallId)

      const nextToolResultsById = new Map(state.toolResultsById)
      nextToolResultsById.set(toolCallId, {
        toolCallId,
        toolName,
        args: current?.args ?? {},
        parts: message?.parts ?? [],
        isError: Boolean(event.payload.isError),
      } satisfies AgentToolResultViewModel)

      return {
        ...state,
        pendingToolCalls: removePendingToolCall(state.pendingToolCalls, toolCallId),
        toolResultsById: nextToolResultsById,
        lastSequence: event.sequence,
      }
    }

    case 'turn_completed':
      return {
        ...state,
        status: 'completed',
        pendingToolCalls: new Map(),
        toolResultsById: new Map(),
        lastSequence: event.sequence,
      }

    case 'turn_failed':
      return {
        ...state,
        status: 'failed',
        errorMessage:
          typeof event.payload.message === 'string' ? event.payload.message : undefined,
        pendingToolCalls: new Map(),
        lastSequence: event.sequence,
      }

    case 'turn_checkpoint':
      return {
        ...state,
        lastSequence: event.sequence,
      }

    default:
      return state
  }
}

export function agentMessagesFromEnvelopeMessages(
  messages: readonly AgentMessageEnvelope[],
): readonly AgentRenderableMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts,
    status: 'completed',
    createdAt: message.createdAt,
    toolCallId: message.toolCallId,
    toolName: message.toolName,
    isError: message.isError,
  }))
}
