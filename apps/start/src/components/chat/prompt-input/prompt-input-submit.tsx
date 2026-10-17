'use client'

import { Button } from '@rift/ui/button'
import { SentIcon, StopIcon } from '@rift/ui/icons/svg-icons'
import { cn } from '@rift/utils'
import type { ChatStatus } from 'ai'
import { AlertTriangle } from 'lucide-react'
import type { ComponentProps } from 'react'
import { m } from '@/paraglide/messages.js'

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  /** From useChat().status (ai.ChatStatus) */
  status?: ChatStatus
}

/** Icon and label per status. */
function getStatusConfig(): Record<
  ChatStatus,
  {
    icon: React.ComponentType<{ className?: string }>
    label: string
    shouldSpin: boolean
  }
> {
  return {
    ready: { icon: SentIcon, label: m.chat_prompt_submit_send_label(), shouldSpin: false },
    submitted: { icon: StopIcon, label: m.chat_prompt_submit_stop_label(), shouldSpin: false },
    streaming: { icon: StopIcon, label: m.chat_prompt_submit_stop_label(), shouldSpin: false },
    error: { icon: AlertTriangle, label: m.chat_prompt_submit_error_label(), shouldSpin: false },
  }
}

/**
 * Submit button with status-driven icon and label.
 */
export function PromptInputSubmit({
  className,
  variant = 'default',
  size = 'icon',
  status = 'ready',
  children,
  ...props
}: PromptInputSubmitProps) {
  const { icon: Icon, label, shouldSpin } = getStatusConfig()[status]

  return (
    <Button
      className={cn(
        className,
        'cursor-pointer disabled:opacity-100 disabled:pointer-events-auto',
      )}
      size={size}
      type="submit"
      variant={variant}
      title={label}
      aria-label={label}
      {...props}
    >
      {children ?? (
        shouldSpin ? (
          <Icon className="size-5 animate-spin" />
        ) : (
          <Icon className="size-5" />
        )
      )}
    </Button>
  )
}
