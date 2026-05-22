import { createFileRoute } from '@tanstack/react-router'

import { ProjectSourcesPage } from '@/components/chat/projects/project-sources-page'

/**
 * Project Sources route. Surface for the project's RAG corpus
 * (Project Files in CONTEXT.md terms). Visually mirrors the org-knowledge
 * settings page when populated and falls into a dedicated onboarding
 * composition when empty. Delegates all rendering to the page component.
 */
export const Route = createFileRoute(
  '/(app)/_layout/chat/projects/$projectId/sources',
)({
  component: ProjectSourcesRoute,
})

function ProjectSourcesRoute() {
  const { projectId } = Route.useParams()
  return <ProjectSourcesPage projectId={projectId} />
}
