import { authPool } from '@/lib/backend/auth/auth-pool'
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
import { upsertPaidOrgUserUsageSummaryRecordWithClient } from './usage-summary-store'

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
  if (!input.organizationId) {
    return
  }

  const client = await authPool.connect()
  const now = Date.now()
  const actualNanoUsd = input.actualCostUsd != null ? Math.round(input.actualCostUsd * 1_000_000_000) : 0

  try {
    await client.query('BEGIN')
    const reservation = await selectExistingReservation(client, input.requestId)
    const usageEventId = `usage_event_${input.requestId}`
    const monetizationEventId = `monetization_event_${input.requestId}`

    await client.query(
      `insert into org_usage_event (
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
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
       on conflict (request_id) do update
       set assistant_message_id = excluded.assistant_message_id,
           model_id = excluded.model_id,
           used_byok = excluded.used_byok,
           estimated_nano_usd = excluded.estimated_nano_usd,
           actual_nano_usd = excluded.actual_nano_usd,
           metadata = excluded.metadata`,
      [
        usageEventId,
        input.requestId,
        input.organizationId,
        input.userId,
        reservation?.seatSlotId ?? null,
        input.assistantMessageId,
        input.modelId,
        input.usedByok,
        input.estimatedCostNanoUsd ?? reservation?.estimatedNanoUsd ?? null,
        actualNanoUsd,
        JSON.stringify({}),
        now,
      ],
    )

    await client.query(
      `insert into org_monetization_event (
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
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb, $11, $11)
       on conflict (request_id) do update
       set estimated_nano_usd = excluded.estimated_nano_usd,
           actual_nano_usd = excluded.actual_nano_usd,
           updated_at = excluded.updated_at`,
      [
        monetizationEventId,
        input.requestId,
        input.organizationId,
        input.userId,
        reservation?.seatSlotId ?? null,
        usageEventId,
        reservation?.id ?? null,
        input.estimatedCostNanoUsd ?? reservation?.estimatedNanoUsd ?? 0,
        actualNanoUsd,
        input.usedByok || !reservation ? 'bypassed' : 'pending',
        now,
      ],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function settleMonetizationEventRecord(input: {
  readonly requestId: string
}): Promise<void> {
  const client = await authPool.connect()
  const now = Date.now()
  let summaryTarget: { organizationId: string; userId: string } | null = null

  try {
    await client.query('BEGIN')
    const monetizationResult = await client.query<MonetizationRow>(
      `select
         id,
         reservation_id as "reservationId",
         actual_nano_usd as "actualNanoUsd",
         estimated_nano_usd as "estimatedNanoUsd",
         status
       from org_monetization_event
       where request_id = $1
       for update`,
      [input.requestId],
    )
    const monetization = monetizationResult.rows[0]
    if (!monetization || monetization.status === 'settled' || monetization.status === 'bypassed') {
      await client.query('COMMIT')
      return
    }

    const reservation = monetization.reservationId
      ? await client.query<
          UsageReservationRow
          & {
            allocation: unknown
            organizationId: string
            userId: string
          }
        >(
          `select
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
           where id = $1
           for update`,
          [monetization.reservationId],
        ).then((result) => {
          const row = result.rows[0]
          return row
            ? { ...row, allocation: parseJson(row.allocation, [] as ReservationAllocation[]) }
            : null
        })
      : null

    if (!reservation) {
      await client.query(
        `update org_monetization_event
         set status = 'bypassed',
             updated_at = $2
         where request_id = $1`,
        [input.requestId, now],
      )
      await client.query('COMMIT')
      return
    }
    summaryTarget = {
      organizationId: reservation.organizationId,
      userId: reservation.userId,
    }

    const bucketRows = await readBucketBalances(client, reservation.seatSlotId)
    const balanceById = new Map(bucketRows.map((row) => [row.id, row]))
    const seatOrgResult = await client.query<{ organizationId: string }>(
      `select organization_id as "organizationId"
       from org_seat_slot
       where id = $1
       limit 1`,
      [reservation.seatSlotId],
    )
    const organizationId = seatOrgResult.rows[0]?.organizationId ?? ''

    let remainingRefund = Math.max(0, reservation.reservedNanoUsd - monetization.actualNanoUsd)
    let refundedNanoUsd = 0

    for (const allocation of [...reservation.allocation].reverse()) {
      if (remainingRefund <= 0) break
      const balance = balanceById.get(allocation.bucketBalanceId)
      if (!balance) continue

      const refundable = Math.min(remainingRefund, allocation.amountNanoUsd)
      if (
        allocation.bucketType === 'seat_window'
        && allocation.windowStartedAt
        && balance.currentWindowStartedAt !== allocation.windowStartedAt
      ) {
        refundedNanoUsd += refundable
        remainingRefund -= refundable
        await applyLedgerEntry(client, {
          organizationId,
          seatSlotId: reservation.seatSlotId,
          bucketBalanceId: balance.id,
          reservationId: reservation.id,
          monetizationEventId: monetization.id,
          entryType: 'refund_expired_window',
          amountNanoUsd: refundable,
          metadata: { requestId: input.requestId },
          now,
        })
        continue
      }

      await client.query(
        `update org_seat_bucket_balance
         set remaining_nano_usd = least(total_nano_usd, remaining_nano_usd + $2),
             updated_at = $3
         where id = $1`,
        [balance.id, refundable, now],
      )
      refundedNanoUsd += refundable
      remainingRefund -= refundable
      await applyLedgerEntry(client, {
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

    let remainingCapture = Math.max(0, monetization.actualNanoUsd - reservation.reservedNanoUsd)

    for (const allocation of reservation.allocation) {
      if (remainingCapture <= 0) break
      const balance = balanceById.get(allocation.bucketBalanceId)
      if (!balance) continue
      if (
        allocation.bucketType === 'seat_window'
        && allocation.windowStartedAt
        && balance.currentWindowStartedAt !== allocation.windowStartedAt
      ) {
        continue
      }

      const captureAmount = Math.min(remainingCapture, balance.remainingNanoUsd)
      if (captureAmount <= 0) continue
      await client.query(
        `update org_seat_bucket_balance
         set remaining_nano_usd = remaining_nano_usd - $2,
             updated_at = $3
         where id = $1`,
        [balance.id, captureAmount, now],
      )
      remainingCapture -= captureAmount
      await applyLedgerEntry(client, {
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
      const overageBalance = bucketRows.find((bucket) => bucket.bucketType === 'seat_overage')
      if (!overageBalance) {
        throw new Error('seat overage bucket missing')
      }

      await client.query(
        `update org_seat_bucket_balance
         set remaining_nano_usd = remaining_nano_usd - $2,
             updated_at = $3
         where id = $1`,
        [overageBalance.id, remainingCapture, now],
      )
      await applyLedgerEntry(client, {
        organizationId,
        seatSlotId: reservation.seatSlotId,
        bucketBalanceId: overageBalance.id,
        reservationId: reservation.id,
        monetizationEventId: monetization.id,
        entryType: 'capture_debt',
        amountNanoUsd: remainingCapture,
        metadata: { requestId: input.requestId },
        now,
      })
      remainingCapture = 0
    }

    await client.query(
      `update org_usage_reservation
       set status = 'settled',
           updated_at = $2
       where id = $1`,
      [reservation.id, now],
    )

    await client.query(
      `update org_monetization_event
       set captured_nano_usd = $2,
           refunded_nano_usd = $3,
           forgiven_nano_usd = $4,
           status = 'settled',
           updated_at = $5
       where id = $1`,
      [
        monetization.id,
        monetization.actualNanoUsd,
        refundedNanoUsd,
        0,
        now,
      ],
    )

    try {
      await upsertPaidOrgUserUsageSummaryRecordWithClient({
        client,
        organizationId: summaryTarget.organizationId,
        userId: summaryTarget.userId,
        now,
      })
    } catch {}
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
