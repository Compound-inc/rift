'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { useServerFn } from '@tanstack/react-start'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { queries } from '@/integrations/zero'
import { getOrgUsageSummary } from './org-usage-summary.functions'
import type { OrgUsageSummary } from './org-usage-summary.server'

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function getErrorTag(error: unknown): string | null {
  if (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && typeof (error as { _tag: unknown })._tag === 'string'
  ) {
    return (error as { _tag: string })._tag
  }

  if (
    typeof error === 'object'
    && error !== null
    && 'name' in error
    && typeof (error as { name: unknown }).name === 'string'
  ) {
    return (error as { name: string }).name
  }

  return null
}

function isTerminalRefreshError(error: unknown): boolean {
  const tag = getErrorTag(error)

  return tag === 'WorkspaceBillingForbiddenError'
    || tag === 'WorkspaceBillingUnauthorizedError'
    || tag === 'WorkspaceBillingMissingOrgContextError'
}

const REFRESH_RETRY_DELAY_MS = 30_000

function getNextRefreshAt(summary: OrgUsageSummary): number {
  return summary.monthlyResetAt
}

/**
 * The sidebar reset label only changes when the remaining rounded-up minute
 * count crosses the next whole-minute boundary. Scheduling the next wake-up at
 * that exact point keeps the countdown accurate without a fixed polling loop.
 */
export function getNextUsageLabelTickAt(
  timestampMs: number | null | undefined,
  nowMs: number,
): number | null {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return null
  if (!Number.isFinite(nowMs)) return null

  const remainingMs = timestampMs - nowMs
  if (remainingMs <= 0) return null

  const totalMinutes = Math.ceil(remainingMs / 60_000)
  return totalMinutes <= 1
    ? timestampMs
    : timestampMs - ((totalMinutes - 1) * 60_000)
}

type UsageSummaryRow = {
  kind: 'free' | 'paid'
  monthlyUsedPercent: number
  monthlyRemainingPercent: number
  monthlyResetAt: number
  updatedAt: number
}

type EntitlementSnapshotRow = {
  computedAt: number
  activeMemberCount?: number
  seatCount?: number
  isOverSeatLimit?: boolean
}

type MemberAccessRow = {
  status?: string
  reasonCode?: string | null
}

type CurrentMemberRow = {
  access?: MemberAccessRow
}

type UsageSummaryContainerRow = {
  id?: string
  usageSummaries?: UsageSummaryRow[]
  entitlementSnapshots?: EntitlementSnapshotRow[]
  members?: CurrentMemberRow[]
}

function toSummary(row: UsageSummaryContainerRow | null | undefined): OrgUsageSummary | null {
  const summary = row?.usageSummaries?.[0]

  if (!summary) {
    return null
  }

  return {
    kind: summary.kind,
    monthlyUsedPercent: summary.monthlyUsedPercent,
    monthlyRemainingPercent: summary.monthlyRemainingPercent,
    monthlyResetAt: summary.monthlyResetAt,
    updatedAt: summary.updatedAt,
  }
}

function toEntitlementComputedAt(row: UsageSummaryContainerRow | null | undefined): number | null {
  const computedAt = row?.entitlementSnapshots?.[0]?.computedAt
  return typeof computedAt === 'number' ? computedAt : null
}

type EnsuredOrgUsageSummary = {
  organizationId: string
  summary: OrgUsageSummary
}

type ResolvedOrgUsageSummary = {
  summary: OrgUsageSummary | null
  summaryUpdatedAt: number | null
  entitlementComputedAt: number | null
  stale: boolean
}

/**
 * The provider can hold both a live Zero row and a just-refreshed fallback
 * value at the same time. Resolving them in one helper keeps org scoping and
 * staleness rules centralized so the render path cannot leak another org's
 * data during a workspace switch.
 */
export function resolveOrgUsageSummaryState(input: {
  activeOrganizationId: string | null
  liveSummaryRow: UsageSummaryContainerRow | null
  ensuredSummary: EnsuredOrgUsageSummary | null
}): ResolvedOrgUsageSummary {
  const liveSummary = input.liveSummaryRow?.id === input.activeOrganizationId
    ? toSummary(input.liveSummaryRow)
    : null
  const ensuredSummary = input.ensuredSummary?.organizationId === input.activeOrganizationId
    ? input.ensuredSummary.summary
    : null
  const summary = liveSummary == null
    ? ensuredSummary
    : ensuredSummary == null
      ? liveSummary
      : liveSummary.updatedAt >= ensuredSummary.updatedAt
        ? liveSummary
        : ensuredSummary
  const summaryUpdatedAt = summary?.updatedAt ?? null
  const entitlementComputedAt = input.liveSummaryRow?.id === input.activeOrganizationId
    ? toEntitlementComputedAt(input.liveSummaryRow)
    : null

  return {
    summary,
    summaryUpdatedAt,
    entitlementComputedAt,
    stale:
      summaryUpdatedAt != null
      && entitlementComputedAt != null
      && summaryUpdatedAt < entitlementComputedAt,
  }
}

type OrgUsageSummaryContextValue = {
  summary: OrgUsageSummary | null
  nowMs: number
  loading: boolean
  currentMemberAccess: MemberAccessRow | null
  entitlement: {
    activeMemberCount: number
    seatCount: number
    isOverSeatLimit: boolean
  } | null
}

const OrgUsageSummaryContext = createContext<OrgUsageSummaryContextValue | null>(null)

/**
 * Usage stays reactive through Zero while a server refresh fills gaps on org
 * switches and refreshes the per-user projection whenever reset boundaries or
 * entitlement snapshots move ahead of the latest visible summary.
 */
export function OrgUsageSummaryProvider({ children }: { children: ReactNode }) {
  const { activeOrganizationId } = useAppAuth()
  const getOrgUsageSummaryFn = useServerFn(getOrgUsageSummary)
  const [summaryRow, summaryResult] = useQuery(queries.orgBilling.currentUsageSummary())
  const activeOrganizationIdRef = useRef(activeOrganizationId)
  activeOrganizationIdRef.current = activeOrganizationId
  const missingLiveSummaryRefreshOrgIdRef = useRef<string | null>(null)
  const staleSummaryRefreshOrgIdRef = useRef<string | null>(null)
  /**
   * Auth failures are terminal for the currently selected org until the org
   * context changes.
   */
  const terminalRefreshOrgIdRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)
  const [ensuredSummary, setEnsuredSummary] = useState<EnsuredOrgUsageSummary | null>(null)
  const [ensuring, setEnsuring] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [retryAtMs, setRetryAtMs] = useState<number | null>(null)
  const [lastRefreshError, setLastRefreshError] = useState<Error | null>(null)
  const liveSummaryRow = (summaryRow as UsageSummaryContainerRow | null | undefined) ?? null
  const liveSummary = liveSummaryRow?.id === activeOrganizationId
    ? toSummary(liveSummaryRow)
    : null
  const resolvedSummary = resolveOrgUsageSummaryState({
    activeOrganizationId,
    liveSummaryRow,
    ensuredSummary,
  })
  const summary = resolvedSummary.summary
  const summaryRefreshAt = summary == null ? null : getNextRefreshAt(summary)
  const currentMemberAccess = liveSummaryRow?.id === activeOrganizationId
    ? liveSummaryRow?.members?.[0]?.access ?? null
    : null
  const entitlementRow = liveSummaryRow?.id === activeOrganizationId
    ? liveSummaryRow?.entitlementSnapshots?.[0]
    : undefined
  const entitlement = entitlementRow
    ? {
        activeMemberCount:
          typeof entitlementRow.activeMemberCount === 'number'
            ? entitlementRow.activeMemberCount
            : 0,
        seatCount:
          typeof entitlementRow.seatCount === 'number'
            ? entitlementRow.seatCount
            : 1,
        isOverSeatLimit: Boolean(entitlementRow.isOverSeatLimit),
      }
    : null

  /**
   * The latest request always wins. This keeps the shared summary pinned to the
   * active org even if an older request resolves later.
   */
  const refresh = useCallback(async () => {
    const organizationId = activeOrganizationIdRef.current
    if (!organizationId) return

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setEnsuring(true)

    try {
      const next = await getOrgUsageSummaryFn({ data: undefined })
      if (
        requestId !== requestIdRef.current
        || activeOrganizationIdRef.current !== organizationId
      ) {
        return
      }

      setEnsuredSummary({
        organizationId,
        summary: next,
      })
      setNowMs(Date.now())
      terminalRefreshOrgIdRef.current = null
      setRetryAtMs(null)
      setLastRefreshError(null)
    } catch (nextError) {
      if (
        requestId !== requestIdRef.current
        || activeOrganizationIdRef.current !== organizationId
      ) {
        return
      }

      const evaluatedAt = Date.now()
      setNowMs(evaluatedAt)
      if (isTerminalRefreshError(nextError)) {
        terminalRefreshOrgIdRef.current = organizationId
        setRetryAtMs(null)
      } else {
        setRetryAtMs(evaluatedAt + REFRESH_RETRY_DELAY_MS)
      }
      setLastRefreshError(asError(nextError))
    } finally {
      if (requestId === requestIdRef.current) {
        setEnsuring(false)
      }
    }
  }, [getOrgUsageSummaryFn])

  useEffect(() => {
    requestIdRef.current += 1
    missingLiveSummaryRefreshOrgIdRef.current = null
    staleSummaryRefreshOrgIdRef.current = null
    terminalRefreshOrgIdRef.current = null
    setNowMs(Date.now())
    setEnsuredSummary(null)
    setEnsuring(false)
    setRetryAtMs(null)
    setLastRefreshError(null)
  }, [activeOrganizationId])

  useEffect(() => {
    if (summary != null && !resolvedSummary.stale) {
      missingLiveSummaryRefreshOrgIdRef.current = null
      staleSummaryRefreshOrgIdRef.current = null
      terminalRefreshOrgIdRef.current = null
    }
  }, [resolvedSummary.stale, summary])

  useEffect(() => {
    const nextTickAt = getNextUsageLabelTickAt(summary?.monthlyResetAt, nowMs)
    if (nextTickAt == null) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now())
    }, Math.max(250, nextTickAt - Date.now() + 250))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [nowMs, summary?.monthlyResetAt])

  useEffect(() => {
    if (
      summaryRefreshAt == null
      || ensuring
      || summaryRefreshAt > Date.now()
      || terminalRefreshOrgIdRef.current === activeOrganizationIdRef.current
      || (retryAtMs != null && retryAtMs > Date.now())
    ) {
      return
    }

    void refresh()
  }, [ensuring, refresh, retryAtMs, summaryRefreshAt])

  useEffect(() => {
    if (
      summaryRefreshAt == null
      || terminalRefreshOrgIdRef.current === activeOrganizationIdRef.current
      || (retryAtMs != null && retryAtMs > Date.now())
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void refresh()
    }, Math.max(250, summaryRefreshAt - Date.now() + 250))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [refresh, retryAtMs, summaryRefreshAt])

  useEffect(() => {
    if (retryAtMs == null) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void refresh()
    }, Math.max(250, retryAtMs - Date.now()))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [refresh, retryAtMs])

  useEffect(() => {
    if (
      !activeOrganizationId
      || summaryResult.type !== 'complete'
      || liveSummary != null
      || ensuring
      || terminalRefreshOrgIdRef.current === activeOrganizationId
      || (retryAtMs != null && retryAtMs > Date.now())
      || missingLiveSummaryRefreshOrgIdRef.current === activeOrganizationId
    ) {
      return
    }

    missingLiveSummaryRefreshOrgIdRef.current = activeOrganizationId
    void refresh()
  }, [
    activeOrganizationId,
    ensuring,
    summary,
    refresh,
    retryAtMs,
    summaryResult.type,
  ])

  useEffect(() => {
    if (
      !activeOrganizationId
      || !resolvedSummary.stale
      || ensuring
      || terminalRefreshOrgIdRef.current === activeOrganizationId
      || (retryAtMs != null && retryAtMs > Date.now())
      || staleSummaryRefreshOrgIdRef.current === activeOrganizationId
    ) {
      return
    }

    staleSummaryRefreshOrgIdRef.current = activeOrganizationId
    void refresh()
  }, [activeOrganizationId, ensuring, refresh, resolvedSummary.stale, retryAtMs])

  useEffect(() => {
    if (!lastRefreshError) {
      return
    }

    console.error('Failed to refresh org usage summary', lastRefreshError)
  }, [lastRefreshError])

  return (
    <OrgUsageSummaryContext.Provider
      value={{
        summary,
        nowMs,
        loading:
          activeOrganizationId != null
          && summary == null
          && (ensuring || summaryResult.type !== 'complete'),
        currentMemberAccess,
        entitlement,
      }}
    >
      {children}
    </OrgUsageSummaryContext.Provider>
  )
}

export function useOrgUsageSummary() {
  const value = useContext(OrgUsageSummaryContext)

  if (!value) {
    throw new Error('useOrgUsageSummary must be used inside OrgUsageSummaryProvider')
  }

  return value
}
