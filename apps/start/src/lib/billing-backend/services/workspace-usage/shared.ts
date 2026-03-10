import type { UIMessage } from 'ai'
import { getCatalogModel } from '@/lib/ai-catalog'
import type { WorkspacePlanId } from '@/lib/billing/plan-catalog'
import { getWorkspacePlan } from '@/lib/billing/plan-catalog'
import { estimatePromptTokens } from '@/lib/chat-contracts'

export const CHAT_USAGE_FEATURE_KEY = 'chat_message' as const
export const SEAT_WINDOW_DURATION_MS = 4 * 60 * 60 * 1000
export const RESERVATION_TTL_MS = 15 * 60 * 1000
export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX_REQUESTS = 30
export const RESERVE_HEADROOM_RATIO_BPS = 1000
export const MIN_RESERVE_NANO_USD = 5_000_000

export type UsageBucketType = 'seat_window' | 'seat_overage'
export type UsageFeatureKey = typeof CHAT_USAGE_FEATURE_KEY

export type UsagePolicyTemplate = {
  readonly planId: Exclude<WorkspacePlanId, 'free'>
  readonly featureKey: UsageFeatureKey
  readonly seatWindowDurationMs: number
  readonly targetMarginRatioBps: number
  readonly monthlyOverageRatioBps: number
  readonly averageSessionsPerSeatPerMonth: number
  readonly reserveHeadroomRatioBps: number
  readonly minReserveNanoUsd: number
  readonly enabled: boolean
}

export type UsagePolicySnapshot = {
  readonly featureKey: UsageFeatureKey
  readonly enabled: boolean
  readonly planId: WorkspacePlanId
  readonly seatWindowDurationMs: number
  readonly targetMarginRatioBps: number
  readonly monthlyOverageRatioBps: number
  readonly averageSessionsPerSeatPerMonth: number
  readonly reserveHeadroomRatioBps: number
  readonly minReserveNanoUsd: number
  readonly seatPriceUsd: number
  readonly seatMonthlyBudgetNanoUsd: number
  readonly seatOverageBudgetNanoUsd: number
  readonly seatWindowBudgetNanoUsd: number
}

type PaidPlanId = Exclude<WorkspacePlanId, 'free'>

function readNumericEnv(name: string): number {
  const raw = process.env[name]?.trim()
  if (!raw) {
    throw new Error(`Missing ${name}`)
  }

  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric value for ${name}`)
  }

  return value
}

function readIntegerEnv(name: string): number {
  const value = readNumericEnv(name)
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer for ${name}`)
  }
  return value
}

function readPositiveIntegerEnv(name: string): number {
  const value = readIntegerEnv(name)
  if (value <= 0) {
    throw new Error(`Expected ${name} to be greater than zero`)
  }
  return value
}

function readPercentEnv(name: string): number {
  const value = readNumericEnv(name)
  if (value < 0 || value > 100) {
    throw new Error(`Expected ${name} to be between 0 and 100`)
  }
  return Math.round(value * 100)
}

function readPlanScopedPercentEnv(planId: PaidPlanId, suffix: string): number {
  const planScopedName = `WORKSPACE_USAGE_${planId.toUpperCase()}_${suffix}`
  const planScopedValue = process.env[planScopedName]?.trim()
  if (planScopedValue) {
    return readPercentEnv(planScopedName)
  }

  return readPercentEnv(`WORKSPACE_USAGE_${suffix}`)
}

function readPlanScopedPositiveIntegerEnv(planId: PaidPlanId, suffix: string): number {
  const planScopedName = `WORKSPACE_USAGE_${planId.toUpperCase()}_${suffix}`
  const planScopedValue = process.env[planScopedName]?.trim()
  if (planScopedValue) {
    return readPositiveIntegerEnv(planScopedName)
  }

  return readPositiveIntegerEnv(`WORKSPACE_USAGE_${suffix}`)
}

const BASE_USAGE_POLICY_TEMPLATES: Record<
  PaidPlanId,
  Omit<UsagePolicyTemplate, 'planId' | 'featureKey'>
> = {
  plus: {
    seatWindowDurationMs: SEAT_WINDOW_DURATION_MS,
    targetMarginRatioBps: 0,
    monthlyOverageRatioBps: 0,
    averageSessionsPerSeatPerMonth: 0,
    reserveHeadroomRatioBps: RESERVE_HEADROOM_RATIO_BPS,
    minReserveNanoUsd: MIN_RESERVE_NANO_USD,
    enabled: true,
  },
  pro: {
    seatWindowDurationMs: SEAT_WINDOW_DURATION_MS,
    targetMarginRatioBps: 0,
    monthlyOverageRatioBps: 0,
    averageSessionsPerSeatPerMonth: 0,
    reserveHeadroomRatioBps: RESERVE_HEADROOM_RATIO_BPS,
    minReserveNanoUsd: MIN_RESERVE_NANO_USD,
    enabled: true,
  },
  scale: {
    seatWindowDurationMs: SEAT_WINDOW_DURATION_MS,
    targetMarginRatioBps: 0,
    monthlyOverageRatioBps: 0,
    averageSessionsPerSeatPerMonth: 0,
    reserveHeadroomRatioBps: RESERVE_HEADROOM_RATIO_BPS,
    minReserveNanoUsd: MIN_RESERVE_NANO_USD,
    enabled: true,
  },
  enterprise: {
    seatWindowDurationMs: SEAT_WINDOW_DURATION_MS,
    targetMarginRatioBps: 0,
    monthlyOverageRatioBps: 0,
    averageSessionsPerSeatPerMonth: 0,
    reserveHeadroomRatioBps: RESERVE_HEADROOM_RATIO_BPS,
    minReserveNanoUsd: MIN_RESERVE_NANO_USD,
    enabled: true,
  },
}

export function resolveDefaultUsagePolicyTemplate(planId: PaidPlanId): UsagePolicyTemplate {
  const base = BASE_USAGE_POLICY_TEMPLATES[planId]

  return {
    ...base,
    targetMarginRatioBps: readPlanScopedPercentEnv(planId, 'TARGET_MARGIN_PERCENT'),
    monthlyOverageRatioBps: readPlanScopedPercentEnv(planId, 'OVERAGE_PERCENT'),
    averageSessionsPerSeatPerMonth: readPlanScopedPositiveIntegerEnv(
      planId,
      'SESSIONS_PER_MONTH',
    ),
    planId,
    featureKey: CHAT_USAGE_FEATURE_KEY,
  }
}

export type SeatSlotCandidate = {
  readonly id: string
  readonly seatIndex: number
  readonly currentAssigneeUserId?: string | null
  readonly firstAssignedAt?: number | null
}

export function usdToNanoUsd(usd: number): number {
  return Math.round(usd * 1_000_000_000)
}

export function nanoUsdToUsd(nanoUsd: number): number {
  return nanoUsd / 1_000_000_000
}

export function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor)
}

export function resolveSeatWindowStartAt(
  now: number,
  durationMs: number,
): number {
  return floorDiv(now, durationMs) * durationMs
}

export function resolveSeatWindowEndAt(
  now: number,
  durationMs: number,
): number {
  return resolveSeatWindowStartAt(now, durationMs) + durationMs
}

export function isUsagePlanEligible(planId: WorkspacePlanId): planId is Exclude<WorkspacePlanId, 'free'> {
  return planId !== 'free'
}

export function buildDisabledUsagePolicy(planId: WorkspacePlanId): UsagePolicySnapshot {
  return {
    featureKey: CHAT_USAGE_FEATURE_KEY,
    enabled: false,
    planId,
    seatWindowDurationMs: SEAT_WINDOW_DURATION_MS,
    targetMarginRatioBps: 0,
    monthlyOverageRatioBps: 0,
    averageSessionsPerSeatPerMonth: 0,
    reserveHeadroomRatioBps: 0,
    minReserveNanoUsd: 0,
    seatPriceUsd: getWorkspacePlan(planId).monthlyPriceUsd,
    seatMonthlyBudgetNanoUsd: 0,
    seatOverageBudgetNanoUsd: 0,
    seatWindowBudgetNanoUsd: 0,
  }
}

export function resolveUsagePolicySnapshot(
  planId: WorkspacePlanId,
  template: UsagePolicyTemplate,
): UsagePolicySnapshot {
  if (!template.enabled) {
    return buildDisabledUsagePolicy(planId)
  }

  const seatPriceUsd = getWorkspacePlan(planId).monthlyPriceUsd
  const seatMonthlyBudgetNanoUsd = Math.max(
    0,
    Math.round(
      usdToNanoUsd(seatPriceUsd) * (10_000 - template.targetMarginRatioBps) / 10_000,
    ),
  )
  const seatOverageBudgetNanoUsd = Math.max(
    0,
    Math.round(seatMonthlyBudgetNanoUsd * template.monthlyOverageRatioBps / 10_000),
  )
  const seatWindowBudgetNanoUsd = Math.max(
    0,
    Math.round(
      (seatMonthlyBudgetNanoUsd - seatOverageBudgetNanoUsd)
      / Math.max(1, template.averageSessionsPerSeatPerMonth),
    ),
  )

  return {
    featureKey: CHAT_USAGE_FEATURE_KEY,
    enabled: true,
    planId,
    seatWindowDurationMs: template.seatWindowDurationMs,
    targetMarginRatioBps: template.targetMarginRatioBps,
    monthlyOverageRatioBps: template.monthlyOverageRatioBps,
    averageSessionsPerSeatPerMonth: template.averageSessionsPerSeatPerMonth,
    reserveHeadroomRatioBps: template.reserveHeadroomRatioBps,
    minReserveNanoUsd: template.minReserveNanoUsd,
    seatPriceUsd,
    seatMonthlyBudgetNanoUsd,
    seatOverageBudgetNanoUsd,
    seatWindowBudgetNanoUsd,
  }
}

/**
 * Seat selection is cycle-local and prefers unused seats over churned seats so
 * orgs cannot turn member invites into extra budget while still using truly
 * empty purchased seats first.
 */
export function selectSeatSlotCandidate(input: {
  readonly existingAssignment?: SeatSlotCandidate | null
  readonly slots: readonly SeatSlotCandidate[]
}): SeatSlotCandidate | null {
  if (input.existingAssignment) {
    return input.existingAssignment
  }

  const neverUsedVacant = input.slots
    .filter((slot) => !slot.currentAssigneeUserId && !slot.firstAssignedAt)
    .sort((left, right) => left.seatIndex - right.seatIndex)

  if (neverUsedVacant[0]) {
    return neverUsedVacant[0]
  }

  const previouslyUsedVacant = input.slots
    .filter((slot) => !slot.currentAssigneeUserId && !!slot.firstAssignedAt)
    .sort((left, right) => left.seatIndex - right.seatIndex)

  return previouslyUsedVacant[0] ?? null
}

function applyTierCost(input: {
  readonly tokens: number
  readonly baseCost?: string
  readonly tiers?: readonly { cost: string; min: number; max?: number }[]
}): number {
  if (!input.tokens) return 0
  if (!input.tiers?.length) {
    return input.baseCost ? Number(input.baseCost) * input.tokens : 0
  }

  let remaining = input.tokens
  let total = 0

  for (const tier of input.tiers) {
    if (remaining <= 0) break
    const tierStart = tier.min
    const tierEnd = tier.max ?? Number.MAX_SAFE_INTEGER
    if (tierEnd <= tierStart) continue
    const tierWidth = tierEnd - tierStart
    const tierTokens = Math.min(remaining, tierWidth)
    total += Number(tier.cost) * tierTokens
    remaining -= tierTokens
  }

  return total
}

/**
 * Reservation math deliberately biases low enough to avoid false negatives for
 * users near their quota while still reserving the part we know before a model
 * starts: prompt-side spend and a small completion allowance. Any miss is
 * reconciled during settlement via capture or overage debt.
 */
export function estimateReservedCostNanoUsd(input: {
  readonly modelId: string
  readonly messages: readonly UIMessage[]
  readonly usagePolicy: UsagePolicySnapshot
}): number {
  const model = getCatalogModel(input.modelId)
  if (!model?.pricing) {
    return input.usagePolicy.minReserveNanoUsd
  }

  const inputTokens = estimatePromptTokens(input.messages)

  const estimatedOutputTokens = Math.max(
    96,
    Math.min(
      model.defaultMaxOutputTokens ?? 4096,
      Math.round(Math.max(96, inputTokens * 0.12)),
    ),
  )

  const estimatedUsd
    = applyTierCost({
      tokens: inputTokens,
      baseCost: model.pricing.inputPerToken,
      tiers: model.pricing.inputTiers,
    })
      + applyTierCost({
        tokens: estimatedOutputTokens,
        baseCost: model.pricing.outputPerToken,
        tiers: model.pricing.outputTiers,
      })

  const headedNanoUsd = Math.round(
    usdToNanoUsd(estimatedUsd)
    * (10_000 + input.usagePolicy.reserveHeadroomRatioBps)
    / 10_000,
  )

  return Math.max(
    input.usagePolicy.minReserveNanoUsd,
    headedNanoUsd,
  )
}
