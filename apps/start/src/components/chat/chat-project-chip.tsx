// Project chip rendered in the chat header. Shows the Project the active
// thread belongs to and links back to the Project's home page.
//
// Styled as a `ghost` shared-`Button` so it visually peers with the
// sidebar-toggle button sitting next to it in the header row, and so it
// inherits the app's standard hover/active/focus treatment instead of
// rolling its own. The leading `Folder` icon mirrors the project
// iconography used by `chat-sidebar-move-to-project.tsx` and the rest of
// the app.
'use client'

import { Link } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'
import Folder from 'lucide-react/dist/esm/icons/folder'

import { Button } from '@rift/ui/button'

import { queries } from '@/integrations/zero'
import { useChatMessages } from './chat-context'

const PLACEHOLDER_THREAD_ID = '__chat_project_chip_no_thread__'
const PLACEHOLDER_PROJECT_ID = '__chat_project_chip_no_project__'

export function ChatProjectChip() {
  const { activeThreadId } = useChatMessages()
  const [thread] = useQuery(
    queries.threads.byId({
      threadId: activeThreadId ?? PLACEHOLDER_THREAD_ID,
    }),
  )
  const projectId = thread?.projectId ?? null
  const [project] = useQuery(
    queries.projects.byId({
      projectId: projectId ?? PLACEHOLDER_PROJECT_ID,
    }),
  )

  if (!projectId || !project) {
    return null
  }

  return (
    <Button
      asChild
      variant="ghost"
      // `pointer-events-auto` re-enables clicks inside the parent header
      // row, which sets `pointer-events-none` so the rest of the
      // sticky-overlay chrome lets pointer events pass through to the
      // thread underneath.
      className="pointer-events-auto max-w-[16rem] text-foreground-secondary hover:text-foreground-strong"
    >
      <Link
        to="/chat/projects/$projectId"
        params={{ projectId }}
        preload="intent"
      >
        <Folder aria-hidden />
        <span className="min-w-0 truncate">{project.name}</span>
      </Link>
    </Button>
  )
}
