import type { OrgUsageSummary } from '@/lib/frontend/billing/org-usage-summary.server'

export type SidebarUsageMeterModel = {
  label: string
  usedPercent: number
  remainingPercent: number
  remainingLabel: string
  resetLabel: string | null
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function formatPercentLabel(value: number): string {
  return `${Math.round(clampPercent(value))}%`
}

function formatRelativeDuration(timestampMs: number | null | undefined, nowMs: number): string | null {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return null
  const remainingMs = Math.max(0, timestampMs - nowMs)
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (days > 0 && hours <= 0) return `${days}d`
  if (days > 0) return `${days}d ${hours}h`
  if (hours <= 0 && minutes <= 0) return 'under 1m'
  if (hours <= 0) return `${minutes}m`
  if (minutes <= 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function buildSidebarUsageMeterModel(
  summary: OrgUsageSummary | null,
  nowMs = Date.now(),
): SidebarUsageMeterModel {
  if (!summary) {
    return {
      label: 'Usage',
      usedPercent: 0,
      remainingPercent: 100,
      remainingLabel: '100%',
      resetLabel: null,
    }
  }

  return {
    label: summary.kind === 'free' ? 'Free allowance' : 'Monthly cycle',
    usedPercent: summary.monthlyUsedPercent,
    remainingPercent: summary.monthlyRemainingPercent,
    remainingLabel: formatPercentLabel(summary.monthlyRemainingPercent),
    resetLabel: formatRelativeDuration(summary.monthlyResetAt, nowMs),
  }
}
