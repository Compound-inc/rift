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
      <div className="flex flex-col overflow-hidden rounded-2xl bg-bg-emphasis/75 p-1.5">
        {slots?.top}
        <div className="flex min-h-[72px] shrink-0 flex-col gap-1.5 rounded-xl bg-bg-emphasis p-3">
          {children}
        </div>
        {slots?.bottom}
      </div>
    </form>
  )
}
