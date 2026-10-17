import { createFileRoute } from '@tanstack/react-router'

/** The shared shell composes the Project home around the existing composer. */
export const Route = createFileRoute(
  '/(app)/_layout/chat/projects/$projectId/',
)({
  component: ProjectLandingRoute,
})

function ProjectLandingRoute() {
  return null
}
