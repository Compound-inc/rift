import { isAreaPath } from '@/utils/nav-utils'
import { m } from '@/paraglide/messages.js'
import {
  Briefcase,
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

export const ORG_SETTINGS_HR_NAV_HREF = `${ORG_SETTINGS_HREF}/hr`

export type OrgSettingsNavFlags = {
  readonly hrEnabled: boolean
}

export const orgSettingsNavArea = (flags?: OrgSettingsNavFlags) => ({
  title: m.layout_organization_tooltip_name(),
  href: ORG_SETTINGS_HREF,
  description: m.org_settings_nav_description(),
  icon: Building2,
  content: [
    {
      name: '',
      items: [
        {
          name: m.org_settings_general_page_title(),
          icon: Settings,
          href: `${ORG_SETTINGS_HREF}`,
          exact: true,
        },
        {
          name: m.org_analytics_page_title(),
          icon: TrendingUp,
          href: `${ORG_SETTINGS_HREF}/analytics`,
          exact: true,
        },
        {
          name: m.org_billing_page_title(),
          icon: CreditCard,
          href: `${ORG_SETTINGS_HREF}/billing`,
          exact: true,
        },
      ],
    },
    {
      name: m.layout_organization_tooltip_name(),
      items: [
        {
          name: m.org_members_page_title(),
          icon: Users,
          href: `${ORG_SETTINGS_HREF}/members`,
          exact: true,
        },
      ],
    },
    {
      name: m.org_settings_nav_section_ai_data(),
      items: [
        {
          name: m.org_compliance_page_title(),
          icon: Scale,
          href: `${ORG_SETTINGS_HREF}/compliance-policy`,
          exact: true,
        },
        {
          name: m.org_models_page_title(),
          icon: Cpu,
          href: `${ORG_SETTINGS_HREF}/models`,
          exact: true,
        },
        {
          name: m.org_tools_page_title(),
          icon: Wrench,
          href: `${ORG_SETTINGS_HREF}/tools`,
          exact: true,
        },
        {
          name: m.org_knowledge_page_title(),
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
    ...(flags?.hrEnabled
      ? [
          {
            name: 'HR',
            items: [
              {
                name: 'HR',
                icon: Briefcase,
                href: ORG_SETTINGS_HR_NAV_HREF,
                exact: true,
              },
            ],
          },
        ]
      : []),
    {
      name: m.org_settings_nav_section_security_access(),
      items: [
        {
          name: m.org_security_page_title(),
          icon: Lock,
          href: `${ORG_SETTINGS_HREF}/security`,
          exact: true,
        },
      ],
    },
  ],
})
