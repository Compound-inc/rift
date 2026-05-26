import { createFileRoute } from '@tanstack/react-router'

import { SkillsPage } from '@/components/chat/skills/skills-page'

/**
 * Top-level Skills route. Manages the user's Personal Skills plus the
 * Org-Shared pool they participate in. See ADR-0005 and CONTEXT.md.
 */
export const Route = createFileRoute('/(app)/_layout/chat/skills')({
  component: GlobalSkillsRoute,
})

function GlobalSkillsRoute() {
  return <SkillsPage scope={{ kind: 'global' }} />
}
