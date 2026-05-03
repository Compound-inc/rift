import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import type { ChatMessageMetadata } from '@/lib/shared/chat-contracts/message-metadata'
import {
  estimateReservedCostNanoUsd,
  resolveDefaultUsagePolicyTemplate,
  resolveUsagePolicySnapshot,
  selectSeatSlotCandidate,
  usdToNanoUsd,
} from './shared'

function stubUsagePolicyEnv(): void {
  vi.stubEnv('WORKSPACE_USAGE_TARGET_MARGIN_PERCENT', '25')
  vi.stubEnv('WORKSPACE_USAGE_PRO_TARGET_MARGIN_PERCENT', '30')
  vi.stubEnv('WORKSPACE_USAGE_SCALE_TARGET_MARGIN_PERCENT', '32')
  vi.stubEnv('WORKSPACE_USAGE_ENTERPRISE_TARGET_MARGIN_PERCENT', '20')
}

beforeEach(() => {
  stubUsagePolicyEnv()
})

describe('resolveUsagePolicySnapshot', () => {
  it('computes per-plan budgets from the seeded plan defaults', () => {
    const snapshot = resolveUsagePolicySnapshot('plus', resolveDefaultUsagePolicyTemplate('plus'))
    const proSnapshot = resolveUsagePolicySnapshot('pro', resolveDefaultUsagePolicyTemplate('pro'))
    const scaleSnapshot = resolveUsagePolicySnapshot('scale', resolveDefaultUsagePolicyTemplate('scale'))

    expect(snapshot.planId).toBe('plus')
    expect(snapshot.enabled).toBe(true)
    expect(snapshot.organizationMonthlyBudgetNanoUsd).toBe(usdToNanoUsd(6))
    expect(snapshot.hasOrganizationMonthlyBudgetOverride).toBe(false)
    expect(snapshot.seatMonthlyBudgetNanoUsd).toBe(usdToNanoUsd(6))
    expect(snapshot.seatCycleBudgetNanoUsd).toBe(usdToNanoUsd(6))
    expect(proSnapshot.seatCycleBudgetNanoUsd).toBe(usdToNanoUsd(35))
    expect(scaleSnapshot.seatCycleBudgetNanoUsd).toBe(usdToNanoUsd(68))
  })

  it('supports an explicit organization monthly budget override', () => {
    const snapshot = resolveUsagePolicySnapshot(
      'enterprise',
      {
        ...resolveDefaultUsagePolicyTemplate('enterprise'),
        organizationMonthlyBudgetNanoUsd: usdToNanoUsd(1200),
      },
      { seatCount: 12 },
    )

    expect(snapshot.organizationMonthlyBudgetNanoUsd).toBe(usdToNanoUsd(1200))
    expect(snapshot.hasOrganizationMonthlyBudgetOverride).toBe(true)
    expect(snapshot.seatMonthlyBudgetNanoUsd).toBe(usdToNanoUsd(100))
    expect(snapshot.seatCycleBudgetNanoUsd).toBe(usdToNanoUsd(100))
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
      baseMessages[0],
      {
        ...baseMessages[1],
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
