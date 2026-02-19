import { isAreaPath } from '@/utils/nav-utils'
import { Compass, Globe, Link2, MessageSquare } from 'lucide-react'

export const CHAT_HREF = '/chat'
export const CHAT_AREA_KEY = 'default' as const

export const isChatPath = (pathname: string) =>
  isAreaPath(pathname, ['/', CHAT_HREF])

export const chatNavArea = () => ({
  title: 'AI Chat',
  href: CHAT_HREF,
  description:
    'Chat with your data and get answers to your questions with AI.',
  icon: Compass,
  content: [
    {
      items: [
        { name: 'New Chat', icon: Link2, href: `${CHAT_HREF}/new-chat` },
        { name: 'Projects', icon: Globe, href: `${CHAT_HREF}/projects` },
      ],
    },
    {
      name: 'Chat History',
      items: [
        { name: 'Chat 1', icon: MessageSquare, href: `${CHAT_HREF}/1` },
        { name: 'Chat 2', icon: MessageSquare, href: `${CHAT_HREF}/2` },
        { name: 'Chat 3', icon: MessageSquare, href: `${CHAT_HREF}/3` },
      ],
    },
  ],
})
