import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { SkillsPage } from '@/components/chat/skills/skills-page'

/**
 * Top-level Skills route. Manages the user's Personal Skills plus the
 * Org-Shared pool they participate in. See ADR-0005 and CONTEXT.md.
 */
export const Route = createFileRoute('/(app)/_layout/chat/skills')({
  component: GlobalSkillsRoute,
})

function GlobalSkillsRoute() {
  const { loading, user, isAnonymous } = useAppAuth()
  if (loading) return null
  if (!user || isAnonymous) return <Navigate to="/chat" replace />
  return <SkillsPage scope={{ kind: 'global' }} />
}
