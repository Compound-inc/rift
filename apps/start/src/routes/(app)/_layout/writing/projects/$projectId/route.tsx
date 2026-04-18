import { createFileRoute } from '@tanstack/react-router'
import { WritingWorkspacePage } from '@/components/writing/writing-workspace-page'

export const Route = createFileRoute('/(app)/_layout/writing/projects/$projectId' as any)({
  component: WritingProjectRoute,
})

function WritingProjectRoute() {
  const { projectId } = Route.useParams() as { projectId: string }
  return <WritingWorkspacePage projectId={projectId} />
}
