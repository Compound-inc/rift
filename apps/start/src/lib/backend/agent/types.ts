import type { AgentConversationStatus, AgentLiveEvent, AgentProduct, AgentTurnEnvelope, AgentTurnStatus } from '@/lib/shared/agent'

export type AgentConversationRecord = {
  readonly id: string
  readonly product: AgentProduct
  readonly scopeType: string
  readonly scopeId: string
  readonly ownerUserId: string
  readonly ownerOrgId: string
  readonly title: string
  readonly defaultModelId: string
  readonly status: AgentConversationStatus
  readonly metadataJson: Record<string, unknown>
  readonly createdAt: number
  readonly updatedAt: number
  readonly lastMessageAt: number
}

export type AgentTurnRecord = {
  readonly id: string
  readonly conversationId: string
  readonly product: AgentProduct
  readonly runtime: string
  readonly status: AgentTurnStatus
  readonly requestId: string
  readonly modelId?: string | null
  readonly providerId?: string | null
  readonly turnIndex: number
  readonly userMessageId?: string | null
  readonly assistantMessageId?: string | null
  readonly changeSetId?: string | null
  readonly turnJson: AgentTurnEnvelope
  readonly errorJson?: Record<string, unknown> | null
  readonly startedAt: number
  readonly completedAt?: number | null
  readonly updatedAt: number
}

export type AgentMessageRecord = {
  readonly id: string
  readonly conversationId: string
  readonly turnId: string
  readonly product: AgentProduct
  readonly role: 'user' | 'assistant' | 'tool_result' | 'system'
  readonly messageIndex: number
  readonly status: AgentTurnStatus
  readonly partsJson: readonly unknown[]
  readonly toolCallId?: string | null
  readonly toolName?: string | null
  readonly isError?: boolean | null
  readonly createdAt: number
  readonly updatedAt: number
}

export type AgentSessionRecord = {
  readonly conversationId: string
  readonly runtime: string
  readonly sessionJson: string
  readonly createdAt: number
  readonly updatedAt: number
}

export type AgentProductAdapterContext = {
  readonly conversation: AgentConversationRecord
  readonly turn: AgentTurnRecord
  readonly userId: string
  readonly organizationId?: string
  readonly requestId: string
}

export type AgentProductAdapterPreparedTurn = {
  readonly turnMetadata?: Record<string, unknown>
  readonly changeSetId?: string
}

export type AgentProductAdapter = {
  readonly product: AgentProduct
  readonly prepareTurn?: (
    ctx: AgentProductAdapterContext & {
      readonly summary: string
      readonly modelId?: string
    },
  ) => Promise<AgentProductAdapterPreparedTurn | void>
  readonly handleCheckpoint?: (
    ctx: AgentProductAdapterContext & {
      readonly envelope: AgentTurnEnvelope
      readonly event: AgentLiveEvent
    },
  ) => Promise<void>
  readonly handleTurnCompleted?: (
    ctx: AgentProductAdapterContext & {
      readonly envelope: AgentTurnEnvelope
    },
  ) => Promise<void>
  readonly handleTurnFailed?: (
    ctx: AgentProductAdapterContext & {
      readonly envelope: AgentTurnEnvelope
      readonly error: Record<string, unknown>
    },
  ) => Promise<void>
}

export type AgentRuntimeAdapter = {
  readonly runtime: 'pi' | (string & {})
}

export function isAgentConversationRecord(
  value: unknown,
): value is AgentConversationRecord {
  return typeof value === 'object' && value !== null && 'id' in value
}
