import { createFileRoute } from '@tanstack/react-router'
import { ProjectThreadsPage } from '@/components/chat/projects/project-threads-page'

/**
 * Project page (threads home). Lists the Threads inside this Project and
 * exposes a "new chat in project" affordance.
 *
 * Implementation lives in `components/chat/projects/project-threads-page.tsx`
 * so the route file stays a thin TanStack adapter.
 */
export const Route = createFileRoute(
  '/(app)/_layout/chat/projects/$projectId/',
)({
  component: ProjectThreadsRoute,
})

function ProjectThreadsRoute() {
  const { projectId } = Route.useParams()
  return <ProjectThreadsPage projectId={projectId} />
}
