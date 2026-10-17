/** UTC calendar months keep the server and every team member on one period. */
export function projectUsageMonth(now: number) {
  const date = new Date(now)
  return {
    startAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    endAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  }
}

export type ProjectUsageSummary = {
  readonly startAt: number
  readonly endAt: number
  readonly scope: 'own' | 'project'
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
  /** Public provider USD cost, absent when no generation reports a cost. */
  readonly publicCost: number | null
  readonly unpricedMessages: number
}
