import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ChatInput, ChatPageShell } from '@/components/chat'
import { WritingChatProvider } from '@/components/writing/writing-chat-context'
import { WritingChatThread } from '@/components/writing/writing-chat-thread'

export const Route = createFileRoute('/(app)/_layout/writing/projects/$projectId' as any)({
  validateSearch: z.object({
    chatId: z.string().trim().min(1).optional(),
  }),
  component: WritingProjectRoute,
})

function WritingProjectRoute() {
  const { projectId } = Route.useParams()
  const { chatId } = Route.useSearch()

  return (
    <WritingChatProvider projectId={projectId} initialChatId={chatId}>
      <ChatPageShell
        ThreadComponent={WritingChatThread}
        InputComponent={ChatInput}
      />
    </WritingChatProvider>
  )
}
