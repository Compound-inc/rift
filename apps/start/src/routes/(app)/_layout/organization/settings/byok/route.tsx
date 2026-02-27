import { createFileRoute } from '@tanstack/react-router'
import { ByokPage } from '@/components/organization/settings/byok'

export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/byok',
)({
  component: ByokPage,
})
