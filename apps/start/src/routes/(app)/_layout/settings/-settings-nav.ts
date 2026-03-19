import { isAreaPath } from '@/utils/nav-utils'
import { Lock, Settings, User } from 'lucide-react'
import { m } from '@/paraglide/messages.js'

export const SETTINGS_HREF = '/settings'
export const SETTINGS_AREA_KEY = 'settings' as const

export const isSettingsPath = (pathname: string) =>
  isAreaPath(pathname, SETTINGS_HREF)

export const settingsNavArea = () => ({
  title: m.settings_nav_title(),
  href: SETTINGS_HREF,
  description: m.settings_nav_description(),
  icon: Settings,
  content: [
    {
      items: [
        {
          name: m.settings_account_page_title(),
          icon: User,
          href: SETTINGS_HREF,
          exact: true,
        },
        {
          name: m.settings_security_page_title(),
          icon: Lock,
          href: `${SETTINGS_HREF}/security`,
        },
      ],
    },
  ],
})
