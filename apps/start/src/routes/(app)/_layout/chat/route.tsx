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
  const segments = trailing.length > 0 ? trailing.split('/') : []
  const firstSegment = segments[0] ?? ''

  const threadId =
    firstSegment.length > 0 && !RESERVED_FIRST_SEGMENTS.has(firstSegment)
      ? firstSegment
      : undefined

  const isProjectsArea = firstSegment === 'projects'
  const projectIdFromPath =
    isProjectsArea && segments.length >= 2 ? segments[1] : undefined
  /**
   * Project sub-pages (sources, parameters/settings) own their own page
   * chrome, so we suppress the chat shell to avoid the welcome screen +
   * composer rendering behind them. The project landing route, by
   * contrast, *is* the welcome + composer for that project.
   */
  const isProjectSubPage = isProjectsArea && segments.length > 2

  /**
   * Resolved project context for the chat session. Path takes precedence
   * over the legacy `?projectId=` query param so that `/chat/projects/<id>`
   * always bootstraps a project-scoped chat.
   */
  const projectId = threadId
    ? undefined
    : projectIdFromPath ?? searchProjectId

  return (
    <ChatProvider threadId={threadId} projectId={projectId}>
      {isProjectSubPage ? null : <ChatPageShell />}
      <Outlet />
    </ChatProvider>
  )
}
