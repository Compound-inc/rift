// Single chat message renderer (user/assistant).
import type { UIMessage } from 'ai'

function getMessageText(message: UIMessage): string {
  if (message.parts.length === 0) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n')
    .trim()
}

export function ChatMessage({ message }: { message: UIMessage }) {
  const text = getMessageText(message)
  const isUser = message.role === 'user'

  return (
    <div
      className={`group flex w-full items-end gap-2 ${isUser ? 'is-user pt-8 pb-4' : 'is-assistant py-4'}`}
      data-role={message.role}
    >
      <div className="flex w-full flex-col gap-3 overflow-hidden text-content-emphasis text-[14px] leading-[21px] group-[.is-user]:text-[18px] group-[.is-user]:leading-[27px]">
        <div className="space-y-4 size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <div className="whitespace-pre-wrap break-words">
            {text || '\u00a0'}
          </div>
        </div>
      </div>
    </div>
  )
}
