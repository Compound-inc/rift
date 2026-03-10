import type { ReactNode } from 'react'
import { cn } from '@rift/utils'
import { m } from '@/paraglide/messages.js'

export type AppRightSidebarProps = {
  isOpen: boolean
  children?: ReactNode
}

export function AppRightSidebar({ isOpen, children }: AppRightSidebarProps) {
  return (
    <aside
      className="flex h-full min-w-0 shrink-0 flex-col"
      style={{ width: 'var(--right-sidebar-width)' }}
      aria-label={m.layout_right_sidebar_aria_label()}
    >
      {/** Keep content mounted so exit motion can complete before it visually collapses. */}
      <div
        className={cn(
          'scrollbar-hide flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden rounded-t-xl border-x border-t border-border-light bg-surface-overlay transition-[opacity,transform] motion-reduce:transition-none',
          isOpen
            ? 'translate-x-0 opacity-100 duration-180 ease-out'
            : 'pointer-events-none translate-x-2 opacity-0 duration-140 ease-in',
        )}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-3 text-foreground-secondary">
          {children}
        </div>
      </div>
    </aside>
  )
}
