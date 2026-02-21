'use client'

import { Mic, Plus } from 'lucide-react'
import type { ChatStatus } from 'ai'
import { cn } from '@rift/utils'
import type { HTMLAttributes } from 'react'
import { useRef } from 'react'
import { PromptInputSubmit } from './prompt-input-submit'
import { ACCEPTED_FILE_TYPES } from '../../../hooks/chat/upload'
import { Button } from '@rift/ui/button'

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement> & {
  canAddMore: boolean
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  status: ChatStatus
  onStop: () => void
  isEmpty: boolean
  isBusy: boolean
  /** When the user clicks empty space in the toolbar (not a button), focus the prompt input. */
  onFocusInput?: () => void
}

/**
 * Bottom toolbar row: file attach, spacer, voice, submit.
 */
export function PromptInputToolbar({
  className,
  canAddMore,
  onFileSelect,
  status,
  onStop,
  isEmpty,
  isBusy,
  onFocusInput,
  ...props
}: PromptInputToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleToolbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const isButton = target.closest('button')
    const isFileInput = target.closest('input[type="file"]')
    if (!isButton && !isFileInput) {
      onFocusInput?.()
    }
  }

  return (
    <div
      role="presentation"
      className={cn(
        'flex shrink-0 items-center justify-between gap-2 pt-1',
        'pb-[max(env(safe-area-inset-bottom),0.25rem)]',
        onFocusInput && 'cursor-text',
        className
      )}
      onClick={onFocusInput ? handleToolbarClick : undefined}
      {...props}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        multiple
        className="sr-only"
        aria-hidden
        onChange={onFileSelect}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={canAddMore ? 'Upload files' : 'Attach file (max reached)'}
        disabled={!canAddMore}
        onClick={() => fileInputRef.current?.click()}
      >
        <Plus aria-hidden />
      </Button>
      <div className="flex-1" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Voice input"
      >
        <Mic aria-hidden />
      </Button>
      <PromptInputSubmit
        status={status}
        onStop={onStop}
        disabled={isEmpty || isBusy}
      />
    </div>
  )
}
