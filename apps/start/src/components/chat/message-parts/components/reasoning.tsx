'use client'

import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import { ReasoningIcon } from '@rift/ui/icons/svg-icons'
import { X } from 'lucide-react'
import { forwardRef, useEffect, useState, type HTMLAttributes } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Streamdown } from 'streamdown'
import { useRightSidebar } from '@/components/layout/right-sidebar-context'
import { streamdownComponents } from '../renderers/streamdown-components'

type ReasoningTriggerProps = {
  reasoningText: string
  isStreaming: boolean
}

const circleA =
  'M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z'

const infinity =
  'M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z'

const circleB =
  'M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z'

const words = ['Thinking', 'Moonwalking', 'Planning', 'Refining']
const fontWeights = { medium: "'wght' 500" } as const
const finishedWord = 'Finished reasoning'

/**
 * Matches the markdown rendering stack used for assistant text parts so reasoning
 * content in the sidebar supports code fences, tables, math, and Mermaid diagrams.
 */

/**
 * Panel shown in the right sidebar when the user opens reasoning from a message.
 * Renders title, close button, and scrollable reasoning text. Owned by the chat feature.
 */
function ReasoningPanel({
  text,
  isStreaming,
  onClose,
}: {
  text: string
  isStreaming: boolean
  onClose: () => void
}) {
  return (
    <>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-border-muted px-3 py-2">
        <span className="inline-flex items-center gap-2 text-lg font-semibold text-content-emphasis">
          <ReasoningIcon className="size-4 shrink-0" />
          Reasoning
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close sidebar"
          className="size-8 shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div
        className="mt-3 min-h-0 flex-1 overflow-y-auto text-content-emphasis"
        aria-live={isStreaming ? 'polite' : 'off'}
      >
        <Streamdown
          controls={false}
          mode={isStreaming ? 'streaming' : 'static'}
          components={streamdownComponents}
          className="chat-streamdown min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        >
          {text || '\u00a0'}
        </Streamdown>
      </div>
    </>
  )
}

/**
 * Thinking indicator UI shown in assistant rows where reasoning content exists.
 */
const ThinkingIndicator = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { isStreaming: boolean }
>(({ className, isStreaming, ...props }, ref) => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % words.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      ref={ref}
      role="status"
      className={cn('flex items-center gap-2 px-3 py-2', className)}
      {...props}
    >
      <motion.svg
        aria-hidden
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-muted-foreground"
      >
        <motion.path
          d={isStreaming ? undefined : circleA}
          animate={
            isStreaming
              ? {
                  d: [circleA, infinity, circleB, infinity, circleA],
                }
              : undefined
          }
          transition={
            isStreaming
              ? {
                  d: {
                    duration: 6,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    times: [0, 0.25, 0.5, 0.75, 1.0],
                  },
                }
              : undefined
          }
        />
      </motion.svg>
      <span
        className="inline-grid overflow-hidden text-[13px]"
        style={{ fontVariationSettings: fontWeights.medium }}
      >
        <span
          className="shimmer-text invisible col-start-1 row-start-1"
          aria-hidden="true"
        >
          {isStreaming
            ? words.reduce((a, b) => (a.length >= b.length ? a : b))
            : finishedWord}
        </span>
        {isStreaming ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={words[index]}
              className="shimmer-text col-start-1 row-start-1"
              initial={{ y: '80%', opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
              }}
              exit={{
                y: '-80%',
                opacity: 0,
                transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] },
              }}
            >
              {words[index]}
            </motion.span>
          </AnimatePresence>
        ) : (
          <span className="col-start-1 row-start-1 text-muted-foreground">
            {finishedWord}
          </span>
        )}
      </span>
    </div>
  )
})

ThinkingIndicator.displayName = 'ThinkingIndicator'

/**
 * Opens the right sidebar with the message's reasoning
 */
export function ReasoningTrigger({
  reasoningText,
  isStreaming,
}: ReasoningTriggerProps) {
  const { open, close } = useRightSidebar()

  if (!reasoningText.trim()) return null

  return (
    <button
      type="button"
      onClick={() =>
        open(
          <ReasoningPanel
            text={reasoningText}
            isStreaming={isStreaming}
            onClose={close}
          />,
        )
      }
      className="group flex w-full cursor-pointer items-center justify-start text-left transition-colors"
      aria-label={isStreaming ? 'Show reasoning (streaming)' : 'Show reasoning'}
    >
      <ThinkingIndicator
        isStreaming={isStreaming}
        className="text-secondary-text p-0"
      />
    </button>
  )
}
