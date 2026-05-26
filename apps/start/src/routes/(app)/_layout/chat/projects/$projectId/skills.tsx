import { createFileRoute } from '@tanstack/react-router'

import { SkillsPage } from '@/components/chat/skills/skills-page'

/**
 * Project Skills route — sits at the same level as `sources` and
 * `settings`. Manages Project Skills (scoped to this project only) and the
 * project's per-skill override list for visible Global Skills.
 */
export const Route = createFileRoute(
  '/(app)/_layout/chat/projects/$projectId/skills',
)({
  component: ProjectSkillsRoute,
})

function ProjectSkillsRoute() {
  const { projectId } = Route.useParams()
  return <SkillsPage scope={{ kind: 'project', projectId }} />
}
