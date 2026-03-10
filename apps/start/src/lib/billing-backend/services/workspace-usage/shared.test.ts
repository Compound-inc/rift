import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import type { ChatMessageMetadata } from '@/lib/chat-contracts/message-metadata'
import {
  estimateReservedCostNanoUsd,
  resolveDefaultUsagePolicyTemplate,
  resolveSeatWindowEndAt,
  resolveSeatWindowStartAt,
  resolveUsagePolicySnapshot,
  selectSeatSlotCandidate,
  usdToNanoUsd,
} from './shared'

function stubUsagePolicyEnv(): void {
  vi.stubEnv('WORKSPACE_USAGE_TARGET_MARGIN_PERCENT', '25')
  vi.stubEnv('WORKSPACE_USAGE_OVERAGE_PERCENT', '40')
  vi.stubEnv('WORKSPACE_USAGE_SESSIONS_PER_MONTH', '180')

  vi.stubEnv('WORKSPACE_USAGE_PRO_TARGET_MARGIN_PERCENT', '30')
  vi.stubEnv('WORKSPACE_USAGE_PRO_OVERAGE_PERCENT', '45')
  vi.stubEnv('WORKSPACE_USAGE_PRO_SESSIONS_PER_MONTH', '240')

  vi.stubEnv('WORKSPACE_USAGE_SCALE_TARGET_MARGIN_PERCENT', '32')
  vi.stubEnv('WORKSPACE_USAGE_SCALE_OVERAGE_PERCENT', '50')
  vi.stubEnv('WORKSPACE_USAGE_SCALE_SESSIONS_PER_MONTH', '300')

  vi.stubEnv('WORKSPACE_USAGE_ENTERPRISE_TARGET_MARGIN_PERCENT', '20')
  vi.stubEnv('WORKSPACE_USAGE_ENTERPRISE_OVERAGE_PERCENT', '50')
  vi.stubEnv('WORKSPACE_USAGE_ENTERPRISE_SESSIONS_PER_MONTH', '360')
}

beforeEach(() => {
  stubUsagePolicyEnv()
})

describe('resolveUsagePolicySnapshot', () => {
  it('computes per-plan budgets from the seeded plan defaults', () => {
    const snapshot = resolveUsagePolicySnapshot('plus', resolveDefaultUsagePolicyTemplate('plus'))

    expect(snapshot.planId).toBe('plus')
    expect(snapshot.enabled).toBe(true)
    expect(snapshot.seatMonthlyBudgetNanoUsd).toBe(usdToNanoUsd(6))
    expect(snapshot.seatOverageBudgetNanoUsd).toBe(usdToNanoUsd(2.4))
    expect(snapshot.seatWindowBudgetNanoUsd).toBe(20_000_000)
  })
})

describe('selectSeatSlotCandidate', () => {
  it('prefers a never-used empty seat before a used vacant seat', () => {
    const slot = selectSeatSlotCandidate({
      slots: [
        {
          id: 'seat-used-vacant',
          seatIndex: 2,
          currentAssigneeUserId: null,
          firstAssignedAt: 1,
        },
        {
          id: 'seat-never-used',
          seatIndex: 3,
          currentAssigneeUserId: null,
          firstAssignedAt: null,
        },
      ],
    })

    expect(slot?.id).toBe('seat-never-used')
  })

  it('keeps the member on the same seat when they already have an assignment', () => {
    const slot = selectSeatSlotCandidate({
      existingAssignment: {
        id: 'seat-existing',
        seatIndex: 4,
        currentAssigneeUserId: 'user-1',
        firstAssignedAt: 1,
      },
      slots: [],
    })

    expect(slot?.id).toBe('seat-existing')
  })
})

describe('seat window helpers', () => {
  it('uses deterministic UTC-aligned 4 hour windows', () => {
    const now = Date.UTC(2026, 2, 9, 10, 37, 0)
    expect(resolveSeatWindowStartAt(now, 4 * 60 * 60 * 1000)).toBe(
      Date.UTC(2026, 2, 9, 8, 0, 0),
    )
    expect(resolveSeatWindowEndAt(now, 4 * 60 * 60 * 1000)).toBe(
      Date.UTC(2026, 2, 9, 12, 0, 0),
    )
  })
})

describe('estimateReservedCostNanoUsd', () => {
  it('returns a non-zero reservation estimate from model pricing', () => {
    const messages: UIMessage<ChatMessageMetadata>[] = [
      {
        id: 'message-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Explain this code path in detail.' }],
      },
    ]

    const estimate = estimateReservedCostNanoUsd({
      modelId: 'openai/gpt-5-mini',
      messages,
      usagePolicy: resolveUsagePolicySnapshot(
        'pro',
        resolveDefaultUsagePolicyTemplate('pro'),
      ),
    })

    expect(estimate).toBeGreaterThan(0)
  })

  it('uses the minimum reserve floor when the estimated cost is tiny', () => {
    const estimate = estimateReservedCostNanoUsd({
      modelId: 'openai/gpt-5-mini',
      messages: [{ id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      usagePolicy: resolveUsagePolicySnapshot(
        'plus',
        resolveDefaultUsagePolicyTemplate('plus'),
      ),
    })

    expect(estimate).toBe(usdToNanoUsd(0.005))
  })

  it('ignores historical assistant totalTokens when estimating the next prompt', () => {
    const usagePolicy = resolveUsagePolicySnapshot(
      'pro',
      resolveDefaultUsagePolicyTemplate('pro'),
    )
    const baseMessages: UIMessage<ChatMessageMetadata>[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Explain what this means.' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'It means the request is valid.' }],
      },
    ]

    const inflatedMetadataMessages: UIMessage<ChatMessageMetadata>[] = [
      baseMessages[0]!,
      {
        ...baseMessages[1]!,
        metadata: { totalTokens: 48_000 },
      },
    ]

    expect(
      estimateReservedCostNanoUsd({
        modelId: 'openai/gpt-5-mini',
        messages: inflatedMetadataMessages,
        usagePolicy,
      }),
    ).toBe(
      estimateReservedCostNanoUsd({
        modelId: 'openai/gpt-5-mini',
        messages: baseMessages,
        usagePolicy,
      }),
    )
  })
})
