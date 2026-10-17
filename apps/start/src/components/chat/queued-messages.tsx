import { Button } from '@rift/ui/button'
import { Pencil, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { m } from '@/paraglide/messages.js'
import { generationQueue, useGenerationQueue } from './generation-queue-store'
import type { QueuedMessage } from './generation-queue-store'

/**
 * Queued follow-ups shown inside the composer frame, above the input.
 *
 * Each item uses the same surface and capsule shape as the input pill below
 * it (bg-surface-base, rounded-[24px], full frame width) so the queue reads as
 * messages waiting in line rather than a separate widget. Items fade and rise
 * in briefly; removal is a softer, faster fade. Both are skipped for
 * reduced-motion users and on first render.
 */
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
  const reducedMotion = useReducedMotion()
  if (!threadId || !queue.items.length) return null
  return (
    <div
      className="mb-1.5 flex max-h-48 flex-col gap-1.5 overflow-y-auto"
      role="region"
      aria-label={m.chat_queue_label()}
    >
      <p className="px-4 pt-0.5 text-xs text-foreground-tertiary">
        {queue.paused ? m.chat_queue_paused() : m.chat_queue_label()}
      </p>
      <AnimatePresence initial={false}>
        {queue.items.map((item) => (
          <motion.div
            key={item.id}
            layout={reducedMotion ? false : 'position'}
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, y: -2, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }
            }
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-[24px] bg-surface-base py-0.5 pl-4 pr-1"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-foreground-primary">
              {item.text}
            </span>
            {item.attachments?.length ? (
              <span className="shrink-0 text-xs text-foreground-tertiary">
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
                className="shrink-0 rounded-full px-3 text-xs"
                onClick={() => onSend(item.id)}
              >
                {m.chat_queue_send_now()}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full text-foreground-tertiary hover:text-foreground-primary"
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
              className="shrink-0 rounded-full text-foreground-tertiary hover:text-foreground-primary"
              aria-label={m.chat_queue_remove()}
              onClick={() => generationQueue.remove(threadId, item.id)}
            >
              <X className="size-4" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
