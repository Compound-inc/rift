'use client'

import { useCallback, useState } from 'react'
import { useChat } from './chat-context'
import {
  PromptInputRoot,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from './prompt-input'
import { cn } from '@rift/utils'


export function ChatInput() {
  const { sendMessage, status, stop } = useChat()
  const [input, setInput] = useState('')

  const isBusy = status === 'submitted' || status === 'streaming'
  const isEmpty = !input.trim()
  const showThinking = isBusy

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isBusy) return
      sendMessage({ text })
      setInput('')
    },
    [input, isBusy, sendMessage]
  )

  return (
    <PromptInputRoot onSubmit={handleSubmit} className="w-full">
      {/* Thinking state bar (from reference orchid): collapsible row with pulse + Cancel */}
      <div
        className={cn(
          'grid overflow-hidden transition-[grid-template-rows] duration-500 ease-out',
          showThinking ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <div
              className="flex items-center gap-2 text-content-muted"
              aria-live="polite"
            >
              <div
                className={cn(
                  'size-2 shrink-0 rounded-full bg-ai',
                  showThinking && 'animate-pulse-size'
                )}
                aria-hidden
              />
              <span className="text-sm leading-[21px]">Thinking…</span>
            </div>
            {showThinking ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-lg px-1.5 py-1 text-sm leading-[21px] text-content-muted outline-none transition-colors hover:bg-bg-subtle hover:text-content-default focus-visible:ring-2 focus-visible:ring-border-emphasis"
                aria-label="Cancel"
              >
                Cancel
              </button>
            ) : (
              <div className="h-7 shrink-0" aria-hidden />
            )}
          </div>
        </div>
      </div>

      <PromptInputTextarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask anything..."
        disabled={isBusy}
        aria-label="Message"
      />

      <PromptInputToolbar>
        <div className="flex flex-1" />
        <PromptInputSubmit
          status={status}
          onStop={stop}
          disabled={isEmpty || isBusy}
        />
      </PromptInputToolbar>
    </PromptInputRoot>
  )
}
