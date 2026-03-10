'use client'

import type { ReactNode } from 'react'

import { cn } from '@rift/utils'

/**
 * Layout and padding for app content pages
 * (PageWidthWrapper + content area) so forms and content sit in the same place.
 *
 * - Optional title and description
 */
export function ContentPage({
  title,
  description,
  children,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-screen-xl px-3 pt-1 lg:px-6 lg:pt-14',
        className,
      )}
    >
      {(title != null || description != null) && (
        <div className="mb-6 space-y-1">
          {title != null && (
            <h1 className="text-2xl font-semibold leading-7 text-foreground-strong">
              {title}
            </h1>
          )}
          {description != null && (
            <p className="text-sm text-foreground-tertiary">{description}</p>
          )}
        </div>
      )}
      {children != null && <div className="mb-6 space-y-6">{children}</div>}
    </div>
  )
}
