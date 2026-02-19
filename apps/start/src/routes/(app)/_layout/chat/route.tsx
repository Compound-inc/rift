import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/chat')({
  component: ChatPage,
})

function ChatPage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold text-content-emphasis">
        AI Chat
      </h1>
      <p className="mt-2 text-content-muted">Start a new conversation</p>
    </div>
  )
}
