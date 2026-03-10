// Attachment previews displayed above the prompt input.
'use client'

import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import { AlertTriangle, FileText, Loader2, X } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import type { UploadedFile } from '@/lib/chat/upload'
import { m } from '@/paraglide/messages.js'

export type AttachedFile = {
  id: string
  name: string
  size?: number
  /** Object URL for image preview (call URL.revokeObjectURL when removing). */
  preview?: string
  /** Original File; optional so the slot can be used display-only. */
  file?: File
  /** True while the file is being uploaded to the server. */
  isUploading?: boolean
  /** Non-empty when upload failed. */
  uploadError?: string
  /** Filled after successful upload. */
  uploaded?: UploadedFile
}

export type PromptInputAttachmentsProps = HTMLAttributes<HTMLDivElement> & {
  files?: AttachedFile[]
  onRemove?: (id: string) => void
}

function isImageFile(file: AttachedFile): boolean {
  if (file.file?.type.startsWith('image/')) return true
  return !!file.preview
}

function isPdfFile(file: AttachedFile): boolean {
  return file.file?.type === 'application/pdf'
}

/** Square size for each attachment preview (matches next app’s w-16 h-16). */
const PREVIEW_SIZE_CLASS = 'size-16'

/**
 * Attachments preview slot. Renders above the input when files are attached.
 * Big square previews: image thumbnails, PDF badge, or file icon; remove via small top-right button on hover.
 */
export function PromptInputAttachments({
  className,
  files = [],
  onRemove,
  ...props
}: PromptInputAttachmentsProps) {
  if (files.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 px-2 pb-1.5',
        className
      )}
      {...props}
    >
      {files.map((file) => (
        <div
          key={file.id}
          className={cn(
            'relative group rounded-lg overflow-hidden border-2 border-border-light bg-surface-overlay',
            PREVIEW_SIZE_CLASS
          )}
        >
          {isImageFile(file) && file.preview ? (
            <img
              src={file.preview}
              alt=""
              className="size-full object-cover"
              aria-hidden
            />
          ) : isPdfFile(file) ? (
            <div
              className="size-full flex items-center justify-center bg-surface-error/15 text-foreground-error font-semibold text-lg"
              aria-hidden
            >
              PDF
            </div>
          ) : (
            <div
              className="size-full flex items-center justify-center bg-surface-raised text-foreground-secondary"
              aria-hidden
            >
              <FileText className="size-6" />
            </div>
          )}

          {onRemove && !file.uploadError && (
            <Button
              type="button"
              variant="default"
              size="iconSmall"
              className="absolute top-1 ltr:right-1 rtl:left-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              onClick={() => onRemove(file.id)}
              title={m.chat_prompt_attachment_remove_title({ fileName: file.name })}
              aria-label={m.chat_prompt_attachment_remove_aria_label({ fileName: file.name })}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          )}

          {file.isUploading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-strong/70 text-foreground-primary">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              <span className="sr-only">{m.chat_prompt_attachment_uploading_sr({ fileName: file.name })}</span>
            </div>
          )}

          {!file.isUploading && file.uploadError && (
            <button
              type="button"
              className="absolute inset-0 z-20 flex items-center justify-center bg-surface-error/95 text-foreground-primary"
              title={m.chat_prompt_attachment_upload_failed_title({ error: file.uploadError })}
              aria-label={m.chat_prompt_attachment_upload_failed_aria_label({ fileName: file.name })}
              onClick={() => onRemove?.(file.id)}
            >
              <AlertTriangle className="size-5 text-foreground-error" aria-hidden />
              <span className="sr-only">{m.chat_prompt_attachment_upload_failed_sr()}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
