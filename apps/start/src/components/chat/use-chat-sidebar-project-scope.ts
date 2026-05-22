import { useMemo, useRef } from 'react'
import { useQuery } from '@rocicorp/zero/react'

import { queries } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

import { CHAT_HREF } from './chat-sidebar'

const PLACEHOLDER_THREAD_ID = '__chat_sidebar_no_active_thread__'

/**
 * Resolve the active project ID for the chat sidebar.
 *
 * Two paths put the user "inside" a project:
 *   1. The URL is `/chat/projects/<id>/...` (the project landing or any
 *      sub-page).
 *   2. The URL is `/chat/<threadId>` and that thread belongs to a project.
 *
 * Without case (2), sending the first message in a project landing page
 * would flicker the sidebar back to the global mode the moment the URL
 * shifts to `/chat/<newThreadId>`. Matching on the thread's `projectId`
 * keeps the project sidebar sticky across that transition and across any
 * subsequent navigation between threads of the same project.
 *
 * To dampen the inevitable one-frame "thread row not yet hydrated" gap when
 * arriving on a thread URL, we hold onto the previous project id until the
 * thread query completes. The result is a sidebar that snaps into and out
 * of project mode at user-driven boundaries (clicking a project, hitting
 * "Back") rather than at internal data-loading boundaries.
 */
export function useChatSidebarProjectScope(pathname: string): string | null {
  const { activeOrganizationId } = useAppAuth()
  const normalizedOrganizationId = activeOrganizationId?.trim() || undefined
  const lastProjectIdRef = useRef<string | null>(null)

  const { urlProjectId, threadId } = useMemo(
    () => parseChatPathname(pathname),
    [pathname],
  )

  // Subscribe even when there's no thread; Zero queries with placeholder
  // ids return null cheaply and avoid hook-count churn on path changes.
  const [activeThread] = useQuery(
    queries.threads.byId({
      threadId: threadId ?? PLACEHOLDER_THREAD_ID,
      organizationId: normalizedOrganizationId,
    }),
  )

  if (urlProjectId) {
    lastProjectIdRef.current = urlProjectId
    return urlProjectId
  }

  if (!threadId) {
    lastProjectIdRef.current = null
    return null
  }

  // Thread row not yet visible to Zero. Keep the previously resolved
  // project (if any) so the sidebar doesn't flicker out of project mode
  // during the local-write \u2192 server-confirm window.
  if (activeThread === undefined) {
    return lastProjectIdRef.current
  }

  const resolved = activeThread?.projectId ?? null
  lastProjectIdRef.current = resolved
  return resolved
}

type ChatPathnameParts = {
  readonly urlProjectId: string | null
  readonly threadId: string | null
}

function parseChatPathname(pathname: string): ChatPathnameParts {
  if (!pathname.startsWith(`${CHAT_HREF}/`)) {
    return { urlProjectId: null, threadId: null }
  }

  const trailing = pathname.slice(`${CHAT_HREF}/`.length).replace(/\/+$/, '')
  if (trailing.length === 0) {
    return { urlProjectId: null, threadId: null }
  }

  const segments = trailing.split('/')
  if (segments[0] === 'projects') {
    const id = segments[1]
    return {
      urlProjectId: id && id.length > 0 ? id : null,
      threadId: null,
    }
  }

  return { urlProjectId: null, threadId: segments[0] ?? null }
}
