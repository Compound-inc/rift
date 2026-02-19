import { isAreaPath } from '@/utils/nav-utils'
import { DollarSign, FileText, LayoutDashboard, MessageSquare } from 'lucide-react'

export const WRITER_HREF = '/writer'
export const WRITER_AREA_KEY = 'writer' as const

export const isWriterPath = (pathname: string) => isAreaPath(pathname, WRITER_HREF)

export const writerNavArea = () => ({
  title: 'Writer',
  href: WRITER_HREF,
  description: 'Write text for your projects with AI.',
  icon: FileText,
  content: [
    {
      items: [
        {
          name: 'New Project',
          icon: LayoutDashboard,
          href: `${WRITER_HREF}/new-project`,
          exact: true,
        },
        {
          name: 'Projects',
          icon: DollarSign,
          href: `${WRITER_HREF}/projects`,
        },
        {
          name: 'Chat History',
          icon: MessageSquare,
          href: `${WRITER_HREF}/chat-history`,
        },
      ],
    },
  ],
})
