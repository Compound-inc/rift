import { Effect } from 'effect'
import { selectSeatSlotCandidate } from './shared'
import type { SeatSlotCandidate, UsagePolicySnapshot } from './shared'
import {
  asNumber,
  asOptionalNumber,
  cycleBounds,
  prorateCycleBudget,
} from './core'
import type {
  BucketBalanceRow,
  CurrentUsageSubscription,
  SeatSlotRow,
} from './core'
import type {
  SeatQuotaBucketSnapshot,
  SeatQuotaState,
} from './types'
import type { BillingSqlClient } from '../sql'

function normalizeSeatSlotRow(row: SeatSlotRow): SeatSlotRow {
  return {
    ...row,
    seatIndex: asNumber(row.seatIndex, 0),
    cycleStartAt: asNumber(row.cycleStartAt),
    cycleEndAt: asNumber(row.cycleEndAt),
    firstAssignedAt: asOptionalNumber(row.firstAssignedAt),
  }
}

function normalizeBucketBalanceRow(row: BucketBalanceRow): BucketBalanceRow {
  return {
    ...row,
    totalNanoUsd: asNumber(row.totalNanoUsd),
    remainingNanoUsd: asNumber(row.remainingNanoUsd),
  }
}

export const readSeatSlotsForCycle = Effect.fn(
  'WorkspaceUsageSeatStore.readSeatSlotsForCycle',
)(
  (
    client: BillingSqlClient,
    input: {
      readonly organizationId: string
      readonly cycleStartAt: number
      readonly cycleEndAt: number
      readonly forUpdate?: boolean
    },
  ): Effect.Effect<SeatSlotRow[], unknown> =>
    Effect.gen(function* () {
      const rows = yield* client<SeatSlotRow>`
        select
          slot.id,
          slot.organization_id as "organizationId",
          slot.seat_index as "seatIndex",
          slot.cycle_start_at as "cycleStartAt",
          slot.cycle_end_at as "cycleEndAt",
          case
            when slot.current_assignee_user_id is null then null
            when member.id is null then null
            else slot.current_assignee_user_id
          end as "currentAssigneeUserId",
          slot.first_assigned_at as "firstAssignedAt"
        from org_seat_slot slot
        left join member
          on member."organizationId" = slot.organization_id
         and member."userId" = slot.current_assignee_user_id
        where slot.organization_id = ${input.organizationId}
          and slot.cycle_start_at = ${input.cycleStartAt}
          and slot.cycle_end_at = ${input.cycleEndAt}
          and slot.status = 'active'
        order by slot.seat_index asc
        ${client.literal(input.forUpdate ? 'for update of slot' : '')}
      `

      return rows.map(normalizeSeatSlotRow)
    }),
)

export const readBucketBalances = Effect.fn(
  'WorkspaceUsageSeatStore.readBucketBalances',
)(
  (
    client: BillingSqlClient,
    seatSlotId: string,
  ): Effect.Effect<BucketBalanceRow[], unknown> =>
    Effect.gen(function* () {
      const rows = yield* client<BucketBalanceRow>`
        select
          id,
          bucket_type as "bucketType",
          total_nano_usd as "totalNanoUsd",
          remaining_nano_usd as "remainingNanoUsd"
        from org_seat_bucket_balance
        where seat_slot_id = ${seatSlotId}
      `

      return rows.map(normalizeBucketBalanceRow)
    }),
)

export const releaseActiveSeatAssignmentsForSlot = Effect.fn(
  'WorkspaceUsageSeatStore.releaseActiveSeatAssignmentsForSlot',
)(
  (client: BillingSqlClient, input: {
    readonly seatSlotId: string
    readonly now: number
    readonly nextUserId: string
  }): Effect.Effect<void, unknown> =>
    client`
      update org_seat_slot_assignment
      set assignment_status = 'released',
          released_at = coalesce(released_at, ${input.now}),
          updated_at = ${input.now}
      where seat_slot_id = ${input.seatSlotId}
        and user_id <> ${input.nextUserId}
        and assignment_status = 'active'
    `.pipe(Effect.asVoid),
)

export const createSeatSlot = Effect.fn(
  'WorkspaceUsageSeatStore.createSeatSlot',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly subscriptionId: string
    readonly planId: string
    readonly seatIndex: number
    readonly cycleStartAt: number
    readonly cycleEndAt: number
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  }): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      const slotId = `seat_slot_${input.organizationId}_${input.cycleStartAt}_${input.seatIndex}`

      yield* client`
        insert into org_seat_slot (
          id,
          organization_id,
          org_subscription_id,
          plan_id,
          cycle_start_at,
          cycle_end_at,
          seat_index,
          status,
          created_at,
          updated_at
        )
        values (
          ${slotId},
          ${input.organizationId},
          ${input.subscriptionId},
          ${input.planId},
          ${input.cycleStartAt},
          ${input.cycleEndAt},
          ${input.seatIndex},
          'active',
          ${input.now},
          ${input.now}
        )
        on conflict (id) do update
        set organization_id = excluded.organization_id,
            org_subscription_id = excluded.org_subscription_id,
            plan_id = excluded.plan_id,
            cycle_start_at = excluded.cycle_start_at,
            cycle_end_at = excluded.cycle_end_at,
            seat_index = excluded.seat_index,
            status = 'active',
            updated_at = excluded.updated_at
      `

      yield* ensureSeatSlotBalanceRows(client, {
        organizationId: input.organizationId,
        seatSlotId: slotId,
        cycleStartAt: input.cycleStartAt,
        cycleEndAt: input.cycleEndAt,
        usagePolicy: input.usagePolicy,
        now: input.now,
      })
    }),
)

/**
 * Each seat carries a single cycle-scoped balance that tracks the remaining
 * paid quota for the current subscription period.
 */
export const ensureSeatSlotBalanceRows = Effect.fn(
  'WorkspaceUsageSeatStore.ensureSeatSlotBalanceRows',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly seatSlotId: string
    readonly cycleStartAt: number
    readonly cycleEndAt: number
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  }): Effect.Effect<void, unknown> => {
    const seatCycleBucketId = `seat_bucket_${input.seatSlotId}_seat_cycle`

    return client`
      insert into org_seat_bucket_balance (
        id,
        organization_id,
        seat_slot_id,
        bucket_type,
        total_nano_usd,
        remaining_nano_usd,
        created_at,
        updated_at
      )
      values (
        ${seatCycleBucketId},
        ${input.organizationId},
        ${input.seatSlotId},
        'seat_cycle',
        ${prorateCycleBudget({
          totalNanoUsd: input.usagePolicy.seatCycleBudgetNanoUsd,
          now: input.now,
          cycleStartAt: input.cycleStartAt,
          cycleEndAt: input.cycleEndAt,
        })},
        ${prorateCycleBudget({
          totalNanoUsd: input.usagePolicy.seatCycleBudgetNanoUsd,
          now: input.now,
          cycleStartAt: input.cycleStartAt,
          cycleEndAt: input.cycleEndAt,
        })},
        ${input.now},
        ${input.now}
      )
      on conflict (seat_slot_id, bucket_type) do nothing
    `.pipe(Effect.asVoid)
  },
)

const ensureCurrentCycleBucket = Effect.fn(
  'WorkspaceUsageSeatStore.ensureCurrentCycleBucket',
)(
  (client: BillingSqlClient, input: {
    readonly bucket: BucketBalanceRow
    readonly seatCycleStartAt: number
    readonly seatCycleEndAt: number
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  }): Effect.Effect<BucketBalanceRow, unknown> =>
    Effect.gen(function* () {
      if (input.bucket.bucketType !== 'seat_cycle') {
        return input.bucket
      }

      const nextTotal = prorateCycleBudget({
        totalNanoUsd: input.usagePolicy.seatCycleBudgetNanoUsd,
        now: input.now,
        cycleStartAt: input.seatCycleStartAt,
        cycleEndAt: input.seatCycleEndAt,
      })
      const nextRemaining = Math.min(
        nextTotal,
        input.bucket.remainingNanoUsd + (nextTotal - input.bucket.totalNanoUsd),
      )

      if (
        input.bucket.totalNanoUsd === nextTotal
        && input.bucket.remainingNanoUsd === nextRemaining
      ) {
        return input.bucket
      }

      const refreshed: BucketBalanceRow = {
        ...input.bucket,
        totalNanoUsd: nextTotal,
        remainingNanoUsd: nextRemaining,
      }

      yield* client`
        update org_seat_bucket_balance
        set total_nano_usd = ${refreshed.totalNanoUsd},
            remaining_nano_usd = ${refreshed.remainingNanoUsd},
            updated_at = ${input.now}
        where id = ${input.bucket.id}
      `

      return refreshed
    }),
)

export const hydrateSeatQuotaState = Effect.fn(
  'WorkspaceUsageSeatStore.hydrateSeatQuotaState',
)(
  (client: BillingSqlClient, input: {
    readonly seatSlotId: string
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
    readonly forUpdate?: boolean
  }): Effect.Effect<SeatQuotaState, unknown> =>
    Effect.gen(function* () {
      const [slotRow] = yield* client<SeatSlotRow>`
        select
          id,
          organization_id as "organizationId",
          seat_index as "seatIndex",
          cycle_start_at as "cycleStartAt",
          cycle_end_at as "cycleEndAt",
          current_assignee_user_id as "currentAssigneeUserId",
          first_assigned_at as "firstAssignedAt"
        from org_seat_slot
        where id = ${input.seatSlotId}
        ${client.literal(input.forUpdate ? 'for update' : '')}
      `
      const slot = slotRow ? normalizeSeatSlotRow(slotRow) : null

      if (!slot) {
        return yield* Effect.fail(new Error('seat slot not found'))
      }

      const bucketRows = yield* client<BucketBalanceRow>`
        select
          id,
          bucket_type as "bucketType",
          total_nano_usd as "totalNanoUsd",
          remaining_nano_usd as "remainingNanoUsd"
        from org_seat_bucket_balance
        where seat_slot_id = ${input.seatSlotId}
        ${client.literal(input.forUpdate ? 'for update' : '')}
      `
      const cycleBucket = bucketRows.find((bucket) => bucket.bucketType === 'seat_cycle')

      if (!cycleBucket) {
        yield* ensureSeatSlotBalanceRows(client, {
          organizationId: slot.organizationId ?? '',
          seatSlotId: slot.id,
          cycleStartAt: slot.cycleStartAt,
          cycleEndAt: slot.cycleEndAt,
          usagePolicy: input.usagePolicy,
          now: input.now,
        })
      }

      const refreshedBucketRows = yield* readBucketBalances(client, input.seatSlotId)
      const resolvedCycleBucket = refreshedBucketRows.find((bucket) => bucket.bucketType === 'seat_cycle')

      if (!resolvedCycleBucket) {
        return yield* Effect.fail(new Error('seat slot balances not found'))
      }

      const refreshedCycleBucket = yield* ensureCurrentCycleBucket(client, {
        bucket: resolvedCycleBucket,
        seatCycleStartAt: slot.cycleStartAt,
        seatCycleEndAt: slot.cycleEndAt,
        usagePolicy: input.usagePolicy,
        now: input.now,
      })

      return {
        seatSlotId: slot.id,
        seatIndex: slot.seatIndex,
        cycleStartAt: slot.cycleStartAt,
        cycleEndAt: slot.cycleEndAt,
        currentAssigneeUserId: slot.currentAssigneeUserId ?? undefined,
        seatCycle: toBucketSnapshot(refreshedCycleBucket),
      }
    }),
)

function toBucketSnapshot(bucket: BucketBalanceRow): SeatQuotaBucketSnapshot {
  return {
    bucketType: bucket.bucketType,
    totalNanoUsd: bucket.totalNanoUsd,
    remainingNanoUsd: bucket.remainingNanoUsd,
  }
}

/**
 * Seat assignment runs under row locks for the current billing cycle so the
 * same purchased seat cannot be assigned twice when multiple replicas reserve
 * quota concurrently for the same organization.
 */
export const ensureSeatAssignmentWithClient = Effect.fn(
  'WorkspaceUsageSeatStore.ensureSeatAssignmentWithClient',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly userId: string
    readonly currentSubscription: CurrentUsageSubscription | null
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  }): Effect.Effect<SeatQuotaState | null, unknown> =>
    Effect.gen(function* () {
      if (!input.currentSubscription || !input.usagePolicy.enabled) {
        return null
      }

      const { cycleStartAt, cycleEndAt } = cycleBounds({
        now: input.now,
        currentPeriodStart: input.currentSubscription.currentPeriodStart,
        currentPeriodEnd: input.currentSubscription.currentPeriodEnd,
      })

      const [existingAssignment] = yield* client<{ seatSlotId: string }>`
        select seat_slot_id as "seatSlotId"
        from org_seat_slot_assignment
        where organization_id = ${input.organizationId}
          and user_id = ${input.userId}
          and cycle_start_at = ${cycleStartAt}
          and cycle_end_at = ${cycleEndAt}
          and assignment_status = 'active'
        order by assigned_at desc
        limit 1
      `
      const existingSeatSlotId = existingAssignment?.seatSlotId

      if (existingSeatSlotId) {
        return yield* hydrateSeatQuotaState(client, {
          seatSlotId: existingSeatSlotId,
          usagePolicy: input.usagePolicy,
          now: input.now,
          forUpdate: true,
        })
      }

      const slots = yield* readSeatSlotsForCycle(client, {
        organizationId: input.organizationId,
        cycleStartAt,
        cycleEndAt,
        forUpdate: true,
      })
      const candidate = selectSeatSlotCandidate({
        slots: slots.map((slot) => ({
          id: slot.id,
          seatIndex: slot.seatIndex,
          currentAssigneeUserId: slot.currentAssigneeUserId,
          firstAssignedAt: slot.firstAssignedAt,
        }) satisfies SeatSlotCandidate),
      })

      if (!candidate) {
        return null
      }

      yield* releaseActiveSeatAssignmentsForSlot(client, {
        seatSlotId: candidate.id,
        nextUserId: input.userId,
        now: input.now,
      })

      yield* client`
        update org_seat_slot
        set current_assignee_user_id = ${input.userId},
            first_assigned_at = coalesce(first_assigned_at, ${input.now}),
            last_assigned_at = ${input.now},
            updated_at = ${input.now}
        where id = ${candidate.id}
      `

      yield* client`
        insert into org_seat_slot_assignment (
          id,
          organization_id,
          seat_slot_id,
          user_id,
          cycle_start_at,
          cycle_end_at,
          assignment_status,
          assigned_at,
          created_at,
          updated_at
        )
        values (
          ${`seat_assignment_${candidate.id}_${input.userId}_${input.now}`},
          ${input.organizationId},
          ${candidate.id},
          ${input.userId},
          ${cycleStartAt},
          ${cycleEndAt},
          'active',
          ${input.now},
          ${input.now},
          ${input.now}
        )
      `

      return yield* hydrateSeatQuotaState(client, {
        seatSlotId: candidate.id,
        usagePolicy: input.usagePolicy,
        now: input.now,
        forUpdate: true,
      })
    }),
)
