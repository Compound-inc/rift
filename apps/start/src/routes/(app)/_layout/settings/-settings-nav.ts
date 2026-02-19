import { isAreaPath } from '@/utils/nav-utils'
import { Bug, Settings, User } from 'lucide-react'

export const SETTINGS_HREF = '/settings'
export const SETTINGS_AREA_KEY = 'settings' as const

export const isSettingsPath = (pathname: string) =>
  isAreaPath(pathname, SETTINGS_HREF)

export const settingsNavArea = () => ({
  title: 'Settings',
  href: SETTINGS_HREF,
  description: 'Manage your account and preferences.',
  icon: Settings,
  content: [
    {
      items: [
        { name: 'Account', icon: User, href: SETTINGS_HREF, exact: true },
        { name: 'Debug Auth', icon: Bug, href: `${SETTINGS_HREF}/debug-auth` },
      ],
    },
  ],
})
