export type AgentProduct = 'writing' | (string & {})

export type AgentConversationStatus = 'active' | 'archived'

export type AgentTurnStatus =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'aborted'

export type AgentMessageRole = 'user' | 'assistant' | 'tool_result' | 'system'

export type AgentTextPart = {
  readonly type: 'text'
  readonly text: string
}

export type AgentThinkingPart = {
  readonly type: 'thinking'
  readonly thinking: string
  readonly signature?: string
  readonly redacted?: boolean
}

export type AgentToolCallPart = {
  readonly type: 'tool_call'
  readonly id: string
  readonly name: string
  readonly arguments: Record<string, unknown>
}

export type AgentImagePart = {
  readonly type: 'image'
  readonly data: string
  readonly mimeType: string
}

export type AgentMessagePart =
  | AgentTextPart
  | AgentThinkingPart
  | AgentToolCallPart
  | AgentImagePart

export type AgentMessageEnvelope = {
  readonly id: string
  readonly role: AgentMessageRole
  readonly parts: readonly AgentMessagePart[]
  readonly createdAt: number
  readonly toolCallId?: string
  readonly toolName?: string
  readonly isError?: boolean
  readonly providerMetadata?: Record<string, unknown>
  readonly usage?: Record<string, unknown>
}

export type AgentToolResultEnvelope = {
  readonly toolCallId: string
  readonly toolName: string
  readonly content: readonly AgentMessagePart[]
  readonly details?: unknown
  readonly isError: boolean
  readonly createdAt: number
}

export type AgentLiveEventType =
  | 'turn_started'
  | 'message_started'
  | 'message_updated'
  | 'message_completed'
  | 'tool_execution_started'
  | 'tool_execution_updated'
  | 'tool_execution_completed'
  | 'tool_result_completed'
  | 'turn_checkpoint'
  | 'turn_failed'
  | 'turn_completed'

export type AgentLiveEvent = {
  readonly type: AgentLiveEventType
  readonly conversationId: string
  readonly turnId: string
  readonly sequence: number
  readonly timestamp: number
  readonly payload: Record<string, unknown>
}

export type AgentTurnStateTransition = {
  readonly status: AgentTurnStatus
  readonly timestamp: number
}

export type AgentTurnEnvelope = {
  readonly version: 'pi_turn_v1'
  readonly runtime: 'pi'
  readonly conversation: {
    readonly id: string
    readonly product: AgentProduct
    readonly scopeType: string
    readonly scopeId: string
  }
  readonly turnId: string
  readonly turnIndex: number
  readonly messages: readonly AgentMessageEnvelope[]
  readonly toolCalls: readonly AgentToolCallPart[]
  readonly toolResults: readonly AgentToolResultEnvelope[]
  readonly liveEventLog: readonly AgentLiveEvent[]
  readonly usage?: Record<string, unknown>
  readonly providerMetadata?: Record<string, unknown>
  readonly stateTransitions: readonly AgentTurnStateTransition[]
  readonly startedAt: number
  readonly completedAt?: number
  readonly finalStatus: AgentTurnStatus
  readonly finalAssistantMessageId?: string
}

export type AgentRenderableMessage = {
  readonly id: string
  readonly role: AgentMessageRole
  readonly parts: readonly AgentMessagePart[]
  readonly status: AgentTurnStatus
  readonly createdAt: number
  readonly providerMetadata?: Record<string, unknown>
  readonly usage?: Record<string, unknown>
  readonly toolCallId?: string
  readonly toolName?: string
  readonly isError?: boolean
}

export type AgentToolExecutionState = {
  readonly toolCallId: string
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly status: 'running' | 'completed'
  readonly partialResult?: unknown
  readonly result?: unknown
  readonly isError?: boolean
}

export type AgentToolCallViewModel = {
  readonly toolCallId: string
  readonly toolName: string
  readonly status: 'running' | 'completed'
  readonly args: Record<string, unknown>
  readonly isError: boolean
}

export type AgentToolResultViewModel = {
  readonly toolCallId: string
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly parts: readonly AgentMessagePart[]
  readonly isError: boolean
}

export type AgentLiveTurnState = {
  readonly conversationId: string | null
  readonly turnId: string | null
  readonly status: AgentTurnStatus | 'idle'
  readonly messages: readonly AgentRenderableMessage[]
  readonly pendingToolCalls: ReadonlyMap<string, AgentToolExecutionState>
  readonly toolResultsById: ReadonlyMap<string, AgentToolResultViewModel>
  readonly lastSequence: number
  readonly errorMessage?: string
}
