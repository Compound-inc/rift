// Renders chat messages and keeps scroll pinned to the latest user message.
import { useMemo } from 'react'
import { useChat } from './chat-context'
import { ChatMessage } from './chat-message'
import { usePinToLastUserMessage } from '@rift/chat-scroll'

/** Space reserved for the fixed prompt at the bottom (match Orchid). */
const BOTTOM_PADDING_PX = 164

export function ChatThread() {
  const { messages, status } = useChat()
  const sorted = useMemo(() => messages.slice(), [messages])
  const userMessageCount = useMemo(
    () => sorted.filter((m) => m.role === 'user').length,
    [sorted]
  )
  const lastUserMessageId = useMemo(() => {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const message = sorted[i]
      if (message.role === 'user') return message.id
    }
    return null
  }, [sorted])

  const {
    lastUserMessageRef,
    contentEndRef,
    spacerRef,
    bottomRef,
  } = usePinToLastUserMessage({
    userMessageCount,
    lastUserMessageId,
    messages: sorted,
    status,
    bottomPaddingPx: BOTTOM_PADDING_PX,
  })

  const isStreaming = status === 'submitted' || status === 'streaming'
  const lastMessage = messages.at(-1)
  const showThinking = isStreaming && (!lastMessage || lastMessage.role === 'user')

  return (
    <div
      className="mx-auto w-full max-w-2xl flex flex-col pt-9"
      style={{ paddingBottom: BOTTOM_PADDING_PX }}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.length === 0 && (
        <p className="py-8 text-center text-content-muted">
          Start a new conversation
        </p>
      )}
      {messages.map((m) => {
        const isLastUserMessage =
          m.role === 'user' && lastUserMessageId != null && m.id === lastUserMessageId
        return (
          <div
            key={m.id}
            ref={isLastUserMessage ? lastUserMessageRef : undefined}
          >
            <ChatMessage message={m} />
          </div>
        )
      })}
      {showThinking && (
        <div
          className="group flex w-full items-end gap-2 py-4 is-assistant"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex w-full flex-col gap-3 overflow-hidden text-content-emphasis text-[14px] leading-[21px]">
            <div className="w-full">
              <div className="py-1">
                <div className="flex items-center gap-2">
                  <div
                    className="size-2 shrink-0 rounded-full bg-ai animate-pulse-size"
                    aria-hidden
                  />
                  <span className="text-sm leading-[21px] text-content-muted">
                    Thinking…
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={contentEndRef} aria-hidden style={{ height: 0 }} />
      <div ref={spacerRef} aria-hidden style={{ height: 0 }} />
      <div ref={bottomRef} />
    </div>
  )
}
