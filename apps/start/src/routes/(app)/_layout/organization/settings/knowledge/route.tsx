import { createFileRoute } from '@tanstack/react-router'
import { OrgKnowledgePage } from '@/components/organization/settings/org-knowledge/org-knowledge-page'

/**
 * Organization settings route for org-wide custom retrieval knowledge.
 * Path: /organization/settings/knowledge
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/knowledge',
)({
  component: OrgKnowledgePage,
})
