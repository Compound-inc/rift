import {
  Outlet,
  createFileRoute,
  useLocation,
  useSearch,
} from '@tanstack/react-router'
import { z } from 'zod'
import { ChatProvider } from '@/components/chat'
import { ChatPageShell } from '@/components/chat/chat-page-shell'

const chatSearchSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
})

export const Route = createFileRoute('/(app)/_layout/chat')({
  component: ChatLayout,
  validateSearch: chatSearchSchema,
})

/**
 * First-path-segments under `/chat/` that are not thread IDs. Today only
 * `projects` is reserved.
 */
const RESERVED_FIRST_SEGMENTS = new Set(['projects'])

function ChatLayout() {
  const { pathname } = useLocation()
  const { projectId: searchProjectId } = useSearch({
    from: '/(app)/_layout/chat',
  })

  const normalized = pathname.replace(/\/+$/, '')
  const trailing = normalized.startsWith('/chat/')
    ? normalized.slice('/chat/'.length)
    : ''
  const firstSegment = trailing.length > 0 ? trailing.split('/')[0] : ''

  const threadId =
    firstSegment.length > 0 && !RESERVED_FIRST_SEGMENTS.has(firstSegment)
      ? firstSegment
      : undefined

  // Project pages render their own content; suppressing ChatPageShell here
  // prevents the chat thread + composer from double-rendering behind it.
  const isProjectRoute = firstSegment === 'projects'

  const projectId = threadId ? undefined : searchProjectId

  return (
    <ChatProvider threadId={threadId} projectId={projectId}>
      {isProjectRoute ? null : <ChatPageShell />}
      <Outlet />
    </ChatProvider>
  )
}
