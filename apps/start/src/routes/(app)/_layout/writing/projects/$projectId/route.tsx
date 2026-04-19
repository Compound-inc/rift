import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { WritingWorkspacePage } from '@/components/writing/writing-workspace-page'

export const Route = createFileRoute('/(app)/_layout/writing/projects/$projectId' as any)({
  validateSearch: z.object({
    chatId: z.string().trim().min(1).optional(),
  }),
  component: WritingProjectRoute,
})

function WritingProjectRoute() {
  const { projectId } = Route.useParams()
  const { chatId } = Route.useSearch()
  return <WritingWorkspacePage projectId={projectId} initialChatId={chatId} />
}
