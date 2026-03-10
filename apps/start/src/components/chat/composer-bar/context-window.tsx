'use client'

import type { LanguageModelUsage } from 'ai'
import type { ComponentProps } from 'react'

import { m } from '@/paraglide/messages.js'
import { Button } from '@rift/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@rift/ui/hover-card'
import { Progress } from '@rift/ui/progress'
import { cn } from '@rift/utils'
import { createContext, isValidElement, useContext, useMemo } from 'react'

const PERCENT_MAX = 100
const ICON_RADIUS = 10
const ICON_VIEWBOX = 24
const ICON_CENTER = 12
const ICON_STROKE_WIDTH = 2

type ModelId = string

interface ContextSchema {
  usedTokens: number
  maxTokens: number
  usage?: LanguageModelUsage
  modelId?: ModelId
  totalCost?: number
  showCost: boolean
}

const ContextContext = createContext<ContextSchema | null>(null)

const useContextValue = () => {
  const context = useContext(ContextContext)

  if (!context) {
    throw new Error('Context components must be used within Context')
  }

  return context
}

export type ContextProps = ComponentProps<typeof HoverCard> & ContextSchema

export const Context = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  totalCost,
  showCost,
  ...props
}: ContextProps) => {
  const contextValue = useMemo(
    () => ({ maxTokens, modelId, totalCost, showCost, usage, usedTokens }),
    [maxTokens, modelId, totalCost, showCost, usage, usedTokens],
  )

  return (
    <ContextContext.Provider value={contextValue}>
      <HoverCard {...props} />
    </ContextContext.Provider>
  )
}

const ContextIcon = () => {
  const { usedTokens, maxTokens } = useContextValue()
  const circumference = 2 * Math.PI * ICON_RADIUS
  const usedPercent = usedTokens / maxTokens
  const dashOffset = circumference * (1 - usedPercent)

  return (
    <svg
      aria-label="Model context usage"
      height="20"
      role="img"
      style={{ color: 'currentcolor' }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="20"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
      />
    </svg>
  )
}

export type ContextTriggerProps = ComponentProps<typeof Button>

export const ContextTrigger = ({ children, ...props }: ContextTriggerProps) => {
  const { usedTokens, maxTokens } = useContextValue()
  const usedPercent = usedTokens / maxTokens
  const renderedPercent = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    style: 'percent',
  }).format(usedPercent)

  const triggerElement = isValidElement(children) ? (
    children
  ) : (
    <Button type="button" variant="ghost" {...props}>
      <span className="inline-flex items-center gap-2 text-start">
        <span className="font-medium text-foreground-secondary">{renderedPercent}</span>
        <ContextIcon />
      </span>
    </Button>
  )

  return (
    <HoverCardTrigger closeDelay={0} delay={0} render={triggerElement} />
  )
}

export type ContextContentProps = ComponentProps<typeof HoverCardContent>

export const ContextContent = ({
  className,
  ...props
}: ContextContentProps) => (
  <HoverCardContent
    className={cn(
      'min-w-60 divide-y divide-border-base overflow-hidden p-0 text-start',
      className,
    )}
    {...props}
  />
)

export type ContextContentHeaderProps = ComponentProps<'div'>

export const ContextContentHeader = ({
  children,
  className,
  ...props
}: ContextContentHeaderProps) => {
  const { usedTokens, maxTokens } = useContextValue()
  const usedPercent = usedTokens / maxTokens
  const displayPct = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    style: 'percent',
  }).format(usedPercent)
  const used = new Intl.NumberFormat('en-US', {
    notation: 'compact',
  }).format(usedTokens)
  const total = new Intl.NumberFormat('en-US', {
    notation: 'compact',
  }).format(maxTokens)

  return (
    <div
      className={cn('w-full space-y-2 ps-4 pe-4 py-3 text-start', className)}
      {...props}
    >
      {children ?? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="text-foreground-strong">{displayPct}</p>
            <p className="font-mono text-foreground-secondary">
              {used} / {total}
            </p>
          </div>
          <div className="space-y-2">
            <Progress value={usedPercent * PERCENT_MAX} />
          </div>
        </>
      )}
    </div>
  )
}

export type ContextContentBodyProps = ComponentProps<'div'>

export const ContextContentBody = ({
  children,
  className,
  ...props
}: ContextContentBodyProps) => (
  <div className={cn('w-full ps-4 pe-4 py-3 text-start', className)} {...props}>
    {children}
  </div>
)

export type ContextContentFooterProps = ComponentProps<'div'>

export const ContextContentFooter = ({
  children,
  className,
  ...props
}: ContextContentFooterProps) => {
  const { showCost, totalCost } = useContextValue()
  if (!children && (!showCost || totalCost == null)) {
    return null
  }

  const formattedTotalCost = formatUsdCost(totalCost ?? 0)

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-3 border-t border-border-faint bg-surface-strong/50 ps-4 pe-4 py-3 text-xs text-start',
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="text-foreground-secondary">{m.chat_context_total_cost()}</span>
          <span className="text-foreground-strong">{formattedTotalCost}</span>
        </>
      )}
    </div>
  )
}

export type ContextInputUsageProps = ComponentProps<'div'>

export const ContextInputUsage = ({
  className,
  children,
  ...props
}: ContextInputUsageProps) => {
  const { usage } = useContextValue()
  const inputTokens = usage?.inputTokens ?? 0

  if (children) {
    return children
  }

  if (!inputTokens) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 text-xs text-start',
        className,
      )}
      {...props}
    >
      <span className="text-foreground-secondary">{m.chat_context_input()}</span>
      <TokensWithCost tokens={inputTokens} />
    </div>
  )
}

export type ContextOutputUsageProps = ComponentProps<'div'>

export const ContextOutputUsage = ({
  className,
  children,
  ...props
}: ContextOutputUsageProps) => {
  const { usage } = useContextValue()
  const outputTokens = usage?.outputTokens ?? 0

  if (children) {
    return children
  }

  if (!outputTokens) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 text-xs text-start',
        className,
      )}
      {...props}
    >
      <span className="text-foreground-secondary">{m.chat_context_output()}</span>
      <TokensWithCost tokens={outputTokens} />
    </div>
  )
}

export type ContextReasoningUsageProps = ComponentProps<'div'>

export const ContextReasoningUsage = ({
  className,
  children,
  ...props
}: ContextReasoningUsageProps) => {
  const { usage } = useContextValue()
  const reasoningTokens = usage?.outputTokenDetails.reasoningTokens ?? 0

  if (children) {
    return children
  }

  if (!reasoningTokens) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 text-xs text-start',
        className,
      )}
      {...props}
    >
      <span className="text-foreground-secondary">{m.chat_context_reasoning()}</span>
      <TokensWithCost tokens={reasoningTokens} />
    </div>
  )
}

export type ContextCacheUsageProps = ComponentProps<'div'>

export const ContextCacheUsage = ({
  className,
  children,
  ...props
}: ContextCacheUsageProps) => {
  const { usage } = useContextValue()
  const cacheReadTokens = usage?.inputTokenDetails.cacheReadTokens ?? 0
  const cacheWriteTokens = usage?.inputTokenDetails.cacheWriteTokens ?? 0

  if (children) {
    return children
  }

  if (!cacheReadTokens && !cacheWriteTokens) {
    return null
  }

  return (
    <div className={cn('space-y-2 text-start', className)} {...props}>
      {cacheReadTokens > 0 ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-foreground-secondary">{m.chat_context_cache_read()}</span>
          <TokensWithCost tokens={cacheReadTokens} />
        </div>
      ) : null}
      {cacheWriteTokens > 0 ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-foreground-secondary">{m.chat_context_cache_write()}</span>
          <TokensWithCost tokens={cacheWriteTokens} />
        </div>
      ) : null}
    </div>
  )
}

const TokensWithCost = ({ tokens }: { tokens?: number }) => (
  <span className="text-foreground-strong">
    {tokens === undefined
      ? '—'
      : new Intl.NumberFormat('en-US', {
          notation: 'compact',
        }).format(tokens)}
  </span>
)

/**
 * Costs below one cent are common in chat, so the formatter keeps four
 * decimals in that range.
 */
function formatUsdCost(value: number): string {
  const absoluteValue = Math.abs(value)
  const minimumFractionDigits = absoluteValue > 0 && absoluteValue < 0.01 ? 4 : 2

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits: 4,
  }).format(value)
}
