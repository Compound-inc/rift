'use client'

import { useMemo } from 'react'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Clock from 'lucide-react/dist/esm/icons/clock'
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import { cn } from '@rift/utils'
import type { ComponentType, SVGProps } from 'react'
import {
  useHrEvaluationDispatchesForApplication,
  useHrEvaluationResponsesForApplication,
} from '@/lib/frontend/hr/recruitment'
import type {
  HrEvaluationDispatchView,
  HrEvaluationResponseView,
} from '@/lib/frontend/hr/recruitment'
import { getEvaluationCatalogEntry } from '@/lib/shared/hr/recruitment'
import { HrEvaluationLink } from './hr-evaluation-link'

type EvaluationRow = {
  readonly id: string
  readonly title: string
  readonly subtitle: string
  readonly status: HrEvaluationDispatchView['status']
  readonly score: number | null
  readonly passed: boolean | null
  readonly dispatchedAt: number
  readonly completedAt: number | null
}

export function HrApplicationEvaluationsBlock({
  applicationId,
}: {
  readonly applicationId: string
}) {
  const { dispatches, loading: dispatchesLoading } =
    useHrEvaluationDispatchesForApplication({ applicationId })
  const { responses, loading: responsesLoading } =
    useHrEvaluationResponsesForApplication({ applicationId })

  const responsesByDispatchId = useMemo(() => {
    const map = new Map<string, HrEvaluationResponseView>()
    for (const response of responses) map.set(response.dispatchId, response)
    return map
  }, [responses])

  const rows = useMemo<readonly EvaluationRow[]>(
    () =>
      dispatches.map((dispatch) =>
        buildRow({
          dispatch,
          response: responsesByDispatchId.get(dispatch.id) ?? null,
        }),
      ),
    [dispatches, responsesByDispatchId],
  )

  const loading = dispatchesLoading || responsesLoading

  return (
    <section
      aria-label="Evaluations"
      className="flex flex-col overflow-hidden rounded-xl border border-border-base bg-surface-overlay"
    >
      <header className="flex items-center justify-between border-b border-border-light px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList
            aria-hidden
            className="size-4 text-foreground-secondary"
          />
          <h2 className="text-sm font-medium text-foreground-strong">
            Evaluations
          </h2>
          {!loading ? (
            <span className="text-xs text-foreground-tertiary">
              {rows.length}
            </span>
          ) : null}
        </div>
      </header>

      {loading && rows.length === 0 ? null : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground-strong">
            No evaluations dispatched.
          </p>
          <p className="text-xs text-foreground-tertiary">
            The pipeline workflow will dispatch evaluations once the candidate
            enters the testing stage.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-light">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-3 px-4 py-3">
              <EvaluationStatusIcon status={row.status} passed={row.passed} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground-strong">
                    {row.title}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      statusChipClassName(row.status),
                    )}
                  >
                    {statusLabel(row.status)}
                  </span>
                </div>
                <p className="text-xs text-foreground-tertiary">
                  {row.subtitle}
                </p>
                {row.status === 'sent' ? (
                  <HrEvaluationLink applicationId={applicationId} />
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end text-right">
                <span className="text-sm tabular-nums text-foreground-primary">
                  {row.score === null ? '—' : `${row.score}/100`}
                </span>
                <span className="text-[11px] text-foreground-tertiary">
                  {formatDate(row.completedAt ?? row.dispatchedAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function buildRow(input: {
  readonly dispatch: HrEvaluationDispatchView
  readonly response: HrEvaluationResponseView | null
}): EvaluationRow {
  const { dispatch, response } = input
  const catalog = getEvaluationCatalogEntry(dispatch.evaluationCatalogId)
  const title = catalog?.title ?? dispatch.evaluationCatalogId
  const subtitle = catalog
    ? `${humanizeKind(catalog.kind)} · ${catalog.passingScore}% to pass`
    : 'Custom evaluation'
  return {
    id: dispatch.id,
    title,
    subtitle,
    status: dispatch.status,
    score: response?.score ?? null,
    passed: response?.passed ?? null,
    dispatchedAt: dispatch.dispatchedAt,
    completedAt: dispatch.completedAt ?? response?.submittedAt ?? null,
  }
}

function EvaluationStatusIcon({
  status,
  passed,
}: {
  readonly status: HrEvaluationDispatchView['status']
  readonly passed: boolean | null
}) {
  const Icon: ComponentType<SVGProps<SVGSVGElement>> =
    status === 'completed' && passed === true
      ? CheckCircle2
      : status === 'completed' && passed === false
        ? XCircle
        : status === 'expired' || status === 'cancelled'
          ? XCircle
          : Clock
  return (
    <Icon
      aria-hidden
      className={cn(
        'mt-0.5 size-4 shrink-0',
        status === 'completed' && passed === true
          ? 'text-foreground-success'
          : status === 'completed' && passed === false
            ? 'text-foreground-error'
            : status === 'expired' || status === 'cancelled'
              ? 'text-foreground-tertiary'
              : 'text-foreground-info',
      )}
    />
  )
}

function statusLabel(status: HrEvaluationDispatchView['status']): string {
  switch (status) {
    case 'sent':
      return 'Sent'
    case 'completed':
      return 'Completed'
    case 'expired':
      return 'Expired'
    case 'cancelled':
      return 'Cancelled'
  }
}

function statusChipClassName(
  status: HrEvaluationDispatchView['status'],
): string {
  switch (status) {
    case 'sent':
      return 'border-border-light bg-surface-info/15 text-foreground-info'
    case 'completed':
      return 'border-border-light bg-surface-success/15 text-foreground-success'
    case 'expired':
      return 'border-border-light bg-surface-overlay text-foreground-tertiary'
    case 'cancelled':
      return 'border-border-light bg-surface-overlay text-foreground-tertiary'
  }
}

function humanizeKind(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
