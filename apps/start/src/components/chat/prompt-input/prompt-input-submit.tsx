'use client'

import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import type { ChatStatus } from 'ai'
import { AlertTriangle, Loader2, Send, Square } from 'lucide-react'
import type { ComponentProps } from 'react'

type ButtonClickEvent = Parameters<
  NonNullable<ComponentProps<typeof Button>['onClick']>
>[0]

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  /** From useChat().status (ai.ChatStatus) */
  status?: ChatStatus
  onStop?: () => void
}

const statusConfig: Record<
  ChatStatus,
  { icon: typeof Send; label: string; isStreaming: boolean }
> = {
  ready: { icon: Send, label: 'Send message', isStreaming: false },
  submitted: { icon: Loader2, label: 'Sending...', isStreaming: false },
  streaming: { icon: Square, label: 'Stop', isStreaming: true },
  error: { icon: AlertTriangle, label: 'Error', isStreaming: false },
}

/**
 * Submit or stop button; status drives icon and label.
 * Presentational; onStop and type="submit" handled by parent.
 */
export function PromptInputSubmit({
  className,
  variant = 'default',
  size = 'icon',
  status = 'ready',
  children,
  onStop,
  onClick,
  ...props
}: PromptInputSubmitProps) {
  const { icon: Icon, label, isStreaming } = statusConfig[status]

  const handleClick = (e: ButtonClickEvent) => {
    if (isStreaming && onStop) {
      e.preventDefault()
      e.stopPropagation()
      onStop()
    } else {
      onClick?.(e)
    }
  }

  return (
    <Button
      className={cn(className, 'disabled:opacity-100 disabled:pointer-events-auto')}
      size={size}
      type={isStreaming ? 'button' : 'submit'}
      variant={variant}
      onClick={handleClick}
      title={label}
      {...props}
    >
      {children ?? (
        status === 'submitted' ? (
          <Icon className="size-5 animate-spin" aria-hidden />
        ) : (
          <Icon className="size-5" aria-hidden />
        )
      )}
    </Button>
  )
}
