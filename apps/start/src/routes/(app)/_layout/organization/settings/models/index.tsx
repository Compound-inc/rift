import { createFileRoute } from '@tanstack/react-router'
import { ModelsPage } from '@/components/organization/settings/model-policy'

/**
 * Organization settings: provider and model list (exact path /organization/settings/models).
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/models/',
)({
  component: ModelsPage,
})
