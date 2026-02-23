import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/_layout/org-settings')({
  component: OrgSettingsLayout,
})

function OrgSettingsLayout() {
  return <Outlet />
}
