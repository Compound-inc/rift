// Chat navigation sidebar with static links + dynamic thread history.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Compass, Globe, Link2, MessageSquare } from 'lucide-react'
import { isAreaPath } from '@/utils/nav-utils'
import { SidebarAreaLayout } from '@/components/layout/sidebar/sidebar-area-layout'
import type {
  NavItemType,
  NavSection,
} from '@/components/layout/sidebar/app-sidebar-nav.config'
import { queries } from '@/integrations/zero'
import { CACHE_CHAT_NAV } from '@/integrations/zero/query-cache-policy'

// --- Single source of truth: constants and static content ---

export const CHAT_HREF = '/chat'
export const CHAT_AREA_KEY = 'default' as const

export const isChatPath = (pathname: string) =>
  isAreaPath(pathname, ['/', CHAT_HREF])

const CHAT_SIDEBAR_TITLE = 'AI Chat'
const CHAT_HISTORY_SECTION_NAME = 'Chat History'
const OPTIMISTIC_THREAD_CREATED_EVENT = 'chat:thread-created'
const MAX_PRELOADED_THREADS = 100

type OptimisticThread = {
  readonly threadId: string
  readonly title: string
  readonly createdAt: number
}

/** Static sections only. Dynamic "Chat History" is appended by ChatSidebarContent. */
const staticSections: NavSection[] = [
  {
    items: [
      { name: 'New Chat', href: `${CHAT_HREF}/new-chat`, icon: Link2 },
      { name: 'Projects', href: `${CHAT_HREF}/projects`, icon: Globe },
    ],
  },
]

/** Static nav config for the chat area (title, href, icon, description, static sections). */
export function chatNavStaticConfig() {
  return {
    title: CHAT_SIDEBAR_TITLE,
    href: CHAT_HREF,
    description:
      'Chat with your data and get answers to your questions with AI.',
    icon: Compass,
    content: staticSections,
  }
}

// --- Dynamic content component (uses static config + Zero threads) ---

export function ChatSidebarContent({ pathname }: { pathname: string }) {
  const z = useZero()
  const [threads] = useQuery(queries.threads.byUser(), CACHE_CHAT_NAV)
  const [optimisticThreads, setOptimisticThreads] = useState<
    readonly OptimisticThread[]
  >([])
  const preloadedThreadIdsRef = useRef(new Set<string>())

  useEffect(() => {
    for (const thread of threads.slice(0, MAX_PRELOADED_THREADS)) {
      if (preloadedThreadIdsRef.current.has(thread.threadId)) continue
      z.preload(
        queries.messages.byThread({ threadId: thread.threadId }),
        CACHE_CHAT_NAV,
      )
      preloadedThreadIdsRef.current.add(thread.threadId)
    }
  }, [threads, z])

  useEffect(() => {
    const onOptimisticThread = (event: Event) => {
      const custom = event as CustomEvent<OptimisticThread>
      const payload = custom.detail
      if (
        typeof payload.threadId !== 'string' ||
        typeof payload.title !== 'string' ||
        typeof payload.createdAt !== 'number'
      ) {
        return
      }

      setOptimisticThreads((previous) => {
        if (previous.some((thread) => thread.threadId === payload.threadId)) {
          return previous
        }
        return [payload, ...previous].sort((a, b) => b.createdAt - a.createdAt)
      })
    }

    window.addEventListener(OPTIMISTIC_THREAD_CREATED_EVENT, onOptimisticThread)
    return () =>
      window.removeEventListener(
        OPTIMISTIC_THREAD_CREATED_EVENT,
        onOptimisticThread,
      )
  }, [])

  const mergedThreads = useMemo(() => {
    const persisted = new Set(threads.map((thread) => thread.threadId))
    const pending = optimisticThreads
      .filter((thread) => !persisted.has(thread.threadId))
      .map((thread) => ({
        threadId: thread.threadId,
        title: thread.title,
      }))

    return [
      ...pending,
      ...threads.map((thread) => ({
        threadId: thread.threadId,
        title: thread.title || 'Untitled',
      })),
    ]
  }, [threads, optimisticThreads])

  const threadItems: NavItemType[] = mergedThreads.map((thread) => ({
    name: thread.title || 'Untitled',
    href: `${CHAT_HREF}/${thread.threadId}`,
    icon: MessageSquare,
  }))

  const historySection: NavSection = {
    name: CHAT_HISTORY_SECTION_NAME,
    items:
      threadItems.length > 0
        ? threadItems
        : [{ name: 'No chats yet', href: CHAT_HREF, icon: MessageSquare }],
  }

  const sections = [...staticSections, historySection]

  return (
    <SidebarAreaLayout
      title={CHAT_SIDEBAR_TITLE}
      sections={sections}
      pathname={pathname}
    />
  )
}

export function chatNavArea() {
  return {
    ...chatNavStaticConfig(),
    ContentComponent: ChatSidebarContent,
  }
}
