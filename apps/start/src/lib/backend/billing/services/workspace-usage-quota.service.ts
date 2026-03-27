import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { WorkspaceBillingPersistenceError, WorkspaceUsageQuotaExceededError  } from '../domain/errors'
import {
  ensureSeatAssignmentRecordEffect,
  releaseReservationRecordEffect,
  reserveChatQuotaRecordEffect,
  resolveEffectiveUsagePolicyRecordEffect,
} from './workspace-usage/persistence'
import { toPersistenceError } from './workspace-billing/shared'
import type { WorkspaceUsageQuotaServiceShape } from './workspace-usage/types'

export class WorkspaceUsageQuotaService extends ServiceMap.Service<
  WorkspaceUsageQuotaService,
  WorkspaceUsageQuotaServiceShape
>()('billing-backend/WorkspaceUsageQuotaService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient
      const provideSql = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
      ): Effect.Effect<TValue, TError> =>
        Effect.provideService(effect, PgClient.PgClient, client)

      return {
        resolveEffectiveUsagePolicy: Effect.fn('WorkspaceUsageQuotaService.resolveEffectiveUsagePolicy')(
          ({ organizationId }) =>
            provideSql(resolveEffectiveUsagePolicyRecordEffect({ organizationId })).pipe(
              Effect.mapError((cause) =>
                toPersistenceError('Failed to resolve workspace usage policy', {
                  organizationId,
                  cause,
                })
              ),
            ),
        ),

        ensureSeatAssignment: Effect.fn('WorkspaceUsageQuotaService.ensureSeatAssignment')(
          ({ organizationId, userId }) =>
            provideSql(ensureSeatAssignmentRecordEffect({ organizationId, userId })).pipe(
              Effect.mapError((cause) =>
                toPersistenceError('Failed to assign workspace seat slot', {
                  organizationId,
                  userId,
                  cause,
                })
              ),
            ),
        ),

        reserveChatQuota: Effect.fn('WorkspaceUsageQuotaService.reserveChatQuota')((input) =>
          provideSql(reserveChatQuotaRecordEffect(input)).pipe(
            Effect.mapError((cause) =>
              cause instanceof WorkspaceUsageQuotaExceededError
                ? cause
                : toPersistenceError('Failed to reserve workspace chat quota', {
                    organizationId: input.organizationId,
                    userId: input.userId,
                    cause,
                  })
            ),
          ),
        ),

        releaseReservation: Effect.fn('WorkspaceUsageQuotaService.releaseReservation')((input) =>
          provideSql(releaseReservationRecordEffect(input)).pipe(
            Effect.mapError((cause) =>
              toPersistenceError('Failed to release workspace chat quota reservation', {
                cause,
              })
            ),
            ),
        ),
      }
    }),
  )

  static readonly layerNoop = Layer.succeed(this, {
    resolveEffectiveUsagePolicy: Effect.fn(
      'WorkspaceUsageQuotaService.resolveEffectiveUsagePolicyNoop',
    )(() =>
      Effect.fail(
        new WorkspaceBillingPersistenceError({
          message: 'Workspace usage policy is unavailable in noop mode',
        }),
      )),
    ensureSeatAssignment: Effect.fn('WorkspaceUsageQuotaService.ensureSeatAssignmentNoop')(() =>
      Effect.succeed(null)),
    reserveChatQuota: Effect.fn('WorkspaceUsageQuotaService.reserveChatQuotaNoop')(() =>
      Effect.succeed({ bypassed: true })),
    releaseReservation: Effect.fn('WorkspaceUsageQuotaService.releaseReservationNoop')(() =>
      Effect.void),
  })

  static readonly layerMemory = this.layerNoop
}
