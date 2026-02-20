import { createFileRoute } from '@tanstack/react-router'
import { ChatProvider, ChatThread, ChatInput } from '@/components/chat'

export const Route = createFileRoute('/(app)/_layout/chat')({
  component: ChatPage,
})

function ChatPage() {
  return (
    <ChatProvider>
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
    </ChatProvider>
  )
}
