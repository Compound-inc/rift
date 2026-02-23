import { isAreaPath } from '@/utils/nav-utils'
import { Building2, ShieldCheck } from 'lucide-react'

export const ORG_SETTINGS_HREF = '/org-settings'
export const ORG_SETTINGS_AREA_KEY = 'org-settings' as const

export const isOrgSettingsPath = (pathname: string) =>
  isAreaPath(pathname, ORG_SETTINGS_HREF)

export const orgSettingsNavArea = () => ({
  title: 'Organization',
  href: ORG_SETTINGS_HREF,
  description: 'Manage organization-wide controls and preferences.',
  icon: Building2,
  content: [
    {
      items: [
        {
          name: 'Model Policy',
          icon: ShieldCheck,
          href: `${ORG_SETTINGS_HREF}/model-policy`,
          exact: true,
        },
      ],
    },
  ],
})
