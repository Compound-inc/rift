'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Link } from '@tanstack/react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@rift/ui/tooltip'
import { cn } from '@rift/utils'
import {
  OrgUsageSummaryProvider,
  useOrgUsageSummary,
} from '@/lib/frontend/billing/use-org-usage'
import { buildSidebarUsageMeterModel } from './sidebar-usage-meter.model'
import { ORG_SETTINGS_HREF } from '@/routes/(app)/_layout/organization/settings/-organization-settings-nav'

const BILLING_HREF = `${ORG_SETTINGS_HREF}/billing`

type UsageBarProps = {
  percent: number
  reducedMotion: boolean
  radius: number
  strokeWidth: number
  trackStroke: string
  fillStroke: string
  minVisiblePercent?: number
}

function UsageRing({
  percent,
  reducedMotion,
  radius,
  strokeWidth,
  trackStroke,
  fillStroke,
  minVisiblePercent = 0,
}: UsageBarProps) {
  const normalizedPercent = percent > 0
    ? Math.max(percent, minVisiblePercent)
    : 0
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - normalizedPercent / 100)

  return (
    <>
      <circle
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        stroke={trackStroke}
      />
      <motion.circle
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        stroke={fillStroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={reducedMotion ? false : { strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: dashOffset }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
      />
    </>
  )
}

type UsageTooltipBarProps = {
  label: string
  remainingLabel: string
  resetLabel: string | null
  resetPrefix: string
  percent: number
  fillClassName: string
  trackClassName: string
}

function UsageTooltipBar({
  label,
  remainingLabel,
  resetLabel,
  resetPrefix,
  percent,
  fillClassName,
  trackClassName,
}: UsageTooltipBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-white">{label}</span>
        <span className="font-medium text-white">{remainingLabel} left</span>
      </div>
      <div className={cn('h-1.5 overflow-hidden rounded-sm', trackClassName)}>
        <motion.div
          className={cn('h-full rounded-sm', fillClassName)}
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between gap-3 text-white/65">
        <span>Remaining</span>
        <span>{resetLabel ? `${resetPrefix} ${resetLabel}` : 'Reset unavailable'}</span>
      </div>
    </div>
  )
}

/**
 * Compact usage meter for the icon rail. In the current single-bucket quota
 * mode, the ring represents monthly remaining budget only.
 */
function SidebarUsageMeterContent() {
  const reducedMotion = useReducedMotion()
  const { summary, nowMs, loading } = useOrgUsageSummary()
  const model = buildSidebarUsageMeterModel(summary, nowMs)
  const hasUsageData = summary != null
  const trackStroke = 'rgba(59, 130, 246, 0.18)'
  const fillStroke = hasUsageData ? '#3b82f6' : 'rgba(59, 130, 246, 0.42)'
  const meter = (
    <Link
      to={BILLING_HREF}
      preload="intent"
      aria-label="Open billing usage details"
      className={cn(
        'block outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-foreground-secondary/40',
        loading ? 'cursor-default' : '',
      )}
    >
      <div className="flex size-11 items-center justify-center">
        <div className="relative flex size-11 items-center justify-center">
          <svg
            viewBox="0 0 56 56"
            className="-rotate-90 overflow-visible"
            aria-hidden="true"
          >
            <UsageRing
              radius={20}
              strokeWidth={4.5}
              trackStroke={trackStroke}
              fillStroke={fillStroke}
              percent={loading ? 0 : model.remainingPercent}
              reducedMotion={Boolean(reducedMotion)}
              minVisiblePercent={10}
            />
          </svg>
        </div>
      </div>
    </Link>
  )

  return (
    <Tooltip>
      <TooltipTrigger
        render={meter}
        tabIndex={0}
      />
      <TooltipContent
        side="inline-end"
        sideOffset={8}
        className="min-w-56 rounded-lg px-3 py-3 text-xs"
      >
        <div className="space-y-3">
          <div className="font-medium text-sm text-white">Usage</div>
          <div className="space-y-3 text-white/80">
            <UsageTooltipBar
              label={model.label}
              remainingLabel={model.remainingLabel}
              resetLabel={model.resetLabel}
              resetPrefix="Resets"
              percent={model.remainingPercent}
              fillClassName="bg-[#3b82f6]"
              trackClassName="bg-[#3b82f6]/20"
            />
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function SidebarUsageMeter() {
  return (
    <OrgUsageSummaryProvider>
      <SidebarUsageMeterContent />
    </OrgUsageSummaryProvider>
  )
}
