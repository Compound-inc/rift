import { createFileRoute } from '@tanstack/react-router'
import { ProjectSettingsPage } from '@/components/chat/projects/project-settings-page'

/**
 * Project settings page (info / instruction / files in one sectioned page —
 * see Q9, Option B). The route is a thin adapter; UI lives in
 * `components/chat/projects/project-settings-page.tsx`.
 */
export const Route = createFileRoute(
  '/(app)/_layout/chat/projects/$projectId/settings',
)({
  component: ProjectSettingsRoute,
})

function ProjectSettingsRoute() {
  const { projectId } = Route.useParams()
  return <ProjectSettingsPage projectId={projectId} />
}
