import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { ChatProvider } from '@/components/chat'
import { ChatPageShell } from '@/components/chat/chat-page-shell'

export const Route = createFileRoute('/(app)/_layout/chat')({
  component: ChatLayout,
})

/**
 * Reserved first-path-segments under `/chat/` that are not thread IDs. Today
 * only `projects` is reserved. When a path begins with `/chat/<reserved>/...`
 * we leave `threadId` undefined and let child routes render the page.
 */
const RESERVED_FIRST_SEGMENTS = new Set(['projects'])

function ChatLayout() {
  const { pathname } = useLocation()

  const normalized = pathname.replace(/\/+$/, '')
  const trailing = normalized.startsWith('/chat/')
    ? normalized.slice('/chat/'.length)
    : ''
  const firstSegment = trailing.length > 0 ? trailing.split('/')[0] : ''

  /**
   * `firstSegment` is `''` for `/chat` itself (welcome screen),
   * `'<threadId>'` for `/chat/:threadId`, or a reserved string for routed
   * sub-pages like `/chat/projects/:projectId`.
   */
  const threadId =
    firstSegment.length > 0 && !RESERVED_FIRST_SEGMENTS.has(firstSegment)
      ? firstSegment
      : undefined

  /**
   * Project pages render their own content; suppressing `ChatPageShell` here
   * prevents the chat thread + composer from double-rendering behind the
   * project route's own UI.
   */
  const isProjectRoute = firstSegment === 'projects'

  return (
    <ChatProvider threadId={threadId}>
      {isProjectRoute ? null : <ChatPageShell />}
      <Outlet />
    </ChatProvider>
  )
}
