'use client'

import type { ComponentType, SVGProps } from 'react'
import { cn } from '@rift/utils'

export function HrStatCard({
  label,
  value,
  suffix,
  icon: Icon,
  className,
}: {
  label: string
  value: string
  suffix: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-[7rem] flex-col justify-between rounded-xl border border-border-base bg-surface-overlay px-4 py-3.5',
        className,
      )}
    >
      <span className="text-sm font-medium text-foreground-tertiary">
        {label}
      </span>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[1.75rem] font-semibold leading-none tracking-tight text-foreground-strong">
            {value}
          </span>
          <span className="text-sm text-foreground-tertiary">{suffix}</span>
        </div>
        <Icon
          aria-hidden
          className="size-4 shrink-0 text-foreground-secondary"
        />
      </div>
    </div>
  )
}
