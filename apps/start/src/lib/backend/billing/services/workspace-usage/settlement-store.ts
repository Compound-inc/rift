import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  parseJson,
} from './core'
import type {
  MonetizationRow,
  ReservationAllocation,
  UsageReservationRow,
} from './core'
import {
  applyLedgerEntry,
  selectExistingReservation,
} from './reservation-store'
import { readBucketBalances } from './seat-store'
import {
  upsertPaidOrgUserUsageSummaryRecordWithClientEffect,
} from './usage-summary-store'
import {
  runBillingSqlEffect,
  sqlJson,
} from '../sql'
import type { BillingSqlClient } from '../sql'

export const recordChatUsageRecordEffect = Effect.fn(
  'WorkspaceUsageSettlementStore.recordChatUsageRecord',
)(
  (input: {
    readonly organizationId?: string
    readonly userId: string
    readonly requestId: string
    readonly assistantMessageId: string
    readonly modelId: string
    readonly actualCostUsd?: number
    readonly estimatedCostNanoUsd?: number
    readonly usedByok: boolean
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      if (!input.organizationId) {
        return
      }

      const organizationId = input.organizationId
      const sql = yield* PgClient.PgClient
      const now = Date.now()
      const actualNanoUsd =
        input.actualCostUsd != null
          ? Math.round(input.actualCostUsd * 1_000_000_000)
          : 0

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const reservation = yield* selectExistingReservation(sql, input.requestId)
          const usageEventId = `usage_event_${input.requestId}`
          const monetizationEventId = `monetization_event_${input.requestId}`

          yield* sql`
            insert into org_usage_event (
              id,
              request_id,
              organization_id,
              user_id,
              seat_slot_id,
              assistant_message_id,
              model_id,
              used_byok,
              estimated_nano_usd,
              actual_nano_usd,
              metadata,
              created_at
            )
            values (
              ${usageEventId},
              ${input.requestId},
              ${organizationId},
              ${input.userId},
              ${reservation?.seatSlotId ?? null},
              ${input.assistantMessageId},
              ${input.modelId},
              ${input.usedByok},
              ${input.estimatedCostNanoUsd ?? reservation?.estimatedNanoUsd ?? null},
              ${actualNanoUsd},
              ${sqlJson(sql, {})},
              ${now}
            )
            on conflict (request_id) do update
            set assistant_message_id = excluded.assistant_message_id,
                model_id = excluded.model_id,
                used_byok = excluded.used_byok,
                estimated_nano_usd = excluded.estimated_nano_usd,
                actual_nano_usd = excluded.actual_nano_usd,
                metadata = excluded.metadata
          `

          yield* sql`
            insert into org_monetization_event (
              id,
              request_id,
              organization_id,
              user_id,
              seat_slot_id,
              usage_event_id,
              reservation_id,
              estimated_nano_usd,
              actual_nano_usd,
              status,
              metadata,
              created_at,
              updated_at
            )
            values (
              ${monetizationEventId},
              ${input.requestId},
              ${organizationId},
              ${input.userId},
              ${reservation?.seatSlotId ?? null},
              ${usageEventId},
              ${reservation?.id ?? null},
              ${input.estimatedCostNanoUsd ?? reservation?.estimatedNanoUsd ?? 0},
              ${actualNanoUsd},
              ${input.usedByok || !reservation ? 'bypassed' : 'pending'},
              ${sqlJson(sql, {})},
              ${now},
              ${now}
            )
            on conflict (request_id) do update
            set estimated_nano_usd = excluded.estimated_nano_usd,
                actual_nano_usd = excluded.actual_nano_usd,
                updated_at = excluded.updated_at
          `
        }),
      )
    }),
)

export async function recordChatUsageRecord(input: {
  readonly organizationId?: string
  readonly userId: string
  readonly requestId: string
  readonly assistantMessageId: string
  readonly modelId: string
  readonly actualCostUsd?: number
  readonly estimatedCostNanoUsd?: number
  readonly usedByok: boolean
}): Promise<void> {
  await runBillingSqlEffect(recordChatUsageRecordEffect(input))
}

const readReservationForSettlement = Effect.fn(
  'WorkspaceUsageSettlementStore.readReservationForSettlement',
)(
  (
    client: BillingSqlClient,
    reservationId: string,
  ): Effect.Effect<
    (UsageReservationRow & {
      allocation: ReservationAllocation[]
      organizationId: string
      userId: string
    }) | null,
    unknown
  > =>
    Effect.gen(function* () {
      const [row] = yield* client<
        UsageReservationRow
        & {
          allocation: unknown
          organizationId: string
          userId: string
        }
      >`
        select
          id,
          request_id as "requestId",
          organization_id as "organizationId",
          user_id as "userId",
          seat_slot_id as "seatSlotId",
          status,
          estimated_nano_usd as "estimatedNanoUsd",
          reserved_nano_usd as "reservedNanoUsd",
          allocation
        from org_usage_reservation
        where id = ${reservationId}
        for update
      `

      if (!row) {
        return null
      }

      return {
        ...row,
        allocation: parseJson(row.allocation, [] as ReservationAllocation[]),
      }
    }),
)

export const settleMonetizationEventRecordEffect = Effect.fn(
  'WorkspaceUsageSettlementStore.settleMonetizationEventRecord',
)(
  (input: {
    readonly requestId: string
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const now = Date.now()

      yield* sql.withTransaction(
        Effect.gen(function* () {
          let summaryTarget: { organizationId: string; userId: string } | null = null

          const [monetization] = yield* sql<MonetizationRow>`
            select
              id,
              reservation_id as "reservationId",
              actual_nano_usd as "actualNanoUsd",
              estimated_nano_usd as "estimatedNanoUsd",
              status
            from org_monetization_event
            where request_id = ${input.requestId}
            for update
          `

          if (!monetization || monetization.status === 'settled' || monetization.status === 'bypassed') {
            return
          }

          const reservation = monetization.reservationId
            ? yield* readReservationForSettlement(sql, monetization.reservationId)
            : null

          if (!reservation) {
            yield* sql`
              update org_monetization_event
              set status = 'bypassed',
                  updated_at = ${now}
              where request_id = ${input.requestId}
            `
            return
          }

          summaryTarget = {
            organizationId: reservation.organizationId,
            userId: reservation.userId,
          }

          const bucketRows = yield* readBucketBalances(sql, reservation.seatSlotId)
          const balanceById = new Map(bucketRows.map((row) => [row.id, row]))
          const [seatOrg] = yield* sql<{ organizationId: string }>`
            select organization_id as "organizationId"
            from org_seat_slot
            where id = ${reservation.seatSlotId}
            limit 1
          `
          const organizationId = seatOrg?.organizationId ?? ''

          let remainingRefund = Math.max(
            0,
            reservation.reservedNanoUsd - monetization.actualNanoUsd,
          )
          let refundedNanoUsd = 0

          for (const allocation of [...reservation.allocation].reverse()) {
            if (remainingRefund <= 0) break
            const balance = balanceById.get(allocation.bucketBalanceId)
            if (!balance) continue

            const refundable = Math.min(remainingRefund, allocation.amountNanoUsd)

            yield* sql`
              update org_seat_bucket_balance
              set remaining_nano_usd = least(total_nano_usd, remaining_nano_usd + ${refundable}),
                  updated_at = ${now}
              where id = ${balance.id}
            `
            refundedNanoUsd += refundable
            remainingRefund -= refundable

            yield* applyLedgerEntry(sql, {
              organizationId,
              seatSlotId: reservation.seatSlotId,
              bucketBalanceId: balance.id,
              reservationId: reservation.id,
              monetizationEventId: monetization.id,
              entryType: 'refund',
              amountNanoUsd: refundable,
              metadata: { requestId: input.requestId },
              now,
            })
          }

          let remainingCapture = Math.max(
            0,
            monetization.actualNanoUsd - reservation.reservedNanoUsd,
          )

          for (const allocation of reservation.allocation) {
            if (remainingCapture <= 0) break
            const balance = balanceById.get(allocation.bucketBalanceId)
            if (!balance) continue

            const captureAmount = Math.min(remainingCapture, balance.remainingNanoUsd)
            if (captureAmount <= 0) continue

            yield* sql`
              update org_seat_bucket_balance
              set remaining_nano_usd = remaining_nano_usd - ${captureAmount},
                  updated_at = ${now}
              where id = ${balance.id}
            `
            remainingCapture -= captureAmount

            yield* applyLedgerEntry(sql, {
              organizationId,
              seatSlotId: reservation.seatSlotId,
              bucketBalanceId: balance.id,
              reservationId: reservation.id,
              monetizationEventId: monetization.id,
              entryType: 'capture',
              amountNanoUsd: captureAmount,
              metadata: { requestId: input.requestId },
              now,
            })
          }

          if (remainingCapture > 0) {
            const cycleBalance = bucketRows.find((bucket) => bucket.bucketType === 'seat_cycle')
            if (!cycleBalance) {
              return yield* Effect.fail(new Error('seat cycle bucket missing'))
            }

            yield* sql`
              update org_seat_bucket_balance
              set remaining_nano_usd = remaining_nano_usd - ${remainingCapture},
                  updated_at = ${now}
              where id = ${cycleBalance.id}
            `

            yield* applyLedgerEntry(sql, {
              organizationId,
              seatSlotId: reservation.seatSlotId,
              bucketBalanceId: cycleBalance.id,
              reservationId: reservation.id,
              monetizationEventId: monetization.id,
              entryType: 'capture_debt',
              amountNanoUsd: remainingCapture,
              metadata: { requestId: input.requestId },
              now,
            })
            remainingCapture = 0
          }

          yield* sql`
            update org_usage_reservation
            set status = 'settled',
                updated_at = ${now}
            where id = ${reservation.id}
          `

          yield* sql`
            update org_monetization_event
            set captured_nano_usd = ${monetization.actualNanoUsd},
                refunded_nano_usd = ${refundedNanoUsd},
                forgiven_nano_usd = ${0},
                status = 'settled',
                updated_at = ${now}
            where id = ${monetization.id}
          `

          if (!summaryTarget) {
            return
          }

          yield* Effect.catch(
            upsertPaidOrgUserUsageSummaryRecordWithClientEffect({
              client: sql,
              organizationId: summaryTarget.organizationId,
              userId: summaryTarget.userId,
              now,
            }),
            () => Effect.void,
          )
        }),
      )
    }),
)

export async function settleMonetizationEventRecord(input: {
  readonly requestId: string
}): Promise<void> {
  await runBillingSqlEffect(settleMonetizationEventRecordEffect(input))
}
