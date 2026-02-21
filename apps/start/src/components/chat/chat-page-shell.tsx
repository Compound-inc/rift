import { ChatInput } from './chat-input'
import { ChatThread } from './chat-thread'

/**
 * Shared shell used by both `/chat` and `/chat/$threadId`.
 * Keeping a single component prevents subtle layout drift between routes.
 */
export function ChatPageShell() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-visible">
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4"
        style={{ scrollbarGutter: 'stable' }}
      >
        <ChatThread />
      </div>

      <div className="sticky bottom-6 z-40 mx-auto w-full max-w-2xl overflow-visible px-4 pt-4">
        <ChatInput />
      </div>
    </div>
  )
}
