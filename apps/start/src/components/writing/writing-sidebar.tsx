'use client'

import { useCallback, useMemo } from 'react'
import type { QueryResultType } from '@rocicorp/zero'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Feather, Folder } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { SidebarAreaLayout } from '@/components/layout/sidebar/sidebar-area-layout'
import type {
  NavItemType,
  NavSection,
} from '@/components/layout/sidebar/app-sidebar-nav.config'
import { SidebarNavItem } from '@/components/layout/sidebar/sidebar-nav-item'
import { queries } from '@/integrations/zero'
import { CACHE_WRITING_NAV } from '@/integrations/zero/query-cache-policy'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { isAreaPath } from '@/utils/nav-utils'

export const WRITING_HREF = '/writing'
export const WRITING_AREA_KEY = 'writing' as const
export const WRITING_SIDEBAR_PAGE_SIZE = 100

const PROJECT_ROW_CLASS =
  'flex h-7 items-center pl-3 pr-3 text-sm text-foreground-secondary'

type WritingSidebarChatRow = {
  readonly chatId: string
  readonly projectId: string
  readonly title: string
}

type WritingSidebarProjectRow = QueryResultType<
  ReturnType<(typeof queries.writing)['sidebarProjects']>
>[number]

type WritingSidebarProjectGroup = {
  readonly projectId: string
  readonly projectTitle: string
  readonly chats: readonly WritingSidebarChatRow[]
}

export const isWritingPath = (pathname: string) =>
  isAreaPath(pathname, WRITING_HREF)

function getStaticSections(): NavSection[] {
  return [
    {
      items: [
        {
          name: 'Writing Home',
          href: WRITING_HREF,
          icon: Feather,
          exact: true,
        },
      ],
    },
  ]
}

function buildWritingChatNavItem({
  chat,
  activeChatId,
}: {
  chat: WritingSidebarChatRow
  activeChatId: string | null
}): NavItemType {
  const title = chat.title.trim() || 'Untitled chat'

  return {
    name: title,
    href: `${WRITING_HREF}/projects/${chat.projectId}?chatId=${encodeURIComponent(chat.chatId)}`,
    isActive: () => activeChatId === chat.chatId,
  }
}

/**
 * Renders the project-first writing sidebar from the same cached Zero query the
 * app shell keeps warm across navigation.
 */
function WritingSidebarProjects({ pathname }: { pathname: string }) {
  const z = useZero()
  const activeChatId = useRouterState({
    select: (state) => {
      const search = (state.resolvedLocation?.search ??
        state.location.search) as { chatId?: unknown } | undefined
      return typeof search?.chatId === 'string' ? search.chatId : null
    },
  })
  const [rows] = useQuery(
    queries.writing.sidebarProjects({
      limit: WRITING_SIDEBAR_PAGE_SIZE,
    }),
    CACHE_WRITING_NAV,
  )

  const projectGroups = useMemo<readonly WritingSidebarProjectGroup[]>(
    () =>
      (rows ?? []).map((row) => ({
        projectId: row.id,
        projectTitle:
          typeof row.title === 'string' && row.title.trim().length > 0
            ? row.title
            : 'Untitled project',
        chats: mapProjectChats(row),
      })),
    [rows],
  )

  const preloadWritingChat = useCallback(
    (chat: WritingSidebarChatRow) => {
      z.preload(queries.writing.projectById({ projectId: chat.projectId }), CACHE_WRITING_NAV)
      z.preload(
        queries.writing.chatsByProject({ projectId: chat.projectId }),
        CACHE_WRITING_NAV,
      )
      z.preload(queries.writing.messagesByChat({ chatId: chat.chatId }), CACHE_WRITING_NAV)
    },
    [z],
  )

  const buildProjectNavItem = useCallback(
    (project: WritingSidebarProjectGroup): NavItemType => ({
      name: project.projectTitle,
      href: `${WRITING_HREF}/projects/${project.projectId}`,
      icon: Folder,
      isActive: (currentPathname) =>
        currentPathname === `${WRITING_HREF}/projects/${project.projectId}`
        || currentPathname.startsWith(`${WRITING_HREF}/projects/${project.projectId}/`),
    }),
    [],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5">
          {projectGroups.map((project) => (
            <div key={project.projectId} className="flex flex-col gap-0.5">
              <div className={PROJECT_ROW_CLASS}>
                <SidebarNavItem
                  item={buildProjectNavItem(project)}
                  pathname={pathname}
                />
              </div>
              <div className="pr-3">
                {project.chats.map((chat) => {
                  const item = buildWritingChatNavItem({
                    chat,
                    activeChatId,
                  })

                  return (
                    <div
                      key={chat.chatId}
                      className="pl-4"
                      onPointerEnter={() => preloadWritingChat(chat)}
                      onFocus={() => preloadWritingChat(chat)}
                    >
                      <SidebarNavItem item={item} pathname={pathname} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Zero returns nested relationship rows as hierarchical data. Normalizing the
 * related chats here keeps the render loop simple and gives us one place to
 * handle sparse titles consistently.
 */
function mapProjectChats(project: WritingSidebarProjectRow): readonly WritingSidebarChatRow[] {
  return (project.chats ?? []).map((chat) => ({
    chatId: chat.id,
    projectId: project.id,
    title: chat.title,
  }))
}

export function WritingSidebarContent({ pathname }: { pathname: string }) {
  const { loading, user } = useAppAuth()
  const staticSections = useMemo(() => getStaticSections(), [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SidebarAreaLayout
          title="Writing"
          sections={staticSections}
          pathname={pathname}
        />
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          {!loading && user != null ? <WritingSidebarProjects pathname={pathname} /> : null}
        </div>
      </div>
    </div>
  )
}

export function writingNavArea() {
  return {
    title: 'Writing',
    href: WRITING_HREF,
    description: 'Long-form documents with AI collaboration',
    icon: Feather,
    content: getStaticSections(),
    ContentComponent: WritingSidebarContent,
  }
}
