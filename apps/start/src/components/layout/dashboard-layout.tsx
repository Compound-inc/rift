import type { ReactNode } from 'react'

import { MainNav } from '@/components/layout/main-nav'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { PageSidebarVisibilityProvider } from '@/components/layout/page-sidebar-visibility-context'
import { RightSidebarProvider } from '@/components/layout/right-sidebar-context'
import { ChatSearchCommand } from '@/components/chat/chat-search-command'
import { ActiveOrganizationProvider } from '@/lib/frontend/auth/active-organization'

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="scrollbar-app min-h-screen w-full bg-surface-base">
        <ActiveOrganizationProvider>
          <PageSidebarVisibilityProvider>
            <RightSidebarProvider>
              <MainNav sidebar={AppSidebar}>{children}</MainNav>
              <ChatSearchCommand />
            </RightSidebarProvider>
          </PageSidebarVisibilityProvider>
        </ActiveOrganizationProvider>
      </div>
      <div className="fixed bottom-0 ltr:right-0 rtl:left-0 z-40 m-5">
        <div className="flex items-center gap-3" />
      </div>
    </>
  )
}
