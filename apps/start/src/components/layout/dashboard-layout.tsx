import type { ReactNode } from 'react'

import { MainNav } from '@/components/layout/main-nav'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { RightSidebarProvider } from '@/components/layout/right-sidebar-context'
import { ActiveOrganizationProvider } from '@/lib/auth/active-organization'

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="scrollbar-app min-h-screen w-full bg-surface-base">
        <ActiveOrganizationProvider>
          <RightSidebarProvider>
            <MainNav sidebar={AppSidebar}>{children}</MainNav>
          </RightSidebarProvider>
        </ActiveOrganizationProvider>
      </div>
      <div className="fixed bottom-0 ltr:right-0 rtl:left-0 z-40 m-5">
        <div className="flex items-center gap-3" />
      </div>
    </>
  )
}
