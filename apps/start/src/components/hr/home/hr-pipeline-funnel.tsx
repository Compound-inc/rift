'use client'

import { useMemo } from 'react'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import { Link } from '@tanstack/react-router'
import { cn } from '@rift/utils'
import { m } from '@/paraglide/messages.js'
import type { HrPipelineInsight, HrPipelineStage } from './hr-home-page.logic'

export function HrPipelineFunnel({
  stages,
  insight,
  className,
}: {
  stages: readonly HrPipelineStage[]
  insight: HrPipelineInsight
  className?: string
}) {
  const geometry = useMemo(() => buildFunnelGeometry(stages), [stages])

  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border-base bg-surface-overlay',
        className,
      )}
      aria-label="Recruitment pipeline funnel"
    >
      <div
        className="grid gap-px border-b border-border-light"
        style={{
          gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
        }}
      >
        {stages.map((stage) => (
          <FunnelStageHeader
            key={stage.id}
            label={stage.label}
            count={stage.count}
          />
        ))}
      </div>

      <div className="relative h-44 w-full">
        <svg
          aria-hidden
          viewBox={`0 0 ${FUNNEL_VIEWBOX_WIDTH} ${FUNNEL_VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          {geometry.segments.map((segment) => (
            <path key={segment.id} d={segment.path} fill={segment.fill} />
          ))}
        </svg>

        {geometry.conversions.map((conversion) => (
          <div
            key={conversion.id}
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${conversion.leftPercent}%` }}
          >
            <FunnelConversionChip percent={conversion.percent} />
          </div>
        ))}
      </div>

      <FunnelInsightBar insight={insight} />
    </section>
  )
}

function FunnelStageHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
        {label}
      </span>
      <span className="text-xl font-semibold tracking-tight text-foreground-strong tabular-nums">
        {count.toLocaleString()}
      </span>
    </div>
  )
}

function FunnelConversionChip({ percent }: { percent: number }) {
  return (
    <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border-base bg-surface-base px-2.5 py-1.5 text-xs font-medium text-foreground-primary shadow-sm">
      <span className="tabular-nums">{percent.toFixed(1)}%</span>
      <ArrowRight aria-hidden className="size-3 text-foreground-tertiary" />
    </div>
  )
}

function FunnelInsightBar({ insight }: { insight: HrPipelineInsight }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-light px-4 py-3 text-sm">
      <Sparkles
        aria-hidden
        className="size-4 text-[color:var(--accent-primary)]"
      />
      <span className="text-foreground-primary">
        <span className="font-medium text-foreground-strong">{m.hr_pipeline_insight()}</span>{' '}
        {insight.message}
      </span>
      <span aria-hidden className="text-foreground-tertiary">
        •
      </span>
      <Link
        to={insight.href}
        className="font-medium text-[color:var(--accent-primary)] hover:underline"
      >
        {insight.cta}
      </Link>
    </div>
  )
}

const FUNNEL_VIEWBOX_WIDTH = 1000
const FUNNEL_VIEWBOX_HEIGHT = 220

const STAGE_FILL_OPACITIES = [0.12, 0.22, 0.34, 0.5, 0.72] as const
const STAGE_FILL_COLOR = 'rgb(54 115 252)'

type FunnelSegment = {
  readonly id: string
  readonly path: string
  readonly fill: string
}

type FunnelConversion = {
  readonly id: string
  readonly percent: number
  readonly leftPercent: number
}

function buildFunnelGeometry(stages: readonly HrPipelineStage[]) {
  if (stages.length === 0) {
    return {
      segments: [] as FunnelSegment[],
      conversions: [] as FunnelConversion[],
    }
  }

  const maxCount = stages.reduce(
    (peak, stage) => Math.max(peak, stage.count),
    0,
  )
  const centerY = FUNNEL_VIEWBOX_HEIGHT / 2
  const columnWidth = FUNNEL_VIEWBOX_WIDTH / stages.length
  const MIN_HALF_HEIGHT = 10
  const MAX_HALF_HEIGHT = FUNNEL_VIEWBOX_HEIGHT / 2 - 8

  const halfHeights = stages.map((stage) => {
    const ratio = maxCount === 0 ? 0 : stage.count / maxCount
    return Math.max(MIN_HALF_HEIGHT, ratio * MAX_HALF_HEIGHT)
  })

  const segments: FunnelSegment[] = stages.map((stage, index) => {
    const x0 = index * columnWidth
    const x1 = (index + 1) * columnWidth
    const halfStart = halfHeights[index] ?? MIN_HALF_HEIGHT
    const halfEnd =
      index === stages.length - 1
        ? Math.max(MIN_HALF_HEIGHT, halfStart * 0.45)
        : (halfHeights[index + 1] ?? halfStart)
    const handleOffset = columnWidth * 0.45

    const topStartY = centerY - halfStart
    const topEndY = centerY - halfEnd
    const bottomStartY = centerY + halfStart
    const bottomEndY = centerY + halfEnd

    const path = [
      `M ${x0} ${topStartY}`,
      `C ${x0 + handleOffset} ${topStartY}, ${x1 - handleOffset} ${topEndY}, ${x1} ${topEndY}`,
      `L ${x1} ${bottomEndY}`,
      `C ${x1 - handleOffset} ${bottomEndY}, ${x0 + handleOffset} ${bottomStartY}, ${x0} ${bottomStartY}`,
      'Z',
    ].join(' ')

    const opacity =
      STAGE_FILL_OPACITIES[Math.min(index, STAGE_FILL_OPACITIES.length - 1)] ??
      0.5

    return {
      id: stage.id,
      path,
      fill: `color-mix(in srgb, ${STAGE_FILL_COLOR} ${opacity * 100}%, transparent)`,
    }
  })

  const conversions: FunnelConversion[] = []
  for (let i = 0; i < stages.length - 1; i += 1) {
    const current = stages[i]
    const next = stages[i + 1]
    if (!current || !next) continue
    const percent = current.count === 0 ? 0 : (next.count / current.count) * 100
    const leftPercent = ((i + 1) / stages.length) * 100
    conversions.push({
      id: `${current.id}-to-${next.id}`,
      percent,
      leftPercent,
    })
  }

  return { segments, conversions }
}
