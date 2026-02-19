import {
  CursorRays,
  Globe,
  Hyperlink,
  LinesY,
  User,
} from '@/components/layout/sidebar/icons'
import type { ComponentType, SVGProps } from 'react'
import {
  BarChart2,
  Compass,
  DollarSign,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Network,
  Receipt,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react'

export type SidebarNavData = {
  pathname: string
}

export type NavItemType = {
  name: string
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement> & { 'data-hovered'?: boolean }>
  exact?: boolean
  isActive?: (pathname: string, href: string) => boolean
}

export type NavSection = {
  name?: string
  items: NavItemType[]
}

export type SidebarNavAreaConfig = {
  title?: string
  content: NavSection[]
  href: string
  description?: string
  learnMoreHref?: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export type SidebarNavAreas = Record<
  string,
  (data: SidebarNavData) => SidebarNavAreaConfig
>

function linksIsActive(pathname: string, href: string): boolean {
  const basePath = href.split('?')[0]
  if (pathname === basePath) return true
  if (pathname.startsWith(basePath + '/')) {
    const nextSegment = pathname.slice(basePath.length + 1).split('/')[0]
    return nextSegment?.includes('.') ?? false
  }
  return false
}

export const NAV_AREAS: SidebarNavAreas = {
  default: () => ({
    title: 'AI Chat',
    href: '/chat',
    description:
      'Chat with your data and get answers to your questions with AI.',
    // learnMoreHref: '',
    icon: Compass,
    content: [
      {
        items: [
          {
            name: 'New Chat',
            icon: Hyperlink,
            href: '/chat/new-chat',
            isActive: linksIsActive,
          },
          {
            name: 'Projects',
            icon: Globe,
            href: '/chat/projects',
          },
        ],
      },
      {
        name: 'Chat History',
        items: [
          {
            name: 'Chat 1',
            icon: LinesY,
            href: '/chat/1',
          },
          {
            name: 'Chat 2',
            icon: LinesY,
            href: '/chat/2',
          },
          {
            name: 'Chat 3',
            icon: LinesY,
            href: '/chat/3',
          },
        ],
      },
    ],
  }),

  writer: () => ({
    title: 'Writer',
    href: '/writer',
    description:
      'Write text for your projects with AI.',
    // learnMoreHref: '',
    icon: FileText,
    content: [
      {
        items: [
          {
            name: 'New Project',
            icon: LayoutDashboard,
            href: '/writer/new-project',
            exact: true,
          },
          {
            name: 'Projects',
            icon: DollarSign,
            href: '/writer/projects',
          },
          {
            name: 'Chat History',
            icon: MessageSquare,
            href: '/writer/chat-history',
          },
        ],
      },
    ],
  }),
}

/**
 * Resolve current area from pathname.
 */
export function getCurrentArea(pathname: string): string | null {
  if (pathname.startsWith('/writer')) return 'writer'
  if (pathname === '/' || pathname.startsWith('/chat') || pathname.startsWith('/links')) return 'default'
  if (pathname.startsWith('/analytics') || pathname.startsWith('/events') || pathname.startsWith('/customers')) {
    return 'default'
  }
  return null
}
