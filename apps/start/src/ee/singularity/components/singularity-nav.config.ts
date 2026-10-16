import { Shield } from 'lucide-react'
import { isAreaPath } from '@/utils/nav-utils'
import { SingularitySidebar } from './singularity-sidebar'

export const SINGULARITY_HREF = '/singularity'
export const SINGULARITY_AREA_KEY = 'singularity' as const

export const isSingularityPath = (pathname: string) =>
  isAreaPath(pathname, SINGULARITY_HREF)

export const singularityNavArea = () => ({
  title: 'Singularity',
  href: SINGULARITY_HREF,
  description: 'Manage workspaces, people, billing, and usage',
  icon: Shield,
  ContentComponent: SingularitySidebar,
})
