// Project page (threads home). Shows the project name, link to settings,
// list of threads in this project, and a "new chat in project" button.
'use client'

import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useZero } from '@rocicorp/zero/react'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Settings from 'lucide-react/dist/esm/icons/settings'
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle'
import { Button } from '@rift/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@rift/ui/context-menu'
import { mutators, queries } from '@/integrations/zero'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useChatComposer } from '../chat-context'
import { ThreadMoveToProjectSubmenu } from '../chat-sidebar-move-to-project'
import { m } from '@/paraglide/messages.js'

export function ProjectThreadsPage({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const z = useZero()
  const composer = useChatComposer()
  const [project, projectResult] = useQuery(
    queries.projects.byId({ projectId }),
  )
  const [threadsRows] = useQuery(
    queries.projects.threadsPage({
      projectId,
      limit: 50,
      start: null,
      dir: 'forward',
      inclusive: true,
    }),
  )
  const [creatingThread, setCreatingThread] = useState(false)

  // Redirect home if the project no longer exists or has been soft-deleted in
  // another tab. The query is reactive so this also fires post-mount.
  useEffect(() => {
    if (projectResult.type === 'complete' && !project) {
      void navigate({ to: '/chat' })
    }
  }, [navigate, project, projectResult.type])

  const handleNewChat = useCallback(async () => {
    if (!project || creatingThread) return
    setCreatingThread(true)
    const newThreadId = crypto.randomUUID()
    const createdAt = Date.now()
    try {
      await z.mutate(
        mutators.threads.create({
          threadId: newThreadId,
          createdAt,
          modelId: composer.selectedModelId,
          modeId: composer.selectedModeId,
          contextWindowMode: composer.selectedContextWindowMode,
          disabledToolKeys: [...composer.disabledToolKeys],
          projectId,
          bootstrapStatus: 'completed',
        }),
      ).client
      navigate({ to: '/chat/$threadId', params: { threadId: newThreadId } })
    } catch (error) {
      console.error('Failed to create project thread:', error)
      toast.error(m.chat_project_new_chat_failed())
      setCreatingThread(false)
    }
  }, [composer, creatingThread, navigate, project, projectId, z])

  if (!project) {
    return (
      <div className="flex min-h-full items-center justify-center text-foreground-secondary">
        {m.chat_project_loading()}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground-strong">
            {project.name}
          </h1>
          {project.description ? (
            <p className="text-sm text-foreground-secondary">
              {project.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link
              to="/chat/projects/$projectId/settings"
              params={{ projectId }}
              preload="intent"
            >
              <Settings className="size-4" aria-hidden />
              {m.chat_project_settings_link()}
            </Link>
          </Button>
          <Button
            onClick={() => void handleNewChat()}
            disabled={creatingThread}
          >
            <Plus className="size-4" aria-hidden />
            {m.chat_project_new_chat()}
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground-secondary">
          {m.chat_project_threads_section()}
        </h2>
        {threadsRows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-foreground-secondary">
            {m.chat_project_threads_empty()}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {threadsRows.map((thread) => (
              <li key={thread.threadId}>
                <ContextMenu>
                  <ContextMenuTrigger>
                    <Link
                      to="/chat/$threadId"
                      params={{ threadId: thread.threadId }}
                      preload="intent"
                      className="flex items-center gap-2 rounded-md p-2 hover:bg-surface-inverse/5"
                    >
                      <MessageCircle
                        className="size-4 text-foreground-secondary"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {thread.title || m.chat_sidebar_thread_untitled()}
                      </span>
                    </Link>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ThreadMoveToProjectSubmenu
                      threadId={thread.threadId}
                      currentProjectId={projectId}
                    />
                  </ContextMenuContent>
                </ContextMenu>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
