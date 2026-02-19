import type { ReactNode } from 'react'

import { MainNav } from '@/components/layout/main-nav'
import { AppSidebar } from '@/components/layout/app-sidebar'

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="min-h-screen w-full bg-bg-default">
        <MainNav sidebar={AppSidebar}>{children}</MainNav>
      </div>
      <div className="fixed bottom-0 right-0 z-40 m-5">
        <div className="flex items-center gap-3" />
      </div>
    </>
  )
}
