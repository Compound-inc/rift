// Project page (threads home). Shows the project name, a link into settings,
// and the threads inside this project. The "new chat in this project" flow is
// implemented in Phase 5 (thread integration) and is intentionally absent
// from this page until then.
'use client'

import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'
import Settings from 'lucide-react/dist/esm/icons/settings'
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle'
import { Button } from '@rift/ui/button'
import { queries } from '@/integrations/zero'
import { useEffect } from 'react'
import { m } from '@/paraglide/messages.js'

export function ProjectThreadsPage({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const [project, projectResult] = useQuery(queries.projects.byId({ projectId }))
  const [threadsRows] = useQuery(
    queries.projects.threadsPage({
      projectId,
      limit: 50,
      start: null,
      dir: 'forward',
      inclusive: true,
    }),
  )

  /**
   * Redirect to the chat home if the Project does not exist or has been
   * soft-deleted. The query result is reactive so this also fires after the
   * owner deletes their own Project from another tab.
   */
  useEffect(() => {
    if (projectResult.type === 'complete' && !project) {
      void navigate({ to: '/chat' })
    }
  }, [navigate, project, projectResult.type])

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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
