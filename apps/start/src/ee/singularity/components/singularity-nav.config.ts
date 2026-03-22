import { Shield } from 'lucide-react'
import { isAreaPath } from '@/utils/nav-utils'

export const SINGULARITY_HREF = '/singularity'
export const SINGULARITY_AREA_KEY = 'singularity' as const

export const isSingularityPath = (pathname: string) =>
  isAreaPath(pathname, SINGULARITY_HREF)

export const singularityNavArea = () => ({
  title: 'Singularity',
  href: SINGULARITY_HREF,
  description: 'Enterprise admin control plane',
  icon: Shield,
  content: [
    {
      name: '',
      items: [
        {
          name: 'Organizations',
          icon: Shield,
          href: SINGULARITY_HREF,
          exact: true,
        },
      ],
    },
  ],
})
