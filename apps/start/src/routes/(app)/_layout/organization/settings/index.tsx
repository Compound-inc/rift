import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/organization/settings/')({
  component: OrganizationSettingsIndexPage,
})

function OrganizationSettingsIndexPage() {
  return <Navigate to="/organization/settings/models" />
}
