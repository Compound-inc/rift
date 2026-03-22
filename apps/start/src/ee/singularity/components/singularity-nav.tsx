'use client'

import { Link, useLocation } from '@tanstack/react-router'
import { ContentPage } from '@/components/layout'
import { cn } from '@rift/utils'

const tabs = [
  {
    href: '/singularity',
    label: 'Organizations',
  },
] as const

/**
 * Singularity keeps its own nav chrome so the EE surface stays visually and
 * structurally separate from standard organization settings.
 */
export function SingularityNav() {
  const { pathname } = useLocation()

  return (
    <div className="sticky top-0 z-20 border-b border-border-light bg-surface-base/95 backdrop-blur">
      <ContentPage className="max-w-none px-3 py-0 lg:px-6 lg:pt-0">
        <div className="flex h-14 items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-md border border-border-base bg-surface-overlay px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-foreground-secondary">
              Singularity
            </div>
            <p className="hidden text-sm text-foreground-tertiary md:block">
              Enterprise admin workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tabs.map((tab) => {
              const isActive =
                pathname === tab.href || pathname.startsWith(`${tab.href}/`)

              return (
                <Link
                  key={tab.href}
                  to={tab.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-surface-overlay text-foreground-primary'
                      : 'text-foreground-tertiary hover:text-foreground-primary',
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </ContentPage>
    </div>
  )
}
