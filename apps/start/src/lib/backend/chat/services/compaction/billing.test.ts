import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { SqlClient } from 'effect/unstable/sql'
import { billSummary } from './billing'
import type {
  WorkspaceUsageQuotaServiceShape,
  WorkspaceUsageSettlementServiceShape,
} from '@/lib/backend/billing/services/workspace-usage/types'
import { WorkspaceBillingPersistenceError } from '@/lib/backend/billing/domain/errors'
import { ModelProviderError } from '../../domain/errors'
import type { SummaryResult } from './summarize'

const result: SummaryResult = {
  text: 'Summary',
  usage: {
    inputTokens: 100,
    outputTokens: 10,
    totalTokens: 110,
    inputTokenDetails: {
      noCacheTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    outputTokenDetails: { textTokens: 10, reasoningTokens: 0 },
  },
  providerMetadata: { gateway: { cost: '0.001' } },
}

function harness() {
  const reserve = vi.fn<WorkspaceUsageQuotaServiceShape['reserveChatQuota']>(
    () => Effect.succeed({ bypassed: false, estimatedNanoUsd: 1_000_000 }),
  )
  const release = vi.fn<WorkspaceUsageQuotaServiceShape['releaseReservation']>(
    () => Effect.void,
  )
  const record = vi.fn<WorkspaceUsageSettlementServiceShape['recordChatUsage']>(
    () => Effect.void,
  )
  const settle = vi.fn<
    WorkspaceUsageSettlementServiceShape['settleMonetizationEvent']
  >(() => Effect.void)
  const generate = vi.fn(() => Effect.succeed(result))
  const input = {
    quota: {
      reserveChatQuota: reserve,
      releaseReservation: release,
      ensureSeatAssignment: () => Effect.succeed(null),
      resolveEffectiveUsagePolicy: () => Effect.die('unused'),
    },
    settlement: { recordChatUsage: record, settleMonetizationEvent: settle },
    organizationId: 'org',
    userId: 'user',
    checkpointId: 'checkpoint',
    modelId: 'openai/gpt-4.1-nano',
    usedByok: false,
    messages: [],
    generate: Effect.suspend(generate),
  }
  return { input, reserve, release, record, settle, generate }
}

describe('summary settlement', () => {
  it('commits usage outside the checkpoint transaction so a later checkpoint failure cannot erase spend', async () => {
    const h = harness()
    h.reserve.mockImplementation(() =>
      Effect.map(
        Effect.serviceOption(SqlClient.TransactionConnection),
        (connection) => {
          expect(connection._tag).toBe('None')
          return { bypassed: false, estimatedNanoUsd: 1_000_000 }
        },
      ),
    )
    await Effect.runPromise(
      billSummary(h.input).pipe(
        Effect.provideService(SqlClient.TransactionConnection, [
          null as never,
          0,
        ]),
      ),
    )
    expect(h.record).toHaveBeenCalledOnce()
    expect(h.settle).toHaveBeenCalledWith({
      requestId: 'compaction:checkpoint',
    })
  })

  it('retries settlement with one idempotent key and never repeats the provider call', async () => {
    const h = harness()
    h.settle.mockReturnValueOnce(
      Effect.fail(
        new WorkspaceBillingPersistenceError({ message: 'Transient failure' }),
      ),
    )
    await Effect.runPromise(billSummary(h.input))
    expect(h.generate).toHaveBeenCalledOnce()
    expect(h.reserve).toHaveBeenCalledOnce()
    expect(h.record).toHaveBeenCalledTimes(2)
    expect(h.settle).toHaveBeenCalledTimes(2)
    expect(
      new Set(h.record.mock.calls.map(([value]) => value.requestId)),
    ).toEqual(new Set(['compaction:checkpoint']))
  })

  it('finishes record and settlement despite interruption after provider completion', async () => {
    const h = harness()
    let finishRecord!: () => void
    let recordStarted!: () => void
    const ready = new Promise<void>((resolve) => { recordStarted = resolve })
    h.record.mockImplementation(() => Effect.promise(() => new Promise<void>((resolve) => {
      finishRecord = resolve
      recordStarted()
    })))
    const controller = new AbortController()
    const running = Effect.runPromiseExit(billSummary(h.input), { signal: controller.signal })
    await ready
    controller.abort()
    finishRecord()
    await running
    expect(h.settle).toHaveBeenCalledWith({ requestId: 'compaction:checkpoint' })
    expect(h.generate).toHaveBeenCalledOnce()
    expect(h.release).not.toHaveBeenCalled()
  })

  it('releases quota if interruption arrives while the reservation is being acquired', async () => {
    const h = harness()
    const controller = new AbortController()
    let finishReservation!: () => void
    let reservationStarted!: () => void
    const ready = new Promise<void>((resolve) => { reservationStarted = resolve })
    h.reserve.mockImplementation(() => Effect.promise(() => new Promise((resolve) => {
      finishReservation = () => resolve({ bypassed: false, estimatedNanoUsd: 1_000_000 })
      reservationStarted()
    })))
    const running = Effect.runPromiseExit(billSummary(h.input), { signal: controller.signal })
    await ready
    controller.abort()
    finishReservation()
    await running
    expect(h.release).toHaveBeenCalledWith({ requestId: 'compaction:checkpoint', reasonCode: 'compaction_interrupted' })
    expect(h.generate).not.toHaveBeenCalled()
    expect(h.record).not.toHaveBeenCalled()
  })

  it('preserves BYOK quota bypass and keeps a paid summary independent of answer completion', async () => {
    const h = harness()
    await Effect.runPromise(billSummary({ ...h.input, usedByok: true }))
    expect(h.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ bypassQuota: true }),
    )
    expect(h.record).toHaveBeenCalledWith(
      expect.objectContaining({
        usedByok: true,
        organizationId: 'org',
        userId: 'user',
        actualCostUsd: 0.001,
        assistantMessageId: 'checkpoint',
      }),
    )
    expect(h.release).not.toHaveBeenCalled()
  })

  it('releases the summary reservation on provider failure without recording imaginary usage', async () => {
    const h = harness()
    await Effect.runPromise(
      Effect.flip(
        billSummary({
          ...h.input,
          generate: Effect.fail(
            new ModelProviderError({
              message: 'provider down',
              requestId: 'r',
            }),
          ),
        }),
      ),
    )
    expect(h.release).toHaveBeenCalledWith({
      requestId: 'compaction:checkpoint',
      reasonCode: 'compaction_failed',
    })
    expect(h.record).not.toHaveBeenCalled()
  })
})
