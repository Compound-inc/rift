'use client'

import { ChevronDown } from 'lucide-react'
// Toolbar controls: file picker, voice placeholder, and submit state.
import type { ChatStatus } from 'ai'
import { cn } from '@rift/utils'
import type { HTMLAttributes } from 'react'
import { useRef } from 'react'
import { CHAT_ATTACHMENT_UPLOAD_POLICY } from '@/lib/shared/upload/upload-validation'
import { PromptInputSubmit } from './prompt-input-submit'
import { PromptInputActionsMenu } from './prompt-input-actions-menu'
import type { ChatVisibleTool } from '../chat-context'

/** Styling shared with toolbar ghost buttons for visual consistency. */
const TOOLBAR_SELECT_CLASS =
  'h-10 rounded-lg border border-transparent bg-transparent px-3 ltr:pr-8 rtl:pl-8 text-sm font-medium text-foreground-primary appearance-none outline-none transition-colors hover:bg-surface-inverse/5 active:bg-surface-inverse/10 focus-visible:border-border-strong focus-visible:ring-[3px] focus-visible:ring-border-strong/50 disabled:pointer-events-none disabled:opacity-50'

export type ToolbarSelectOption = {
  value: string
  label: string
}

export type ToolbarSelectProps = {
  value: string
  onChange: (value: string) => void
  options: readonly ToolbarSelectOption[]
  'aria-label': string
  disabled?: boolean
  className?: string
}

/**
 * Native select styled to match the toolbar ghost buttons (attachment, mic).
 */
export function ToolbarSelect({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  disabled = false,
  className,
}: ToolbarSelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        className={TOOLBAR_SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute ltr:right-2 rtl:left-2 top-1/2 size-4 -translate-y-1/2 text-foreground-secondary"
        aria-hidden
      />
    </div>
  )
}

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement> & {
  canAddMore: boolean
  canUploadFiles: boolean
  uploadUpgradeCallout?: string
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  status: ChatStatus
  isEmpty: boolean
  isBusy: boolean
  isStudyModeEnabled: boolean
  isModeEnforced: boolean
  onToggleStudyMode: () => void
  visibleTools: readonly ChatVisibleTool[]
  disabledToolKeys: readonly string[]
  onToolDisabledKeysChange: (disabledToolKeys: readonly string[]) => void
  contextWindowSupportsMaxMode: boolean
  isMaxContextEnabled: boolean
  onMaxContextChange: (enabled: boolean) => void
  middle?: React.ReactNode
  /** Content rendered immediately after the attachment button (e.g. model selector). */
  afterAttach?: React.ReactNode
}

/**
 * Bottom toolbar row: file attach, spacer, voice, submit.
 */
export function PromptInputToolbar({
  className,
  canAddMore,
  canUploadFiles,
  uploadUpgradeCallout,
  onFileSelect,
  status,
  isEmpty,
  isBusy,
  isStudyModeEnabled,
  isModeEnforced,
  onToggleStudyMode,
  visibleTools,
  disabledToolKeys,
  onToolDisabledKeysChange,
  contextWindowSupportsMaxMode,
  isMaxContextEnabled,
  onMaxContextChange,
  middle,
  afterAttach,
  ...props
}: PromptInputToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const submitDisabled = isEmpty || isBusy

  const handleOpenFilePicker = () => {
    if (!fileInputRef.current) return
    // Ensure selecting the same file again still fires onChange.
    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  return (
    <div
      role="presentation"
      className={cn(
        'flex shrink-0 items-center gap-2',
        'pb-[max(env(safe-area-inset-bottom),0.125rem)]',
        className
      )}
      {...props}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={CHAT_ATTACHMENT_UPLOAD_POLICY.acceptedFileTypes}
        multiple
        className="sr-only"
        aria-hidden
        onChange={onFileSelect}
      />
        <PromptInputActionsMenu
          canAddMore={canAddMore}
          canUploadFiles={canUploadFiles}
          uploadUpgradeCallout={uploadUpgradeCallout}
          onOpenFilePicker={handleOpenFilePicker}
        isStudyModeEnabled={isStudyModeEnabled}
        isModeEnforced={isModeEnforced}
        onToggleStudyMode={onToggleStudyMode}
        visibleTools={visibleTools}
        disabledToolKeys={disabledToolKeys}
        onToolDisabledKeysChange={onToolDisabledKeysChange}
        contextWindowSupportsMaxMode={contextWindowSupportsMaxMode}
        isMaxContextEnabled={isMaxContextEnabled}
        onMaxContextChange={onMaxContextChange}
      />

      <div className="min-w-0 flex-1">
        {middle}
      </div>

      <div className="ltr:ml-auto rtl:mr-auto flex items-center self-end gap-1.5">
        {afterAttach}
        <PromptInputSubmit
          status={status}
          disabled={submitDisabled}
          data-active={!submitDisabled}
          variant="ghost"
          className={cn(
            'size-8 rounded-full border border-transparent p-0 transition-[background-color,color,font-weight] duration-0 active:duration-75',
            submitDisabled
              ? 'bg-transparent text-foreground-secondary hover:bg-transparent active:bg-transparent'
              : 'bg-surface-info/25 text-foreground-info hover:bg-surface-info/45 active:bg-surface-info/75'
          )}
        />
      </div>
    </div>
  )
}
