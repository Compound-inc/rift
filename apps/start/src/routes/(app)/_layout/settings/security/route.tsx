import { createFileRoute } from '@tanstack/react-router'
import { SecurityPage } from '@/components/settings/security'

export const Route = createFileRoute('/(app)/_layout/settings/security')({
  component: SecurityPage,
})
