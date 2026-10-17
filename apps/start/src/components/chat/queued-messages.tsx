import { Button } from '@rift/ui/button'
import { Pencil, X } from 'lucide-react'
import { m } from '@/paraglide/messages.js'
import { generationQueue, useGenerationQueue } from './generation-queue-store'
import type { QueuedMessage } from './generation-queue-store'

/** Compact, keyboard-accessible queue controls above the composer. */
export function QueuedMessages({
  threadId,
  busy,
  editBlocked,
  onEdit,
  onSend,
}: {
  threadId?: string
  busy: boolean
  editBlocked: boolean
  onEdit: (item: QueuedMessage) => void
  onSend: (id: string) => void
}) {
  const queue = useGenerationQueue(threadId)
  if (!threadId || !queue.items.length) return null
  return (
    <div
      className="mb-2 max-h-40 space-y-1 overflow-y-auto px-1"
      role="region"
      aria-label={m.chat_queue_label()}
    >
      <p className="px-2 text-xs text-foreground-secondary">
        {queue.paused ? m.chat_queue_paused() : m.chat_queue_label()}
      </p>
      {queue.items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-1 rounded-xl border border-border-base bg-surface-raised px-2 py-1"
        >
          <span className="min-w-0 flex-1 truncate text-sm">{item.text}</span>
          {item.attachments?.length ? (
            <span className="text-xs text-foreground-secondary">
              {item.attachments.length === 1
                ? m.chat_queue_attachments_one()
                : m.chat_queue_attachments_other({
                    count: item.attachments.length,
                  })}
            </span>
          ) : null}
          {!busy ? (
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => onSend(item.id)}
            >
              {m.chat_queue_send_now()}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={m.chat_queue_edit()}
            disabled={editBlocked}
            onClick={() => onEdit(item)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={m.chat_queue_remove()}
            onClick={() => generationQueue.remove(threadId, item.id)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}
