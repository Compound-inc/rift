import { createFileRoute } from '@tanstack/react-router'
import { ArchivedChatsPage } from '@/components/chat/archived-chats-page'

export const Route = createFileRoute('/(app)/_layout/settings/archived')({
  component: ArchivedChatsPage,
})
