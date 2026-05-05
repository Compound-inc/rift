import { Effect } from 'effect'
import {
  syncOrganizationUsageQuotaStateEffect,
} from '@/lib/backend/billing/services/workspace-usage/policy-store'
import {
  releaseReservationWithClient,
} from '@/lib/backend/billing/services/workspace-usage/reservation-store'
import {
  CHAT_USAGE_FEATURE_KEY,
} from '@/lib/backend/billing/services/workspace-usage/shared'
import type {
  SingularityUsageResetMode,
} from '@/ee/singularity/shared/singularity-admin'
import {
  sqlJson,
} from '@/lib/backend/billing/services/sql'
import type { BillingSqlClient } from '@/lib/backend/billing/services/sql'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

type CurrentSubscriptionRow = {
  id: string
  planId: string
  seatCount: number
  currentPeriodStart: number | null
  currentPeriodEnd: number | null
}

function resolveCycleBounds(input: {
  now: number
  currentPeriodStart: number | null
  currentPeriodEnd: number | null
}) {
  const cycleStartAt = input.currentPeriodStart ?? input.now
  const fallbackCycleEndAt = cycleStartAt + THIRTY_DAYS_MS
  const cycleEndAt = Math.max(
    input.currentPeriodEnd ?? fallbackCycleEndAt,
    cycleStartAt + 1,
  )

  return { cycleStartAt, cycleEndAt }
}

const readCurrentSubscriptionForReset = Effect.fn(
  'SingularityUsageReset.readCurrentSubscriptionForReset',
)(
  (
    client: BillingSqlClient,
    organizationId: string,
  ): Effect.Effect<CurrentSubscriptionRow | null, unknown> =>
    Effect.gen(function* () {
      const [row] = yield* client<CurrentSubscriptionRow>`
        select
          id,
          plan_id as "planId",
          greatest(coalesce(seat_count, 1), 1) as "seatCount",
          current_period_start as "currentPeriodStart",
          current_period_end as "currentPeriodEnd"
        from org_subscription
        where organization_id = ${organizationId}
          and status in ('active', 'trialing', 'past_due')
        order by updated_at desc
        limit 1
        for update
      `

      return row ?? null
    }),
)

const releaseActiveReservationsForCycle = Effect.fn(
  'SingularityUsageReset.releaseActiveReservationsForCycle',
)(
  (
    client: BillingSqlClient,
    input: {
      organizationId: string
      cycleStartAt: number
      cycleEndAt: number
      now: number
      reasonCode: string
    },
  ): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      const rows = yield* client<{ requestId: string }>`
        select reservation.request_id as "requestId"
        from org_usage_reservation reservation
        join org_seat_slot slot
          on slot.id = reservation.seat_slot_id
        where reservation.organization_id = ${input.organizationId}
          and reservation.status = 'reserved'
          and slot.cycle_start_at = ${input.cycleStartAt}
          and slot.cycle_end_at = ${input.cycleEndAt}
        order by reservation.created_at asc
      `

      for (const row of rows) {
        yield* releaseReservationWithClient(client, {
          requestId: row.requestId,
          reasonCode: input.reasonCode,
          now: input.now,
        })
      }
    }),
)

const forgiveCurrentCycleSettledUsage = Effect.fn(
  'SingularityUsageReset.forgiveCurrentCycleSettledUsage',
)(
  (
    client: BillingSqlClient,
    input: {
      organizationId: string
      actorUserId: string
      cycleStartAt: number
      cycleEndAt: number
      now: number
      mode: SingularityUsageResetMode
    },
  ): Effect.Effect<void, unknown> =>
    client`
      with target_slots as (
        select id
        from org_seat_slot
        where organization_id = ${input.organizationId}
          and cycle_start_at = ${input.cycleStartAt}
          and cycle_end_at = ${input.cycleEndAt}
      )
      update org_monetization_event event
      set status = 'reset_forgiven',
          forgiven_nano_usd = event.actual_nano_usd,
          metadata = coalesce(event.metadata, '{}'::jsonb) || ${sqlJson(client, {
            adminUsageReset: {
              actorUserId: input.actorUserId,
              resetAt: input.now,
              mode: input.mode,
            },
          })}::jsonb,
          updated_at = ${input.now}
      where event.status = 'settled'
        and exists (
          select 1
          from target_slots
          where target_slots.id = event.seat_slot_id
        )
    `.pipe(Effect.asVoid),
)

const resetCurrentCycleBucketBalances = Effect.fn(
  'SingularityUsageReset.resetCurrentCycleBucketBalances',
)(
  (
    client: BillingSqlClient,
    input: {
      organizationId: string
      cycleStartAt: number
      cycleEndAt: number
      now: number
    },
  ): Effect.Effect<void, unknown> =>
    client`
      update org_seat_bucket_balance balance
      set remaining_nano_usd = balance.total_nano_usd,
          updated_at = ${input.now}
      from org_seat_slot slot
      where slot.id = balance.seat_slot_id
        and slot.organization_id = ${input.organizationId}
        and slot.cycle_start_at = ${input.cycleStartAt}
        and slot.cycle_end_at = ${input.cycleEndAt}
    `.pipe(Effect.asVoid),
)

const writeZeroUsageSummaries = Effect.fn(
  'SingularityUsageReset.writeZeroUsageSummaries',
)(
  (
    client: BillingSqlClient,
    input: {
      organizationId: string
      cycleStartAt: number
      cycleEndAt: number
      now: number
    },
  ): Effect.Effect<void, unknown> =>
    client`
      insert into org_user_usage_summary (
        id,
        organization_id,
        user_id,
        kind,
        seat_index,
        monthly_used_percent,
        monthly_remaining_percent,
        monthly_reset_at,
        created_at,
        updated_at
      )
      select
        'org_user_usage_summary:' || member."organizationId" || ':' || member."userId",
        member."organizationId",
        member."userId",
        'paid',
        slot.seat_index,
        0,
        100,
        ${input.cycleEndAt},
        ${input.now},
        ${input.now}
      from member
      left join org_seat_slot_assignment assignment
        on assignment.organization_id = member."organizationId"
       and assignment.user_id = member."userId"
       and assignment.cycle_start_at = ${input.cycleStartAt}
       and assignment.cycle_end_at = ${input.cycleEndAt}
       and assignment.assignment_status = 'active'
      left join org_seat_slot slot
        on slot.id = assignment.seat_slot_id
      where member."organizationId" = ${input.organizationId}
      on conflict (organization_id, user_id) do update
      set kind = excluded.kind,
          seat_index = excluded.seat_index,
          monthly_used_percent = excluded.monthly_used_percent,
          monthly_remaining_percent = excluded.monthly_remaining_percent,
          monthly_reset_at = excluded.monthly_reset_at,
          updated_at = excluded.updated_at
    `.pipe(Effect.asVoid),
)

const startFreshBillingCycle = Effect.fn(
  'SingularityUsageReset.startFreshBillingCycle',
)(
  (
    client: BillingSqlClient,
    input: {
      organizationId: string
      subscriptionId: string
      now: number
      cycleEndAt: number
    },
  ): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      yield* client`
        update org_subscription
        set current_period_start = ${input.now},
            current_period_end = ${input.cycleEndAt},
            updated_at = ${input.now}
        where id = ${input.subscriptionId}
          and organization_id = ${input.organizationId}
      `

      yield* client`
        update org_seat_slot
        set status = 'inactive',
            current_assignee_user_id = null,
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
          and status = 'active'
      `

      yield* client`
        update org_seat_slot_assignment
        set assignment_status = 'released',
            released_at = coalesce(released_at, ${input.now}),
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
          and assignment_status = 'active'
      `
    }),
)

/**
 * Singularity resets must update durable quota facts, not only the cached
 * percentages. Current-cycle resets forgive settled monetization rows so later
 * reconciliation cannot re-drain the bucket from old events. Fresh-cycle resets
 * move the subscription period forward, leaving historical monetization intact
 * while creating a new set of empty seat slots for the next 30 days.
 */
export const resetOrganizationUsageEffect = Effect.fn(
  'SingularityUsageReset.resetOrganizationUsage',
)(
  (
    client: BillingSqlClient,
    input: {
      organizationId: string
      actorUserId: string
      mode: SingularityUsageResetMode
      now?: number
    },
  ): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      const now = input.now ?? Date.now()
      const currentSubscription = yield* readCurrentSubscriptionForReset(
        client,
        input.organizationId,
      )

      if (!currentSubscription || currentSubscription.planId === 'free') {
        return
      }

      const currentCycle = resolveCycleBounds({
        now,
        currentPeriodStart: currentSubscription.currentPeriodStart,
        currentPeriodEnd: currentSubscription.currentPeriodEnd,
      })
      const resetMetadata = {
        lastUsageReset: {
          actorUserId: input.actorUserId,
          resetAt: now,
          mode: input.mode,
          featureKey: CHAT_USAGE_FEATURE_KEY,
        },
      }

      yield* releaseActiveReservationsForCycle(client, {
        organizationId: input.organizationId,
        cycleStartAt: currentCycle.cycleStartAt,
        cycleEndAt: currentCycle.cycleEndAt,
        now,
        reasonCode: `admin_${input.mode}`,
      })

      if (input.mode === 'current_cycle_usage') {
        yield* forgiveCurrentCycleSettledUsage(client, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          cycleStartAt: currentCycle.cycleStartAt,
          cycleEndAt: currentCycle.cycleEndAt,
          now,
          mode: input.mode,
        })
        yield* resetCurrentCycleBucketBalances(client, {
          organizationId: input.organizationId,
          cycleStartAt: currentCycle.cycleStartAt,
          cycleEndAt: currentCycle.cycleEndAt,
          now,
        })
        yield* writeZeroUsageSummaries(client, {
          organizationId: input.organizationId,
          cycleStartAt: currentCycle.cycleStartAt,
          cycleEndAt: currentCycle.cycleEndAt,
          now,
        })
        yield* client`
          update org_subscription
          set metadata = coalesce(metadata, '{}'::jsonb) || ${sqlJson(client, resetMetadata)}::jsonb,
              updated_at = ${now}
          where id = ${currentSubscription.id}
        `
        return
      }

      const nextCycleEndAt = now + THIRTY_DAYS_MS

      yield* startFreshBillingCycle(client, {
        organizationId: input.organizationId,
        subscriptionId: currentSubscription.id,
        now,
        cycleEndAt: nextCycleEndAt,
      })
      yield* client`
        update org_subscription
        set metadata = coalesce(metadata, '{}'::jsonb) || ${sqlJson(client, resetMetadata)}::jsonb
        where id = ${currentSubscription.id}
      `
      yield* syncOrganizationUsageQuotaStateEffect({
        organizationId: input.organizationId,
        client,
        now,
      })
      yield* writeZeroUsageSummaries(client, {
        organizationId: input.organizationId,
        cycleStartAt: now,
        cycleEndAt: nextCycleEndAt,
        now,
      })
    }),
)
