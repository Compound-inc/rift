import { Briefcase, ClipboardList, Receipt, Users } from 'lucide-react'
import { useMemo } from 'react'
import { isAreaPath } from '@/utils/nav-utils'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'
import { SidebarAreaLayout } from '@/components/layout/sidebar/sidebar-area-layout'
import type {
  NavItemType,
  NavSection,
} from '@/components/layout/sidebar/app-sidebar-nav.config'

export const HR_HREF = '/hr'
export const HR_AREA_KEY = 'hr' as const

export const isHrPath = (pathname: string) => isAreaPath(pathname, HR_HREF)

/**
 * Sidebar content component for the HR area.
 *
 * Sub-nav items use `can(...)` so they disappear whenever either the
 * platform entitlement or the org-admin capability denies access. The
 * nav must never advertise links to pages the route layout will
 * immediately redirect away from.
 */
function HrAreaContent({ pathname }: { pathname: string }) {
  const { can } = usePermissions()
  const recruitmentEnabled = can('product.hr.recruitment')
  const payrollEnabled = can('product.hr.payroll')

  const sections = useMemo<NavSection[]>(() => {
    const items: NavItemType[] = [
      {
        name: 'HR Home',
        icon: Briefcase,
        href: HR_HREF,
        exact: true,
      },
    ]

    if (recruitmentEnabled) {
      items.push({
        name: 'Recruitment',
        icon: ClipboardList,
        href: `${HR_HREF}/recruitment`,
      })
    }

    if (payrollEnabled) {
      items.push({
        name: 'Payroll',
        icon: Receipt,
        href: `${HR_HREF}/payroll`,
      })
    }

    return [{ name: '', items }]
  }, [payrollEnabled, recruitmentEnabled])

  return (
    <SidebarAreaLayout title="HR" sections={sections} pathname={pathname} />
  )
}

export const hrNavArea = () => ({
  title: 'HR',
  href: HR_HREF,
  description:
    'Human resources workspace with paid addons for recruitment and payroll.',
  icon: Users,
  ContentComponent: HrAreaContent,
})
