import { createFileRoute } from '@tanstack/react-router'
import { MembersPage } from '@/components/organization/settings/members'

/**
 * Organization settings members page.
 * Path: /organization/settings/members
 */
export const Route = createFileRoute('/(app)/_layout/organization/settings/members')({
  component: MembersPage,
})
