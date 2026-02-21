import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { ChatProvider } from '@/components/chat'

export const Route = createFileRoute('/(app)/_layout/chat')({
  component: ChatLayout,
})

const reservedSegments = new Set(['new-chat', 'projects'])

function ChatLayout() {
  const { pathname } = useLocation()

  const normalized = pathname.replace(/\/+$/, '')
  const maybeSegment = normalized.startsWith('/chat/')
    ? normalized.slice('/chat/'.length)
    : undefined

  const threadId =
    maybeSegment && !reservedSegments.has(maybeSegment) ? maybeSegment : undefined

  return (
    <ChatProvider threadId={threadId}>
      <Outlet />
    </ChatProvider>
  )
}
