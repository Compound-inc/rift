'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Link } from '@tanstack/react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@rift/ui/tooltip'
import { cn } from '@rift/utils'
import { m } from '@/paraglide/messages.js'
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
  valueLabel: string
  footerLabel: string
  footerValue: string
  percent: number
  fillClassName: string
  trackClassName: string
}

function UsageTooltipBar({
  label,
  valueLabel,
  footerLabel,
  footerValue,
  percent,
  fillClassName,
  trackClassName,
}: UsageTooltipBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-white">{label}</span>
        <span className="font-medium text-white">{valueLabel}</span>
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
        <span>{footerLabel}</span>
        <span>{footerValue}</span>
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
  const { summary, nowMs, loading, currentMemberAccess } = useOrgUsageSummary()
  const model = buildSidebarUsageMeterModel(summary, nowMs)
  const isOverSeatRestricted =
    currentMemberAccess?.status === 'restricted'
    && currentMemberAccess.reasonCode === 'seat_limit_downgrade'
  const hasUsageData = summary != null || isOverSeatRestricted
  const trackStroke = 'rgba(59, 130, 246, 0.18)'
  const fillStroke = isOverSeatRestricted
    ? '#ef4444'
    : hasUsageData
      ? '#3b82f6'
      : 'rgba(59, 130, 246, 0.42)'
  const usagePercent = isOverSeatRestricted ? 100 : model.remainingPercent
  const usageLabel = isOverSeatRestricted
    ? m.org_billing_sidebar_over_seat_label()
    : model.kind === 'free'
      ? m.org_billing_sidebar_free_allowance_label()
      : model.kind === 'paid'
        ? m.org_billing_sidebar_monthly_cycle_label()
        : m.org_billing_sidebar_generic_usage_label()
  const usageValueLabel = isOverSeatRestricted
    ? m.org_billing_sidebar_restricted_value()
    : m.org_billing_sidebar_remaining_value({ value: model.remainingLabel })
  const usageFooterLabel = isOverSeatRestricted
    ? m.org_billing_sidebar_status_label()
    : m.org_billing_sidebar_remaining_label()
  const usageFooterValue = isOverSeatRestricted
    ? m.org_billing_sidebar_over_seat_status()
    : model.resetLabel
      ? m.org_billing_sidebar_resets_value({ time: model.resetLabel })
      : m.org_billing_sidebar_reset_unavailable()
  const meter = (
    <Link
      to={BILLING_HREF}
      preload="intent"
      aria-label={m.org_billing_sidebar_open_usage_details_aria()}
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
              percent={loading ? 0 : usagePercent}
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
          <div className="font-medium text-sm text-white">{m.org_billing_sidebar_title()}</div>
          <div className="space-y-3 text-white/80">
            <UsageTooltipBar
              label={usageLabel}
              valueLabel={usageValueLabel}
              footerLabel={usageFooterLabel}
              footerValue={usageFooterValue}
              percent={usagePercent}
              fillClassName={isOverSeatRestricted ? 'bg-rose-500' : 'bg-[#3b82f6]'}
              trackClassName={isOverSeatRestricted ? 'bg-rose-500/20' : 'bg-[#3b82f6]/20'}
            />
            {isOverSeatRestricted ? (
              <p className="text-white/65">
                {m.org_billing_sidebar_over_seat_description()}
              </p>
            ) : null}
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
