// Single chat message renderer (user/assistant).
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import { useDirection } from '@rift/ui/direction'
import type { ChatMessageMetadata } from '@/lib/chat-contracts/message-metadata'
import type { ChatAttachment } from '@/lib/chat-contracts/attachments'
import {
  AssistantMessageParts,
  AssistantMessageActions,
  UserMessageActions,
} from './message-parts'

function getRawMessageText(message: UIMessage): string {
  if (message.parts.length === 0) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n')
    .trim()
}

function getFileTypeIndicator(fileName: string): string {
  const normalized = fileName.trim().toLowerCase()
  const dotIndex = normalized.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === normalized.length - 1) return 'FILE'
  return normalized.slice(dotIndex + 1).toUpperCase()
}

function getEditMirrorText(text: string): string {
  if (text.length === 0) return '\u00a0'
  // Trailing newline does not contribute visible height in plain text nodes.
  // Add a non-breaking space so the first Enter expands the mirror box immediately.
  if (text.endsWith('\n')) return `${text}\u00a0`
  return text
}

type ChatMessageProps = {
  message: UIMessage
  isAnimating?: boolean
  canRegenerate: boolean
  canEdit: boolean
  onRegenerate: (messageId: string) => void
  onEdit: (input: { messageId: string; editedText: string }) => Promise<void>
  branchSelector?: {
    parentMessageId: string
    optionMessageIds: readonly string[]
    selectedMessageId: string
    disabled?: boolean
    onSelectMessageId: (messageId: string) => void
  }
}

const AssistantMessageContent = memo(function AssistantMessageContent({
  parts,
  isAnimating,
}: {
  parts: UIMessage['parts']
  isAnimating: boolean
}) {
  return (
    <div className="space-y-4 size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <AssistantMessageParts parts={parts} isMessageStreaming={isAnimating} />
    </div>
  )
})

const AssistantMessageFooter = memo(function AssistantMessageFooter({
  messageId,
  text,
  modelName,
  canRegenerate,
  onRegenerate,
}: {
  messageId: string
  text: string
  modelName?: string | null
  canRegenerate: boolean
  onRegenerate: (messageId: string) => void
}) {
  return (
    <AssistantMessageActions
      messageId={messageId}
      text={text}
      modelName={modelName}
      canRegenerate={canRegenerate}
      onRegenerate={onRegenerate}
    />
  )
})

export function ChatMessage({
  message,
  isAnimating = false,
  canRegenerate,
  canEdit,
  onRegenerate,
  onEdit,
  branchSelector,
}: ChatMessageProps) {
  const text = useMemo(() => getRawMessageText(message), [message.parts])
  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(text)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const isUser = message.role === 'user'
  const direction = useDirection()
  const metadata = message.metadata as ChatMessageMetadata | undefined
  const attachmentManifest = (isUser ? metadata?.attachments ?? [] : []).filter(
    (attachment): attachment is ChatAttachment =>
      !!attachment &&
      typeof attachment === 'object' &&
      typeof attachment.key === 'string' &&
      typeof attachment.name === 'string' &&
      typeof attachment.contentType === 'string',
  )
  const modelName = !isUser && typeof metadata?.model === 'string'
    ? metadata.model
    : null

  useEffect(() => {
    if (isEditing || isSavingEdit) return
    setDraftText(text)
  }, [isEditing, isSavingEdit, text])

  useEffect(() => {
    if (!isEditing) return
    const textarea = editTextareaRef.current
    if (!textarea) return
    // Focus + select all on edit entry so users can replace the full message instantly.
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.select()
    })
  }, [isEditing])

  if (isUser) {
    return (
      <div
        className="group flex w-full items-end justify-end gap-2 pt-8 pb-1 is-user"
        data-role={message.role}
      >
        <div className="flex max-w-[80%] flex-col items-end gap-2">
          <div
            dir={direction}
            className="relative flex min-h-7 w-fit max-w-full self-end flex-col gap-3 overflow-hidden rounded-3xl ltr:rounded-br-lg rtl:rounded-bl-lg border border-border-base bg-surface-overlay px-4 py-1.5 text-md"
          >
            <div className="space-y-4 size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <div className="whitespace-pre-wrap break-words text-md leading-7">
                {isEditing ? (
                  <div className="relative">
                    {/*
                      Mirror text preserves the exact wrapping footprint from the
                      read-only renderer so toggling edit mode does not reflow lines.
                    */}
                    <div
                      aria-hidden
                      className="pointer-events-none whitespace-pre-wrap break-words opacity-0"
                    >
                      {getEditMirrorText(draftText)}
                    </div>
                    <textarea
                      ref={editTextareaRef}
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      onKeyDown={(event) => {
                        const isSubmitShortcut =
                          (event.ctrlKey || event.metaKey) &&
                          event.key === 'Enter'
                        if (!isSubmitShortcut) return
                        event.preventDefault()
                        if (!canEdit || isSavingEdit) return
                        const nextDraftText = draftText
                        setIsSavingEdit(true)
                        setIsEditing(false)
                        void onEdit({
                          messageId: message.id,
                          editedText: nextDraftText,
                        }).finally(() => {
                          setIsSavingEdit(false)
                        })
                      }}
                      dir="auto"
                      className="absolute inset-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-md leading-7 outline-none"
                      style={{ font: 'inherit' }}
                      disabled={isSavingEdit}
                    />
                  </div>
                ) : (
                  text || '\u00a0'
                )}
              </div>
            </div>
          </div>
          {attachmentManifest.length > 0 && (
            <div className="flex w-full flex-wrap justify-end gap-2">
              {attachmentManifest.map((attachment) => (
                <div
                  key={attachment.key}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border-light bg-surface-overlay px-2.5 py-1 text-xs"
                >
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground-secondary">
                    {getFileTypeIndicator(attachment.name)}
                  </span>
                  <span className="truncate text-foreground-secondary">
                    {attachment.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="w-full">
            <UserMessageActions
              messageId={message.id}
              text={text}
              canRegenerate={canRegenerate}
              canEdit={canEdit}
              onRegenerate={onRegenerate}
              isEditing={isEditing}
              isSavingEdit={isSavingEdit}
              onStartEdit={() => {
                if (!canEdit) return
                setDraftText(text)
                setIsEditing(true)
              }}
              onCancelEdit={() => {
                setDraftText(text)
                setIsEditing(false)
                setIsSavingEdit(false)
              }}
              onConfirmEdit={() => {
                if (!canEdit || isSavingEdit) return
                const nextDraftText = draftText
                // Optimistic UX: immediately exit edit mode and disable
                // edit controls while the request is in flight.
                setIsSavingEdit(true)
                setIsEditing(false)
                void onEdit({
                  messageId: message.id,
                  editedText: nextDraftText,
                }).finally(() => {
                  setIsSavingEdit(false)
                })
              }}
              branchSelector={branchSelector}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group flex w-full items-end gap-2 py-1 is-assistant"
      data-role={message.role}
    >
      <div
        dir={direction}
        className="flex w-full flex-col gap-3 overflow-hidden text-foreground-strong leading-[21px]"
      >
        <AssistantMessageContent parts={message.parts} isAnimating={isAnimating} />
        <AssistantMessageFooter
          messageId={message.id}
          text={text}
          modelName={modelName}
          canRegenerate={canRegenerate}
          onRegenerate={onRegenerate}
        />
      </div>
    </div>
  )
}
