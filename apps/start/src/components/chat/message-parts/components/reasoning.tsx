'use client'

import { Button } from '@rift/ui/button'
import { X } from 'lucide-react'
import { Streamdown } from 'streamdown'
import { useRightSidebar } from '@/components/layout/right-sidebar-context'
import { streamdownComponents } from '../renderers/streamdown-components'

type ReasoningTriggerProps = {
  reasoningText: string
  isStreaming: boolean
}

/**
 * Matches the markdown rendering stack used for assistant text parts so reasoning
 * content in the sidebar supports code fences, tables, math, and Mermaid diagrams.
 */

function ReasoningIcon() {
  return (
    <svg
      aria-hidden="true"
      width="44"
      height="40"
      viewBox="0 0 44 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-4 shrink-0"
    >
      <g clipPath="url(#reasoning-icon-clip)">
        <path
          d="M31.996 10.253C32.6364 10.0879 33.308 10 34 10C38.4182 10 42 13.5817 42 18C42 22.4182 38.4182 26 34 26C33.2902 26 32.6018 25.9076 31.9466 25.734M31.996 10.253C31.9986 10.169 32 10.0847 32 10C32 5.58172 28.4182 2 24 2C20.1648 2 16.9599 4.69878 16.1808 8.30086M31.996 10.253C31.9538 11.6153 31.5708 12.8917 30.9298 14M31.9466 25.734C31.9818 25.4944 32 25.2494 32 25C32 22.581 30.2822 20.5632 28 20.1M31.9466 25.734C31.5914 28.1474 29.512 30 27 30H26C21.5818 30 18 33.5818 18 38M16.1808 8.30086C15.4875 8.10486 14.756 8 14 8C9.58172 8 6 11.5817 6 16C6 16.7772 6.11084 17.5286 6.31756 18.239M16.1808 8.30086C18.203 8.8725 19.8996 10.2193 20.9298 12M6.31756 18.239C3.8228 18.9664 2 21.2704 2 24C2 27.3138 4.6863 30 8 30C10.6124 30 12.8349 28.3304 13.6586 26M6.31756 18.239C6.49842 18.8606 6.75264 19.451 7.07026 20"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          opacity="0.4"
          d="M21.6722 19.487C20.6514 20.4706 18.906 20.6404 17.4143 19.8016C15.9224 18.9628 15.1606 17.3834 15.4707 16"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <defs>
        <clipPath id="reasoning-icon-clip">
          <rect width="44" height="40" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}

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
          <ReasoningIcon />
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
 * Text-only trigger that opens the right sidebar with this message's AI reasoning.
 * Used by assistant message decorators; keeps the message row minimal.
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
      className="group text-secondary-text flex w-full cursor-pointer items-center justify-start gap-1 text-sm transition-colors"
      aria-label={isStreaming ? 'Show reasoning (streaming)' : 'Show reasoning'}
    >
      <ReasoningIcon />
      Reasoning
    </button>
  )
}
