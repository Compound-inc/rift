import type { UIMessage } from 'ai'
import type { Effect } from 'effect'
import type {
  WorkspaceBillingPersistenceError,
  WorkspaceUsageQuotaExceededError,
} from '../../domain/errors'
import type { UsageBucketType, UsagePolicySnapshot } from './shared'

export type SeatQuotaBucketSnapshot = {
  readonly bucketType: UsageBucketType
  readonly totalNanoUsd: number
  readonly remainingNanoUsd: number
}

export type SeatQuotaState = {
  readonly seatSlotId: string
  readonly seatIndex: number
  readonly cycleStartAt: number
  readonly cycleEndAt: number
  readonly currentAssigneeUserId?: string
  readonly seatCycle: SeatQuotaBucketSnapshot
}

export type QuotaReservationResult = {
  readonly bypassed: boolean
  readonly reservationId?: string
  readonly seatSlotId?: string
  readonly seatIndex?: number
  readonly estimatedNanoUsd?: number
  readonly reservedNanoUsd?: number
}

export type WorkspaceUsageQuotaServiceShape = {
  readonly resolveEffectiveUsagePolicy: (input: {
    readonly organizationId: string
  }) => Effect.Effect<UsagePolicySnapshot, WorkspaceBillingPersistenceError>
  readonly ensureSeatAssignment: (input: {
    readonly organizationId: string
    readonly userId: string
  }) => Effect.Effect<SeatQuotaState | null, WorkspaceBillingPersistenceError>
  readonly reserveChatQuota: (input: {
    readonly organizationId?: string
    readonly userId: string
    readonly requestId: string
    readonly modelId: string
    readonly messages: readonly UIMessage[]
    readonly additionalPromptTokens?: number
    readonly bypassQuota: boolean
  }) => Effect.Effect<
    QuotaReservationResult,
    WorkspaceBillingPersistenceError | WorkspaceUsageQuotaExceededError
  >
  readonly releaseReservation: (input: {
    readonly requestId: string
    readonly reasonCode: string
  }) => Effect.Effect<void, WorkspaceBillingPersistenceError>
}

export type WorkspaceUsageSettlementServiceShape = {
  readonly recordChatUsage: (input: {
    readonly organizationId?: string
    readonly userId: string
    readonly requestId: string
    readonly assistantMessageId: string
    readonly modelId: string
    readonly actualCostUsd?: number
    readonly estimatedCostNanoUsd?: number
    readonly usedByok: boolean
  }) => Effect.Effect<void, WorkspaceBillingPersistenceError>
  readonly settleMonetizationEvent: (input: {
    readonly requestId: string
  }) => Effect.Effect<void, WorkspaceBillingPersistenceError>
}
