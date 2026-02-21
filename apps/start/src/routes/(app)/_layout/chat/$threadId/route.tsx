import { createFileRoute } from '@tanstack/react-router'
import { ChatPageShell } from '@/components/chat/chat-page-shell'

export const Route = createFileRoute('/(app)/_layout/chat/$threadId')({
  component: ChatThreadPage,
})

// Existing thread page.
function ChatThreadPage() {
  return <ChatPageShell />
}
