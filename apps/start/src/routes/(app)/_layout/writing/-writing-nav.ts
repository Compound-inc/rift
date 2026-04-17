import { Feather } from 'lucide-react'
import { isAreaPath } from '@/utils/nav-utils'

export const WRITING_HREF = '/writing'
export const WRITING_AREA_KEY = 'writing' as const

export const isWritingPath = (pathname: string) =>
  isAreaPath(pathname, WRITING_HREF)

export const writingNavArea = () => ({
  title: 'Writing',
  href: WRITING_HREF,
  description: 'Long-form documents with AI collaboration',
  icon: Feather,
  content: [
    {
      name: '',
      items: [
        {
          name: 'Writing Home',
          icon: Feather,
          href: WRITING_HREF,
          exact: true,
        },
      ],
    },
  ],
})
