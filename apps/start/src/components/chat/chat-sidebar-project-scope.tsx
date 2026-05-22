/**
 * Sidebar variant rendered when the user is working inside a Project.
 *
 * The regular chat sidebar (`ChatSidebarContent`) shows global "New chat /
 * Search" actions, the user's project list, and the full thread history.
 * When the URL enters a project (`/chat/projects/<id>/...`) the sidebar
 * morphs into this variant: a "Back" row at the top, the project's identity,
 * the project sub-pages (Sources, Parameters), and a project-scoped thread
 * list. The user is effectively "inside" the project until they back out.
 */
'use client'

import { useCallback, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import type { QueryResultType } from '@rocicorp/zero'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@rift/ui/context-menu'
import { directionClass, useDirection } from '@rift/ui/direction'
import { cn } from '@rift/utils'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Link2 from 'lucide-react/dist/esm/icons/link-2'
import Settings from 'lucide-react/dist/esm/icons/settings'

import { queries } from '@/integrations/zero'
import { CACHE_CHAT_NAV } from '@/integrations/zero/query-cache-policy'
import { SidebarNavItem } from '@/components/layout/sidebar/sidebar-nav-item'
import type { NavItemType } from '@/components/layout/sidebar/app-sidebar-nav.config'
import { m } from '@/paraglide/messages.js'

import { syncThreadGenerationStatuses } from './thread-status-store'
import {
  ThreadRowContextMenuItems,
  getThreadRowTrailingElement,
  useThreadRowActions,
} from './thread-row-shared'

const PROJECT_THREADS_PAGE_SIZE = 50

/**
 * Active-thread id derived from the chat-area pathname. Project routes are
 * not threads, so the only path shape with an active thread is
 * `/chat/<threadId>`.
 */
function getActiveThreadIdFromPathname(pathname: string): string | null {
  if (!pathname.startsWith('/chat/')) return null
  const trailing = pathname.slice('/chat/'.length).split('/')[0] ?? ''
  if (!trailing || trailing === 'projects') return null
  return trailing
}

/**
 * Project-scoped sidebar. Mirrors the structure of the regular chat sidebar
 * (title, static actions, thread list) but with project chrome instead of
 * the global one.
 */
export function ChatProjectScopedSidebarContent({
  projectId,
  pathname,
}: {
  projectId: string
  pathname: string
}) {
  const direction = useDirection()
  const [project] = useQuery(queries.projects.byId({ projectId }))
  const [threads] = useQuery(
    queries.projects.threadsPage({
      projectId,
      limit: PROJECT_THREADS_PAGE_SIZE,
      start: null,
      dir: 'forward',
      inclusive: true,
    }),
  )

  useEffect(() => {
    syncThreadGenerationStatuses(
      threads.map((thread) => ({
        threadId: thread.threadId,
        generationStatus: thread.generationStatus,
      })),
    )
  }, [threads])

  const projectName = project?.name ?? m.chat_project_loading()

  const sourcesItem: NavItemType = {
    name: m.chat_project_tab_sources(),
    icon: FileText,
    href: `/chat/projects/${projectId}/sources`,
    exact: true,
  }
  const parametersItem: NavItemType = {
    name: m.chat_project_tab_parameters(),
    icon: Settings,
    href: `/chat/projects/${projectId}/settings`,
    exact: true,
  }
  const newChatItem: NavItemType = {
    name: m.chat_project_new_chat(),
    icon: Link2,
    href: `/chat/projects/${projectId}`,
    exact: true,
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatProjectScopedSidebarHeader
        projectName={projectName}
        loading={!project}
      />

      <div
        className={cn(
          'flex flex-col gap-0.5',
          directionClass(direction, { ltr: 'pr-3', rtl: 'pl-3' }),
        )}
      >
        <SidebarNavItem item={newChatItem} pathname={pathname} />
        <SidebarNavItem item={sourcesItem} pathname={pathname} />
        <SidebarNavItem item={parametersItem} pathname={pathname} />
      </div>

      <div
        className={cn(
          'mt-6 mb-2 shrink-0 pl-3 pr-3 text-sm text-foreground-secondary',
          directionClass(direction, { ltr: 'pr-3', rtl: 'pl-3' }),
        )}
      >
        {m.chat_project_tab_chats()}
      </div>
      <ChatProjectThreadsList
        projectId={projectId}
        pathname={pathname}
        threads={threads}
      />
    </div>
  )
}

/**
 * Top of the project sidebar: a calm "Back" row that drops the user back to
 * `/chat`, plus the project identity. Kept in a single block so the chrome
 * reads as one unit rather than two unrelated rows.
 */
function ChatProjectScopedSidebarHeader({
  projectName,
  loading,
}: {
  projectName: string
  loading: boolean
}) {
  const direction = useDirection()

  return (
    <div className="mb-2 flex shrink-0 flex-col">
      <Button
        asChild
        variant="sidebarNavItem"
        size="sidebarNavItem"
        className="text-foreground-tertiary hover:text-foreground-primary"
      >
        <Link
          to="/chat"
          preload="intent"
          aria-label={m.chat_sidebar_project_back_aria()}
          className="group"
        >
          <span className="flex w-full items-center gap-2">
            <ArrowLeft
              className={cn(
                'size-4 shrink-0',
                directionClass(direction, {
                  ltr: '',
                  rtl: 'scale-x-[-1]',
                }),
              )}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">
              {m.chat_sidebar_project_back()}
            </span>
          </span>
        </Link>
      </Button>
      <div className="mt-1 flex items-center gap-3 px-3 py-2">
        <span
          className={cn(
            'min-w-0 truncate text-lg font-semibold leading-6 text-foreground-strong',
            loading ? 'opacity-60' : '',
          )}
        >
          {projectName}
        </span>
      </div>
    </div>
  )
}

type ProjectThreadRow = QueryResultType<
  ReturnType<(typeof queries.projects)['threadsPage']>
>[number]

/**
 * Project-scoped thread list. Same row affordances as the global history
 * (rename, copy link, pin, move, delete) but scoped to a single project. We
 * don't virtualize: a project rarely accrues enough threads to need it, and
 * a flat list reads more calmly inside the sidebar.
 */
function ChatProjectThreadsList({
  projectId,
  pathname,
  threads,
}: {
  projectId: string
  pathname: string
  threads: readonly ProjectThreadRow[]
}) {
  const direction = useDirection()

  if (threads.length === 0) {
    return (
      <div
        className={cn(
          'px-3 pb-3 text-sm text-foreground-tertiary',
          directionClass(direction, { ltr: 'pr-3', rtl: 'pl-3' }),
        )}
      >
        {m.chat_sidebar_project_chats_empty()}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            'flex flex-col gap-0.5',
            directionClass(direction, { ltr: 'pr-3', rtl: 'pl-3' }),
          )}
        >
          {threads.map((thread) => (
            <ChatProjectThreadRow
              key={thread.threadId}
              thread={thread}
              projectId={projectId}
              pathname={pathname}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ChatProjectThreadRow({
  thread,
  projectId,
  pathname,
}: {
  thread: ProjectThreadRow
  projectId: string
  pathname: string
}) {
  const z = useZero()
  const activeThreadId = getActiveThreadIdFromPathname(pathname)

  // Shared row actions; the project-scoped sidebar redirects post-delete
  // to the project landing page rather than the global chat root.
  const rowActions = useThreadRowActions({
    redirectTargetOnDelete: `/chat/projects/${projectId}`,
    activeThreadId,
  })

  const preloadThreadMessages = useCallback(
    (threadId: string) => {
      z.preload(queries.messages.byThread({ threadId }), CACHE_CHAT_NAV)
    },
    [z],
  )

  const title = thread.title || m.chat_sidebar_thread_untitled()
  const item: NavItemType = {
    name: title,
    href: `/chat/${thread.threadId}`,
    trailing: getThreadRowTrailingElement(thread),
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block w-full">
        <div
          onPointerEnter={() => preloadThreadMessages(thread.threadId)}
          onFocus={() => preloadThreadMessages(thread.threadId)}
        >
          <SidebarNavItem item={item} pathname={pathname} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ThreadRowContextMenuItems
          thread={thread}
          currentProjectId={projectId}
          actions={rowActions}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}
