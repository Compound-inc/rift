import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/org-settings/')({
  component: OrgSettingsIndexPage,
})

function OrgSettingsIndexPage() {
  return <Navigate to="/org-settings/model-policy" />
}
