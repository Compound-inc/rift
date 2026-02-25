// Single chat message renderer (user/assistant).
import type { UIMessage } from 'ai'
import { Streamdown, type PluginConfig } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'

const streamdownPlugins = { code, mermaid, math } as PluginConfig
const streamdownAnimated = {
  animation: 'fadeIn',
  duration: 160,
  easing: 'ease-out',
} as const

function getMessageText(message: UIMessage): string {
  if (message.parts.length === 0) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n')
    .trim()
}

type ChatMessageProps = {
  message: UIMessage
  isAnimating?: boolean
}

export function ChatMessage({
  message,
  isAnimating = false,
}: ChatMessageProps) {
  const text = getMessageText(message)
  const isUser = message.role === 'user'
  const animated = isAnimating ? streamdownAnimated : false

  return (
    <div
      className={`group flex w-full items-end gap-2 ${isUser ? 'is-user justify-end pt-8 pb-4' : 'is-assistant py-4'}`}
      data-role={message.role}
    >
      <div
        dir="auto"
        className={
          isUser
            ? 'message-bubble relative flex max-w-[80%] min-h-7 flex-col gap-3 overflow-hidden rounded-3xl rounded-br-lg border border-border-default bg-bg-emphasis px-4 py-1.5 text-md'
            : 'flex w-full flex-col gap-3 overflow-hidden text-content-emphasis text-[14px] leading-[21px]'
        }
      >
        <div className="space-y-4 size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {isUser ? (
            <div className="whitespace-pre-wrap break-words text-md leading-7">
              {text || '\u00a0'}
            </div>
          ) : (
            <Streamdown
              plugins={streamdownPlugins}
              controls={false}
              animated={animated}
              isAnimating={isAnimating}
              mode={isAnimating ? 'streaming' : 'static'}
              className="chat-streamdown min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            >
              {text || '\u00a0'}
            </Streamdown>
          )}
        </div>
      </div>
    </div>
  )
}
