import { createFileRoute } from '@tanstack/react-router'
import { PersonalizationPage } from '@/components/settings/personalization/personalization-page'

export const Route = createFileRoute('/(app)/_layout/settings/personalization')({ component: PersonalizationPage })
