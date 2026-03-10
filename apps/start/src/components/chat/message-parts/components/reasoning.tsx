'use client'

import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import { X } from 'lucide-react'
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Streamdown } from 'streamdown'
import { useRightSidebar } from '@/components/layout/right-sidebar-context'
import { m } from '@/paraglide/messages.js'
import {
  streamdownStaticComponents,
  streamdownStreamingComponents,
} from '../renderers/streamdown-components'

type ReasoningTriggerProps = {
  reasoningText: string
  isStreaming: boolean
}

type ReasoningPanelProps = {
  textRef: RefObject<string>
  isStreamingRef: RefObject<boolean>
  onClose: () => void
}

const circleA =
  'M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z'

const infinity =
  'M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z'

const circleB =
  'M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z'

const fontWeights = { medium: "'wght' 500" } as const

/** Icon mask dimensions. The label uses normal DOM text so browser bidi/layout rules apply. */
const SHIMMER_ICON_MASK_SIZE = 36

/**
 * Matches the markdown rendering stack used for assistant text parts so reasoning
 * content in the sidebar supports code fences, tables, math, and Mermaid diagrams.
 */

/**
 * Panel shown in the right sidebar when the user opens reasoning from a message.
 * Renders title, close button, and scrollable reasoning text. Owned by the chat feature.
 */
function ReasoningPanel({
  textRef,
  isStreamingRef,
  onClose,
}: ReasoningPanelProps) {
  const [text, setText] = useState(textRef.current)
  const [isStreaming, setIsStreaming] = useState(isStreamingRef.current)

  useEffect(() => {
    // Sidebar content is stored as a ReactNode snapshot in context, so this panel
    // mirrors the latest refs while open instead of requiring the user to reopen it.
    const sync = () => {
      setText(textRef.current)
      setIsStreaming(isStreamingRef.current)
    }

    sync()
    const interval = window.setInterval(sync, 120)
    return () => window.clearInterval(interval)
  }, [isStreamingRef, textRef])

  return (
    <>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-border-light px-3 py-2">
        <ThinkingIndicator
          isStreaming={isStreaming}
          finishedLabel={m.chat_reasoning_label()}
          className="min-w-0 shrink p-0 text-foreground-strong"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={m.chat_reasoning_close_sidebar_aria_label()}
          className="size-8 shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div
        className="mt-3 min-h-0 flex-1 overflow-y-auto text-foreground-primary ltr:-mr-3 rtl:-ml-3"
        aria-live={isStreaming ? 'polite' : 'off'}
      >
        <Streamdown
          controls={false}
          mode={isStreaming ? 'streaming' : 'static'}
          components={
            isStreaming
              ? streamdownStreamingComponents
              : streamdownStaticComponents
          }
          className="min-w-0 max-w-full break-words text-[14px] ltr:pr-3 rtl:pl-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        >
          {text || '\u00a0'}
        </Streamdown>
      </div>
    </>
  )
}

/**
 * Thinking indicator UI shown in assistant rows where reasoning content exists.
 * When cycling, uses a single gradient that flows right-to-left across both
 * the icon and text, resetting at the left edge of the icon.
 */
const ThinkingIndicatorBase = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    isStreaming: boolean
    finishedLabel?: string
  }
>(({ className, isStreaming, finishedLabel, ...props }, ref) => {
  const [index, setIndex] = useState(0)
  const words = [
    m.chat_reasoning_thinking_word_1(),
    m.chat_reasoning_thinking_word_2(),
    m.chat_reasoning_thinking_word_3(),
    m.chat_reasoning_thinking_word_4(),
  ]
  const finishedWord = finishedLabel ?? m.chat_reasoning_finished()

  useEffect(() => {
    if (!isStreaming) return
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % words.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [isStreaming])

  return (
    <div
      ref={ref}
      role="status"
      className={cn('relative px-3 py-2', className)}
      {...props}
    >
      <div
        className="relative flex items-center gap-2"
      >
        <ReasoningMotionIcon
          isAnimating={isStreaming}
          size={36}
          className="size-9 shrink-0"
          aria-hidden="true"
          shimmerClassName="shimmer-unified"
        />
        <span
          className="inline-grid overflow-hidden text-[16px] text-start"
          style={{ fontVariationSettings: fontWeights.medium }}
        >
          <span
            className="invisible col-start-1 row-start-1 whitespace-pre"
            aria-hidden="true"
          >
            {isStreaming
              ? words.reduce((a, b) => (a.length >= b.length ? a : b))
              : finishedWord}
          </span>
          {isStreaming ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={words[index]}
                className="col-start-1 row-start-1 block whitespace-pre thinking-shimmer-text"
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
            <span className="col-start-1 row-start-1 text-foreground-secondary">
              {finishedWord}
            </span>
          )}
        </span>
      </div>
    </div>
  )
})

ThinkingIndicatorBase.displayName = 'ThinkingIndicator'

const ThinkingIndicator = memo(
  ThinkingIndicatorBase,
  (previous, next) =>
    previous.isStreaming === next.isStreaming &&
    previous.className === next.className &&
    previous.finishedLabel === next.finishedLabel,
)

type ReasoningMotionIconProps = {
  isAnimating: boolean
  size?: number
  className?: string
  shimmerClassName?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}

export const ReasoningMotionIcon = memo(function ReasoningMotionIcon({
  isAnimating,
  size = SHIMMER_ICON_MASK_SIZE,
  className,
  shimmerClassName,
  'aria-hidden': ariaHidden,
}: ReasoningMotionIconProps) {
  const maskId = useId()
  const maskSize = `${size}px ${size}px`

  return (
    <span className={cn('relative inline-flex shrink-0', className)} aria-hidden={ariaHidden}>
      <svg aria-hidden className="absolute size-0 overflow-hidden">
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={size}
            height={size}
          >
            <motion.path
              d={circleA}
              animate={
                isAnimating
                  ? {
                      d: [circleA, infinity, circleB, infinity, circleA],
                    }
                  : undefined
              }
              transition={
                isAnimating
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
              fill="none"
              stroke="white"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="scale(1.5)"
            />
          </mask>
        </defs>
      </svg>
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn('text-foreground-secondary', isAnimating && shimmerClassName && 'invisible')}
      >
        <motion.path
          d={circleA}
          animate={
            isAnimating
              ? {
                  d: [circleA, infinity, circleB, infinity, circleA],
                }
              : undefined
          }
          transition={
            isAnimating
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
      {isAnimating && shimmerClassName ? (
        <div
          className={cn('absolute inset-0', shimmerClassName)}
          style={{
            mask: `url(#${maskId})`,
            maskSize,
            maskRepeat: 'no-repeat',
            maskPosition: '0 0',
            WebkitMask: `url(#${maskId})`,
            WebkitMaskSize: maskSize,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: '0 0',
          }}
        />
      ) : null}
    </span>
  )
})

type ReasoningTriggerButtonProps = {
  reasoningTextRef: RefObject<string>
  isStreaming: boolean
}

const ReasoningTriggerButton = memo(function ReasoningTriggerButton({
  reasoningTextRef,
  isStreaming,
}: ReasoningTriggerButtonProps) {
  const { open, close } = useRightSidebar()
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming
  const ariaLabel = isStreaming
    ? m.chat_reasoning_show_streaming_aria_label()
    : m.chat_reasoning_show_aria_label()

  const handleOpen = useCallback(() => {
    const reasoningText = reasoningTextRef.current.trim()
    if (!reasoningText) return

    open(
      <ReasoningPanel
        textRef={reasoningTextRef}
        isStreamingRef={isStreamingRef}
        onClose={close}
      />,
    )
  }, [close, open, reasoningTextRef, isStreamingRef])

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group flex w-full cursor-pointer items-center justify-start text-start transition-colors"
      aria-label={ariaLabel}
    >
      <ThinkingIndicator
        isStreaming={isStreaming}
        className="text-foreground-secondary p-0"
      />
    </button>
  )
}, areReasoningTriggerButtonsEqual)

function areReasoningTriggerButtonsEqual(
  previous: ReasoningTriggerButtonProps,
  next: ReasoningTriggerButtonProps,
): boolean {
  return (
    previous.reasoningTextRef === next.reasoningTextRef &&
    previous.isStreaming === next.isStreaming
  )
}

/**
 * Opens the right sidebar with the message's reasoning
 */
export function ReasoningTrigger({
  reasoningText,
  isStreaming,
}: ReasoningTriggerProps) {
  const reasoningTextRef = useRef(reasoningText)
  reasoningTextRef.current = reasoningText

  if (!reasoningText.trim()) return null

  return (
    <ReasoningTriggerButton
      reasoningTextRef={reasoningTextRef}
      isStreaming={isStreaming}
    />
  )
}
