import { createFileRoute } from '@tanstack/react-router'

/**
 * Project landing route. The chat layout renders the shared `ChatPageShell`
 * (welcome + composer) for this path, which the in-thread `ChatThread` then
 * specialises with a project-aware welcome screen. There is therefore no
 * page-level body of our own to render here.
 */
export const Route = createFileRoute(
  '/(app)/_layout/chat/projects/$projectId/',
)({
  component: ProjectLandingRoute,
})

function ProjectLandingRoute() {
  return null
}
