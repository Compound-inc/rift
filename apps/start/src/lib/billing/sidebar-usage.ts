export type UsageBucketSnapshot = {
  totalNanoUsd?: number | null
  remainingNanoUsd?: number | null
  currentWindowEndsAt?: number | null
}

export type UsageCycleSnapshot = {
  cycleEndAt?: number | null
}

export type SidebarUsageBarModel = {
  usedPercent: number
  remainingPercent: number
  remainingLabel: string
  resetLabel: string | null
}

export type SidebarUsageMeterModel = {
  monthly: SidebarUsageBarModel
  window: SidebarUsageBarModel
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function formatPercentLabel(value: number): string {
  return `${Math.round(clampPercent(value))}%`
}

function formatResetDate(
  timestampMs: number | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string | null {
  if (!timestampMs) return null
  return new Intl.DateTimeFormat('en-US', options).format(new Date(timestampMs))
}

function formatRelativeDuration(timestampMs: number | null | undefined, nowMs: number): string | null {
  if (!timestampMs) return null
  const remainingMs = Math.max(0, timestampMs - nowMs)
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0 && minutes <= 0) return 'under 1m'
  if (hours <= 0) return `${minutes}m`
  if (minutes <= 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/**
 * Sidebar usage bars render "usage" rather than "remaining". This helper keeps
 * the inversion in one place so future meter variants do not duplicate it and
 * drift when the quota model changes.
 */
function toBarModel(
  bucket: UsageBucketSnapshot | null | undefined,
  resetLabel: string | null,
): SidebarUsageBarModel {
  const total = bucket?.totalNanoUsd ?? 0
  const remaining = bucket?.remainingNanoUsd ?? 0
  const consumed = Math.max(0, total - remaining)
  const usedPercent = total > 0 ? clampPercent((consumed / total) * 100) : 0
  const remainingPercent = clampPercent(100 - usedPercent)

  return {
    usedPercent,
    remainingPercent,
    remainingLabel: formatPercentLabel(remainingPercent),
    resetLabel,
  }
}

/**
 * Converts the billing summary payload into a compact view model tailored for
 * the sidebar. The returned data is intentionally presentation-ready so the
 * sidebar component stays thin and easy to restyle later.
 */
export function buildSidebarUsageMeterModel(input: {
  seatWindowBucket?: UsageBucketSnapshot | null
  seatOverageBucket?: UsageBucketSnapshot | null
  currentSeatSlot?: UsageCycleSnapshot | null
  nowMs?: number
}): SidebarUsageMeterModel {
  const nowMs = input.nowMs ?? Date.now()

  return {
    monthly: toBarModel(
      input.seatOverageBucket,
      formatResetDate(input.currentSeatSlot?.cycleEndAt, {
        month: 'short',
        day: 'numeric',
      }),
    ),
    window: toBarModel(
      input.seatWindowBucket,
      formatRelativeDuration(input.seatWindowBucket?.currentWindowEndsAt, nowMs),
    ),
  }
}
