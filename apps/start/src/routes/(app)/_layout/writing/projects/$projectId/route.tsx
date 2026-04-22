import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { WritingChatProvider } from '@/components/writing/writing-chat-context'
import { WritingProjectShell } from '@/components/writing/writing-project-shell'

export const Route = createFileRoute('/(app)/_layout/writing/projects/$projectId' as any)({
  validateSearch: z.object({
    conversationId: z.string().trim().min(1).optional(),
  }),
  component: WritingProjectRoute,
})

function WritingProjectRoute() {
  const { projectId } = Route.useParams()
  const { conversationId } = Route.useSearch()

  return (
    <div className="h-full overflow-hidden">
      <WritingChatProvider
        projectId={projectId}
        initialConversationId={conversationId}
      >
        <WritingProjectShell projectId={projectId} />
      </WritingChatProvider>
    </div>
  )
}
