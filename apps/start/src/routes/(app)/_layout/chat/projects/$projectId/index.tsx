import { createFileRoute } from '@tanstack/react-router'
import { ProjectThreadsPage } from '@/components/chat/projects/project-threads-page'

export const Route = createFileRoute(
  '/(app)/_layout/chat/projects/$projectId/',
)({
  component: ProjectThreadsRoute,
})

function ProjectThreadsRoute() {
  const { projectId } = Route.useParams()
  return <ProjectThreadsPage projectId={projectId} />
}
