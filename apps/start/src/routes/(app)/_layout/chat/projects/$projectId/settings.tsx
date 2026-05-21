import { createFileRoute } from '@tanstack/react-router'
import { ProjectSettingsPage } from '@/components/chat/projects/project-settings-page'

export const Route = createFileRoute(
  '/(app)/_layout/chat/projects/$projectId/settings',
)({
  component: ProjectSettingsRoute,
})

function ProjectSettingsRoute() {
  const { projectId } = Route.useParams()
  return <ProjectSettingsPage projectId={projectId} />
}
