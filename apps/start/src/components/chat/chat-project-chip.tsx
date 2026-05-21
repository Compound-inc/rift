// Project chip rendered in the chat header. Shows the Project the active
// thread belongs to and links back to the Project's home page.
'use client'

import { Link } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'
import Folder from 'lucide-react/dist/esm/icons/folder'
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
    <Link
      to="/chat/projects/$projectId"
      params={{ projectId }}
      preload="intent"
      className="pointer-events-auto inline-flex max-w-[16rem] items-center gap-1.5 rounded-md border border-border bg-surface-overlay px-2 py-1 text-xs text-foreground-secondary hover:text-foreground-strong"
    >
      <Folder className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{project.name}</span>
    </Link>
  )
}
