import type { PoolClient } from 'pg'
import type { UIMessage } from 'ai'
import { authPool } from '@/lib/backend/auth/auth-pool'
import {
  WorkspaceUsageQuotaExceededError,
} from '../../domain/errors'
import {
  estimateReservedCostNanoUsd,
  RESERVATION_TTL_MS,
} from './shared'
import {
  asNumber,
  parseJson,
} from './core'
import type {
  ReservationAllocation,
  UsageReservationRow,
} from './core'
import {
  ensureCurrentCycleSeatScaffolding,
  readCurrentUsageSubscription,
  resolveEffectiveUsagePolicyRecord,
} from './policy-store'
import {
  ensureSeatAssignmentWithClient,
  readBucketBalances,
} from './seat-store'
import type { QuotaReservationResult } from './types'
import { upsertPaidOrgUserUsageSummaryRecordWithClient } from './usage-summary-store'

export async function selectExistingReservation(
  client: PoolClient,
  requestId: string,
): Promise<UsageReservationRow | null> {
  const result = await client.query<UsageReservationRow & { allocation: unknown }>(
    `select
       id,
       request_id as "requestId",
       seat_slot_id as "seatSlotId",
       status,
       estimated_nano_usd as "estimatedNanoUsd",
       reserved_nano_usd as "reservedNanoUsd",
       allocation
     from org_usage_reservation
     where request_id = $1
     limit 1`,
    [requestId],
  )
  const row = result.rows[0]
  if (!row) {
    return null
  }
  return {
    ...row,
    estimatedNanoUsd: asNumber(row.estimatedNanoUsd),
    reservedNanoUsd: asNumber(row.reservedNanoUsd),
    allocation: parseJson(row.allocation, [] as ReservationAllocation[]),
  }
}

export async function applyLedgerEntry(
  client: PoolClient,
  input: {
    readonly organizationId: string
    readonly seatSlotId: string
    readonly bucketBalanceId: string
    readonly reservationId?: string
    readonly monetizationEventId?: string
    readonly entryType: string
    readonly amountNanoUsd: number
    readonly metadata?: Record<string, unknown>
    readonly now: number
  },
): Promise<void> {
  await client.query(
    `insert into org_seat_bucket_ledger (
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
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     on conflict (id) do nothing`,
    [
      `seat_bucket_ledger_${input.entryType}_${input.bucketBalanceId}_${input.reservationId ?? input.monetizationEventId ?? input.now}_${input.amountNanoUsd}`,
      input.organizationId,
      input.seatSlotId,
      input.bucketBalanceId,
      input.reservationId ?? null,
      input.monetizationEventId ?? null,
      input.entryType,
      input.amountNanoUsd,
      JSON.stringify(input.metadata ?? {}),
      input.now,
    ],
  )
}

export async function releaseReservationWithClient(
  client: PoolClient,
  input: {
    readonly requestId: string
    readonly reasonCode: string
    readonly now: number
  },
): Promise<boolean> {
  const reservation = await selectExistingReservation(client, input.requestId)
  if (!reservation || reservation.status !== 'reserved') {
    return false
  }

  const balanceRows = await readBucketBalances(client, reservation.seatSlotId)
  const balanceById = new Map(balanceRows.map((row) => [row.id, row]))
  const skippedBucketIds = new Set<string>()
  const orgResult = await client.query<{ organizationId: string }>(
    `select organization_id as "organizationId"
     from org_seat_slot
     where id = $1
     limit 1`,
    [reservation.seatSlotId],
  )
  const organizationId = orgResult.rows[0]?.organizationId ?? ''

  for (const allocation of reservation.allocation) {
    const balance = balanceById.get(allocation.bucketBalanceId)
    if (!balance) continue

    if (
      allocation.bucketType === 'seat_window'
      && allocation.windowStartedAt
      && balance.currentWindowStartedAt !== allocation.windowStartedAt
    ) {
      skippedBucketIds.add(balance.id)
      await applyLedgerEntry(client, {
        organizationId,
        seatSlotId: reservation.seatSlotId,
        bucketBalanceId: balance.id,
        reservationId: reservation.id,
        entryType: 'release_skipped',
        amountNanoUsd: allocation.amountNanoUsd,
        metadata: {
          reasonCode: input.reasonCode,
          skipped: 'expired_window',
        },
        now: input.now,
      })
      continue
    }

    await client.query(
      `update org_seat_bucket_balance
       set remaining_nano_usd = least(total_nano_usd, remaining_nano_usd + $2),
           updated_at = $3
       where id = $1`,
      [balance.id, allocation.amountNanoUsd, input.now],
    )
  }

  for (const allocation of reservation.allocation) {
    const balance = balanceById.get(allocation.bucketBalanceId)
    if (!balance || skippedBucketIds.has(balance.id)) continue
    await applyLedgerEntry(client, {
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

  await client.query(
    `update org_usage_reservation
     set status = 'released',
         released_nano_usd = reserved_nano_usd,
         failure_code = $2,
         updated_at = $3
     where request_id = $1`,
    [input.requestId, input.reasonCode, input.now],
  )

  return true
}

export async function releaseExpiredReservationsForOrganization(
  client: PoolClient,
  input: {
    readonly organizationId: string
    readonly now: number
  },
): Promise<void> {
  const expired = await client.query<{ requestId: string }>(
    `select request_id as "requestId"
     from org_usage_reservation
     where organization_id = $1
       and status = 'reserved'
       and expires_at <= $2
     order by created_at asc
     limit 25`,
    [input.organizationId, input.now],
  )

  for (const row of expired.rows) {
    await releaseReservationWithClient(client, {
      requestId: row.requestId,
      reasonCode: 'reservation_expired',
      now: input.now,
    })
  }
}

export async function reserveChatQuotaRecord(input: {
  readonly organizationId?: string
  readonly userId: string
  readonly requestId: string
  readonly modelId: string
  readonly messages: readonly UIMessage[]
  readonly bypassQuota: boolean
}): Promise<QuotaReservationResult> {
  if (!input.organizationId || input.bypassQuota) {
    return { bypassed: true }
  }

  const client = await authPool.connect()
  const now = Date.now()

  try {
    await client.query('BEGIN')

    const existingReservation = await selectExistingReservation(client, input.requestId)
    if (existingReservation) {
      if (existingReservation.status !== 'reserved' && existingReservation.status !== 'settled') {
        throw new Error(
          `Request ${input.requestId} already finalized with status ${existingReservation.status}`,
        )
      }
      const seatResult = await client.query<{ seatIndex: number }>(
        `select seat_index as "seatIndex"
         from org_seat_slot
         where id = $1
         limit 1`,
        [existingReservation.seatSlotId],
      )
      await client.query('COMMIT')
      return {
        bypassed: false,
        reservationId: existingReservation.id,
        seatSlotId: existingReservation.seatSlotId,
        seatIndex: seatResult.rows[0]?.seatIndex,
        estimatedNanoUsd: existingReservation.estimatedNanoUsd,
        reservedNanoUsd: existingReservation.reservedNanoUsd,
      }
    }

    const currentSubscription = await readCurrentUsageSubscription(client, input.organizationId)
    const usagePolicy = await resolveEffectiveUsagePolicyRecord({
      organizationId: input.organizationId,
      currentSubscription,
      client,
    })
    await ensureCurrentCycleSeatScaffolding(client, {
      organizationId: input.organizationId,
      currentSubscription,
      usagePolicy,
      now,
    })

    if (!usagePolicy.enabled || !currentSubscription) {
      await client.query('COMMIT')
      return { bypassed: true }
    }

    await releaseExpiredReservationsForOrganization(client, {
      organizationId: input.organizationId,
      now,
    })

    const seatState = await ensureSeatAssignmentWithClient(client, {
      organizationId: input.organizationId,
      userId: input.userId,
      currentSubscription,
      usagePolicy,
      now,
    })

    if (!seatState) {
      throw new WorkspaceUsageQuotaExceededError({
        message: 'No seat quota is currently available for this member.',
        organizationId: input.organizationId,
        userId: input.userId,
        retryAfterMs: usagePolicy.seatWindowDurationMs,
        reasonCode: 'seat_quota_exhausted',
      })
    }

    const estimatedNanoUsd = estimateReservedCostNanoUsd({
      modelId: input.modelId,
      messages: input.messages,
      usagePolicy,
    })

    const seatWindowBalance = seatState.seatWindow
    const seatOverageBalance = seatState.seatOverage
    const reserveFromWindow = Math.min(
      Math.max(0, seatWindowBalance.remainingNanoUsd),
      estimatedNanoUsd,
    )
    const reserveFromOverage = Math.min(
      Math.max(0, seatOverageBalance.remainingNanoUsd),
      Math.max(0, estimatedNanoUsd - reserveFromWindow),
    )
    const reservedNanoUsd = reserveFromWindow + reserveFromOverage

    if (reservedNanoUsd < estimatedNanoUsd) {
      const retryAfterMs = Math.max(
        1,
        (seatWindowBalance.currentWindowEndsAt ?? (now + usagePolicy.seatWindowDurationMs)) - now,
      )
      const reasonCode
        = seatWindowBalance.remainingNanoUsd <= 0 && seatOverageBalance.remainingNanoUsd <= 0
          ? 'seat_quota_exhausted'
          : seatWindowBalance.remainingNanoUsd <= 0
            ? 'seat_window_exhausted'
            : 'seat_overage_exhausted'

      throw new WorkspaceUsageQuotaExceededError({
        message: 'This seat has exhausted its current quota.',
        organizationId: input.organizationId,
        userId: input.userId,
        retryAfterMs,
        reasonCode,
      })
    }

    const allocation: ReservationAllocation[] = []
    if (reserveFromWindow > 0) {
      const balanceRows = await readBucketBalances(client, seatState.seatSlotId)
      const seatWindowRow = balanceRows.find((row) => row.bucketType === 'seat_window')
      if (!seatWindowRow) {
        throw new Error('seat window bucket missing')
      }
      await client.query(
        `update org_seat_bucket_balance
         set remaining_nano_usd = remaining_nano_usd - $2,
             updated_at = $3
         where id = $1`,
        [seatWindowRow.id, reserveFromWindow, now],
      )
      allocation.push({
        bucketBalanceId: seatWindowRow.id,
        bucketType: 'seat_window',
        amountNanoUsd: reserveFromWindow,
        windowStartedAt: seatWindowRow.currentWindowStartedAt ?? undefined,
      })
      await applyLedgerEntry(client, {
        organizationId: input.organizationId,
        seatSlotId: seatState.seatSlotId,
        bucketBalanceId: seatWindowRow.id,
        reservationId: `usage_reservation_${input.requestId}`,
        entryType: 'reserve',
        amountNanoUsd: reserveFromWindow,
        metadata: {
          requestId: input.requestId,
        },
        now,
      })
    }

    if (reserveFromOverage > 0) {
      const balanceRows = await readBucketBalances(client, seatState.seatSlotId)
      const seatOverageRow = balanceRows.find((row) => row.bucketType === 'seat_overage')
      if (!seatOverageRow) {
        throw new Error('seat overage bucket missing')
      }
      await client.query(
        `update org_seat_bucket_balance
         set remaining_nano_usd = remaining_nano_usd - $2,
             updated_at = $3
         where id = $1`,
        [seatOverageRow.id, reserveFromOverage, now],
      )
      allocation.push({
        bucketBalanceId: seatOverageRow.id,
        bucketType: 'seat_overage',
        amountNanoUsd: reserveFromOverage,
      })
      await applyLedgerEntry(client, {
        organizationId: input.organizationId,
        seatSlotId: seatState.seatSlotId,
        bucketBalanceId: seatOverageRow.id,
        reservationId: `usage_reservation_${input.requestId}`,
        entryType: 'reserve',
        amountNanoUsd: reserveFromOverage,
        metadata: {
          requestId: input.requestId,
        },
        now,
      })
    }

    const reservationId = `usage_reservation_${input.requestId}`
    await client.query(
      `insert into org_usage_reservation (
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
       values ($1, $2, $3, $4, $5, 'reserved', $6, $7, $8::jsonb, $9, $10, $10)`,
      [
        reservationId,
        input.requestId,
        input.organizationId,
        input.userId,
        seatState.seatSlotId,
        estimatedNanoUsd,
        reservedNanoUsd,
        JSON.stringify(allocation),
        now + RESERVATION_TTL_MS,
        now,
      ],
    )

    try {
      await upsertPaidOrgUserUsageSummaryRecordWithClient({
        client,
        organizationId: input.organizationId,
        userId: input.userId,
        now,
      })
    } catch {}
    await client.query('COMMIT')
    return {
      bypassed: false,
      reservationId,
      seatSlotId: seatState.seatSlotId,
      seatIndex: seatState.seatIndex,
      estimatedNanoUsd,
      reservedNanoUsd,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function releaseReservationRecord(input: {
  readonly requestId: string
  readonly reasonCode: string
}): Promise<void> {
  const client = await authPool.connect()
  const now = Date.now()
  let summaryTarget: { organizationId: string; userId: string } | null = null

  try {
    await client.query('BEGIN')
    const summaryTargetResult = await client.query<{
      organizationId: string
      userId: string
    }>(
      `select
         organization_id as "organizationId",
         user_id as "userId"
       from org_usage_reservation
       where request_id = $1
       limit 1`,
      [input.requestId],
    )
    summaryTarget = summaryTargetResult.rows[0] ?? null
    await releaseReservationWithClient(client, {
      requestId: input.requestId,
      reasonCode: input.reasonCode,
      now,
    })
    if (summaryTarget) {
      try {
        await upsertPaidOrgUserUsageSummaryRecordWithClient({
          client,
          organizationId: summaryTarget.organizationId,
          userId: summaryTarget.userId,
          now,
        })
      } catch {}
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
