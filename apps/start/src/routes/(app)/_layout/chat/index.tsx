import { createFileRoute } from '@tanstack/react-router'
import { ChatPageShell } from '@/components/chat/chat-page-shell'

export const Route = createFileRoute('/(app)/_layout/chat/')({
  component: ChatPage,
})

// New chat page (no thread yet).
function ChatPage() {
  return <ChatPageShell />
}
