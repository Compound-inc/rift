import { isAreaPath } from '@/utils/nav-utils'
import {
  Building2,
  Cpu,
  Database,
  CreditCard,
  Key,
  Lock,
  Scale,
  Settings,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react'

/** Root path for organization-scoped settings area. */
export const ORG_SETTINGS_HREF = '/organization/settings'
export const ORG_SETTINGS_AREA_KEY = 'organization-settings' as const

/** Path matcher used by sidebar to mark organization settings area as active. */
export const isOrgSettingsPath = (pathname: string) =>
  isAreaPath(pathname, ORG_SETTINGS_HREF)

/** Sidebar configuration for organization-level settings pages. */
export const orgSettingsNavArea = () => ({
  title: 'Organization',
  href: ORG_SETTINGS_HREF,
  description: 'Manage organization-wide controls and preferences.',
  icon: Building2,
  content: [
    {
      name: '',
      items: [
        {
          name: 'General',
          icon: Settings,
          href: `${ORG_SETTINGS_HREF}`,
          exact: true,
        },
        // {
        //   name: 'Integrations',
        //   icon: Layout,
        //   href: `${ORG_SETTINGS_HREF}/integrations`,
        //   exact: true,
        // },
        {
          name: 'Analytics & Insights',
          icon: TrendingUp,
          href: `${ORG_SETTINGS_HREF}/analytics`,
          exact: true,
        },
        {
          name: 'Billing',
          icon: CreditCard,
          href: `${ORG_SETTINGS_HREF}/billing`,
          exact: true,
        },
      ],
    },
    {
      name: 'Organization',
      items: [
        {
          name: 'Members',
          icon: Users,
          href: `${ORG_SETTINGS_HREF}/members`,
          exact: true,
        },
        // {
        //   name: 'Groups',
        //   icon: Layout,
        //   href: `${ORG_SETTINGS_HREF}/groups`,
        //   exact: true,
        // },
      ],
    },
    {
      name: 'AI & Data',
      items: [
        {
          name: 'Compliance & Policy',
          icon: Scale,
          href: `${ORG_SETTINGS_HREF}/compliance-policy`,
          exact: true,
        },
        {
          name: 'Models',
          icon: Cpu,
          href: `${ORG_SETTINGS_HREF}/models`,
          exact: true,
        },
        {
          name: 'Tools',
          icon: Wrench,
          href: `${ORG_SETTINGS_HREF}/tools`,
          exact: true,
        },
        {
          name: 'Knowledge',
          icon: Database,
          href: `${ORG_SETTINGS_HREF}/knowledge`,
          exact: true,
        },
        {
          name: 'BYOK',
          icon: Key,
          href: `${ORG_SETTINGS_HREF}/byok`,
          exact: true,
        },
      ],
    },
    {
      name: 'Security & Access',
      items: [
        {
          name: 'Security',
          icon: Lock,
          href: `${ORG_SETTINGS_HREF}/security`,
          exact: true,
        },
        // {
        //   name: 'API Keys',
        //   icon: Key,
        //   href: `${ORG_SETTINGS_HREF}/api-keys`,
        //   exact: true,
        // },
      ],
    },
  ],
})
