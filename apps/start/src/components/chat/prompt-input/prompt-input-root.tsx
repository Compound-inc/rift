// Prompt input container with named slots for error/attachments/thinking UI.
'use client'

import { cn } from '@rift/utils'
import type { HTMLAttributes, ReactNode } from 'react'

export type PromptInputSlots = {
  /** Rendered in the outer illusion wrapper, above the input. Grows the frame when shown. */
  top?: ReactNode
  /** Reserved for future use (e.g. suggested replies below input). */
  bottom?: ReactNode
}

export type PromptInputRootProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  'children'
> & {
  /** Named slots for extensible content. Use slots.top for thinking, attachments, etc. */
  slots?: PromptInputSlots
  children: ReactNode
}

/**
 * Root form with layered illusion. Slots render in the outer wrapper so the
 * frame grows when slot content is shown.
 */
export function PromptInputRoot({
  className,
  slots,
  children,
  ...props
}: PromptInputRootProps) {
  return (
    <form className={cn('relative w-full', className)} {...props}>
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-[30px] border border-border-light dark:bg-surface-strong bg-[#E9E9E9] px-2 pt-2',
        )}
      >
        {slots?.top}
        <div
          className={cn(
            'flex min-h-[44px] shrink-0 flex-col rounded-[24px] bg-surface-base px-2.5 py-1.5',
          )}
        >
          {children}
        </div>
        {slots?.bottom}
      </div>
    </form>
  )
}
