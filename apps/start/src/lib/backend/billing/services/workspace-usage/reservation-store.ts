import { PgClient } from '@effect/sql-pg'
import type { UIMessage } from 'ai'
import { Effect } from 'effect'
import {
  WorkspaceUsageQuotaExceededError,
} from '../../domain/errors'
import {
  estimateReservedCostNanoUsd,
  RESERVATION_TTL_MS,
} from './shared'
import {
  asNumber,
  cycleBounds,
  parseJson,
} from './core'
import type {
  ReservationAllocation,
  UsageReservationRow,
} from './core'
import {
  ensureCurrentCycleSeatScaffoldingEffect,
  readCurrentUsageSubscriptionEffect,
  resolveEffectiveUsagePolicyRecordEffect,
} from './policy-store'
import {
  ensureSeatAssignmentWithClient,
  readBucketBalances,
} from './seat-store'
import type { QuotaReservationResult, SeatQuotaState } from './types'
import {
  upsertPaidOrgUserUsageSummaryRecordWithClientEffect,
} from './usage-summary-store'
import {
  runBillingSqlEffect,
  sqlJson,
} from '../sql'
import type { BillingSqlClient } from '../sql'

/**
 * Seat budgets are continuously prorated across the cycle. When we release an
 * expired reservation and immediately re-reserve within the same transaction,
 * the recomputed bucket can shrink by a few nanodollars. Treating that tiny
 * drift as hard quota exhaustion causes the cleanup release to roll back even
 * though the member still has the same practical reserve available.
 */
const QUOTA_DRIFT_TOLERANCE_NANO_USD = 100_000

export function resolveQuotaExhaustion(input: {
  readonly seatState: SeatQuotaState
  readonly now: number
}): {
  readonly retryAfterMs: number
  readonly reasonCode: 'seat_quota_exhausted'
} {
  return {
    retryAfterMs: Math.max(1, input.seatState.cycleEndAt - input.now),
    reasonCode: 'seat_quota_exhausted',
  }
}

export const selectExistingReservation = Effect.fn(
  'WorkspaceUsageReservationStore.selectExistingReservation',
)(
  (
    client: BillingSqlClient,
    requestId: string,
  ): Effect.Effect<UsageReservationRow | null, unknown> =>
    Effect.gen(function* () {
      const [row] = yield* client<UsageReservationRow & { allocation: unknown }>`
        select
          id,
          request_id as "requestId",
          seat_slot_id as "seatSlotId",
          status,
          estimated_nano_usd as "estimatedNanoUsd",
          reserved_nano_usd as "reservedNanoUsd",
          allocation
        from org_usage_reservation
        where request_id = ${requestId}
        limit 1
      `

      if (!row) {
        return null
      }

      return {
        ...row,
        estimatedNanoUsd: asNumber(row.estimatedNanoUsd),
        reservedNanoUsd: asNumber(row.reservedNanoUsd),
        allocation: parseJson(row.allocation, [] as ReservationAllocation[]),
      }
    }),
)

export const applyLedgerEntry = Effect.fn(
  'WorkspaceUsageReservationStore.applyLedgerEntry',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly seatSlotId: string
    readonly bucketBalanceId: string
    readonly reservationId?: string
    readonly monetizationEventId?: string
    readonly entryType: string
    readonly amountNanoUsd: number
    readonly metadata?: Record<string, unknown>
    readonly now: number
  }): Effect.Effect<void, unknown> =>
    client`
      insert into org_seat_bucket_ledger (
        id,
        organization_id,
        seat_slot_id,
        bucket_balance_id,
        reservation_id,
        monetization_event_id,
        entry_type,
        amount_nano_usd,
        metadata,
        created_at
      )
      values (
        ${`seat_bucket_ledger_${input.entryType}_${input.bucketBalanceId}_${input.reservationId ?? input.monetizationEventId ?? input.now}_${input.amountNanoUsd}`},
        ${input.organizationId},
        ${input.seatSlotId},
        ${input.bucketBalanceId},
        ${input.reservationId ?? null},
        ${input.monetizationEventId ?? null},
        ${input.entryType},
        ${input.amountNanoUsd},
        ${sqlJson(client, input.metadata ?? {})},
        ${input.now}
      )
      on conflict (id) do nothing
    `.pipe(Effect.asVoid),
)

export const releaseReservationWithClient = Effect.fn(
  'WorkspaceUsageReservationStore.releaseReservationWithClient',
)(
  (client: BillingSqlClient, input: {
    readonly requestId: string
    readonly reasonCode: string
    readonly now: number
  }): Effect.Effect<boolean, unknown> =>
    Effect.gen(function* () {
      const reservation = yield* selectExistingReservation(client, input.requestId)
      if (!reservation || reservation.status !== 'reserved') {
        return false
      }

      const balanceRows = yield* readBucketBalances(client, reservation.seatSlotId)
      const balanceById = new Map(balanceRows.map((row) => [row.id, row]))
      const [seatOrg] = yield* client<{ organizationId: string }>`
        select organization_id as "organizationId"
        from org_seat_slot
        where id = ${reservation.seatSlotId}
        limit 1
      `
      const organizationId = seatOrg?.organizationId ?? ''

      for (const allocation of reservation.allocation) {
        const balance = balanceById.get(allocation.bucketBalanceId)
        if (!balance) continue

        yield* client`
          update org_seat_bucket_balance
          set remaining_nano_usd = least(total_nano_usd, remaining_nano_usd + ${allocation.amountNanoUsd}),
              updated_at = ${input.now}
          where id = ${balance.id}
        `
      }

      for (const allocation of reservation.allocation) {
        const balance = balanceById.get(allocation.bucketBalanceId)
        if (!balance) continue

        yield* applyLedgerEntry(client, {
          organizationId,
          seatSlotId: reservation.seatSlotId,
          bucketBalanceId: balance.id,
          reservationId: reservation.id,
          entryType: 'release',
          amountNanoUsd: allocation.amountNanoUsd,
          metadata: {
            reasonCode: input.reasonCode,
          },
          now: input.now,
        })
      }

      yield* client`
        update org_usage_reservation
        set status = 'released',
            released_nano_usd = reserved_nano_usd,
            failure_code = ${input.reasonCode},
            updated_at = ${input.now}
        where request_id = ${input.requestId}
      `

      return true
    }),
)

export const releaseExpiredReservationsForOrganization = Effect.fn(
  'WorkspaceUsageReservationStore.releaseExpiredReservationsForOrganization',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly now: number
  }): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      const expired = yield* client<{ requestId: string }>`
        select request_id as "requestId"
        from org_usage_reservation
        where organization_id = ${input.organizationId}
          and status = 'reserved'
          and expires_at <= ${input.now}
        order by created_at asc
        limit 25
      `

      for (const row of expired) {
        yield* releaseReservationWithClient(client, {
          requestId: row.requestId,
          reasonCode: 'reservation_expired',
          now: input.now,
        })
      }
    }),
)

export const reserveChatQuotaRecordEffect = Effect.fn(
  'WorkspaceUsageReservationStore.reserveChatQuotaRecord',
)(
  (input: {
    readonly organizationId?: string
    readonly userId: string
    readonly requestId: string
    readonly modelId: string
    readonly messages: readonly UIMessage[]
    readonly bypassQuota: boolean
  }): Effect.Effect<QuotaReservationResult, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      if (!input.organizationId || input.bypassQuota) {
        return { bypassed: true }
      }

      const organizationId = input.organizationId
      const sql = yield* PgClient.PgClient
      const now = Date.now()

      return yield* sql.withTransaction(
        Effect.gen(function* () {
          const existingReservation = yield* selectExistingReservation(sql, input.requestId)
          if (existingReservation) {
            if (
              existingReservation.status !== 'reserved'
              && existingReservation.status !== 'settled'
            ) {
              return yield* Effect.fail(
                new Error(
                  `Request ${input.requestId} already finalized with status ${existingReservation.status}`,
                ),
              )
            }

            const [seatRow] = yield* sql<{ seatIndex: number }>`
              select seat_index as "seatIndex"
              from org_seat_slot
              where id = ${existingReservation.seatSlotId}
              limit 1
            `

            return {
              bypassed: false,
              reservationId: existingReservation.id,
              seatSlotId: existingReservation.seatSlotId,
              seatIndex: seatRow?.seatIndex,
              estimatedNanoUsd: existingReservation.estimatedNanoUsd,
              reservedNanoUsd: existingReservation.reservedNanoUsd,
            }
          }

          const currentSubscription = yield* readCurrentUsageSubscriptionEffect(
            sql,
            organizationId,
          )
          const usagePolicy = yield* resolveEffectiveUsagePolicyRecordEffect({
            organizationId,
            currentSubscription,
            client: sql,
          })

          yield* ensureCurrentCycleSeatScaffoldingEffect(sql, {
            organizationId,
            currentSubscription,
            usagePolicy,
            now,
          })

          if (!usagePolicy.enabled || !currentSubscription) {
            return { bypassed: true }
          }

          yield* releaseExpiredReservationsForOrganization(sql, {
            organizationId,
            now,
          })

          const seatState = yield* ensureSeatAssignmentWithClient(sql, {
            organizationId,
            userId: input.userId,
            currentSubscription,
            usagePolicy,
            now,
          })

          if (!seatState) {
            const { cycleEndAt } = cycleBounds({
              now,
              currentPeriodStart: currentSubscription.currentPeriodStart,
              currentPeriodEnd: currentSubscription.currentPeriodEnd,
            })

            return yield* Effect.fail(
              new WorkspaceUsageQuotaExceededError({
                message: 'No seat quota is currently available for this member.',
                organizationId,
                userId: input.userId,
                retryAfterMs: Math.max(1, cycleEndAt - now),
                reasonCode: 'seat_quota_exhausted',
              }),
            )
          }

          const estimatedNanoUsd = estimateReservedCostNanoUsd({
            modelId: input.modelId,
            messages: input.messages,
            usagePolicy,
          })

          const reservedNanoUsd = Math.min(
            Math.max(0, seatState.seatCycle.remainingNanoUsd),
            estimatedNanoUsd,
          )
          const shortfallNanoUsd = Math.max(0, estimatedNanoUsd - reservedNanoUsd)
          const effectiveReservedNanoUsd =
            shortfallNanoUsd <= QUOTA_DRIFT_TOLERANCE_NANO_USD
              ? estimatedNanoUsd
              : reservedNanoUsd

          if (effectiveReservedNanoUsd < estimatedNanoUsd) {
            const { retryAfterMs, reasonCode } = resolveQuotaExhaustion({
              seatState,
              now,
            })

            return yield* Effect.fail(
              new WorkspaceUsageQuotaExceededError({
                message: 'This seat has exhausted its current quota.',
                organizationId,
                userId: input.userId,
                retryAfterMs,
                reasonCode,
              }),
            )
          }

          const balanceRows = yield* readBucketBalances(sql, seatState.seatSlotId)
          const seatCycleRow = balanceRows.find((row) => row.bucketType === 'seat_cycle')
          if (!seatCycleRow) {
            return yield* Effect.fail(new Error('seat cycle bucket missing'))
          }

          yield* sql`
            update org_seat_bucket_balance
            set remaining_nano_usd = remaining_nano_usd - ${effectiveReservedNanoUsd},
                updated_at = ${now}
            where id = ${seatCycleRow.id}
          `

          const allocation: ReservationAllocation[] = [
            {
              bucketBalanceId: seatCycleRow.id,
              bucketType: 'seat_cycle',
              amountNanoUsd: effectiveReservedNanoUsd,
            },
          ]

          const reservationId = `usage_reservation_${input.requestId}`

          yield* applyLedgerEntry(sql, {
            organizationId,
            seatSlotId: seatState.seatSlotId,
            bucketBalanceId: seatCycleRow.id,
            reservationId,
            entryType: 'reserve',
            amountNanoUsd: effectiveReservedNanoUsd,
            metadata: {
              requestId: input.requestId,
            },
            now,
          })

          yield* sql`
            insert into org_usage_reservation (
              id,
              request_id,
              organization_id,
              user_id,
              seat_slot_id,
              status,
              estimated_nano_usd,
              reserved_nano_usd,
              allocation,
              expires_at,
              created_at,
              updated_at
            )
            values (
              ${reservationId},
              ${input.requestId},
              ${organizationId},
              ${input.userId},
              ${seatState.seatSlotId},
              'reserved',
              ${estimatedNanoUsd},
              ${effectiveReservedNanoUsd},
              ${sqlJson(sql, allocation)},
              ${now + RESERVATION_TTL_MS},
              ${now},
              ${now}
            )
          `

          yield* Effect.catch(
            upsertPaidOrgUserUsageSummaryRecordWithClientEffect({
              client: sql,
              organizationId,
              userId: input.userId,
              now,
            }),
            () => Effect.void,
          )

          return {
            bypassed: false,
            reservationId,
            seatSlotId: seatState.seatSlotId,
            seatIndex: seatState.seatIndex,
            estimatedNanoUsd,
            reservedNanoUsd: effectiveReservedNanoUsd,
          }
        }),
      )
    }),
)

export async function reserveChatQuotaRecord(input: {
  readonly organizationId?: string
  readonly userId: string
  readonly requestId: string
  readonly modelId: string
  readonly messages: readonly UIMessage[]
  readonly bypassQuota: boolean
}): Promise<QuotaReservationResult> {
  return runBillingSqlEffect(reserveChatQuotaRecordEffect(input))
}

export const releaseReservationRecordEffect = Effect.fn(
  'WorkspaceUsageReservationStore.releaseReservationRecord',
)(
  (input: {
    readonly requestId: string
    readonly reasonCode: string
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const now = Date.now()

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const summaryTargetRows = yield* sql<{
            organizationId: string
            userId: string
          }>`
            select
              organization_id as "organizationId",
              user_id as "userId"
            from org_usage_reservation
            where request_id = ${input.requestId}
            limit 1
          `
          const summaryTarget = summaryTargetRows[0] ?? null

          yield* releaseReservationWithClient(sql, {
            requestId: input.requestId,
            reasonCode: input.reasonCode,
            now,
          })

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

export async function releaseReservationRecord(input: {
  readonly requestId: string
  readonly reasonCode: string
}): Promise<void> {
  await runBillingSqlEffect(releaseReservationRecordEffect(input))
}
