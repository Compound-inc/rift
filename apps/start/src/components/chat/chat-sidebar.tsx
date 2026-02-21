'use client'

import { useQuery } from '@rocicorp/zero/react'
import { Compass, Globe, Link2, MessageSquare } from 'lucide-react'
import { isAreaPath } from '@/utils/nav-utils'
import { SidebarAreaLayout } from '@/components/layout/sidebar/sidebar-area-layout'
import type { NavItemType, NavSection } from '@/components/layout/sidebar/app-sidebar-nav.config'
import { queries } from '@/integrations/zero'

// --- Single source of truth: constants and static content ---

export const CHAT_HREF = '/chat'
export const CHAT_AREA_KEY = 'default' as const

export const isChatPath = (pathname: string) =>
  isAreaPath(pathname, ['/', CHAT_HREF])

const CHAT_SIDEBAR_TITLE = 'AI Chat'
const CHAT_HISTORY_SECTION_NAME = 'Chat History'

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
  const [threads] = useQuery(queries.threads.byUser())
  const threadItems: NavItemType[] = (threads ?? []).map((thread) => ({
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
    content: staticSections,
    ContentComponent: ChatSidebarContent,
  }
}
