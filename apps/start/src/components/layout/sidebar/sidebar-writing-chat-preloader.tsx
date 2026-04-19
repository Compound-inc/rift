'use client'

import { useEffect } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { WRITING_SIDEBAR_PAGE_SIZE } from '@/components/writing/writing-sidebar'
import { queries } from '@/integrations/zero'
import { CACHE_WRITING_NAV } from '@/integrations/zero/query-cache-policy'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

/**
 * Keeps the writing sidebar projects query desired while users browse other areas so the
 * writing sidebar can restore instantly from Zero without refetch churn.
 */
export function SidebarWritingChatPreloader() {
  const z = useZero()
  const { loading, user } = useAppAuth()

  useEffect(() => {
    if (loading || user == null) {
      return
    }

    const { cleanup } = z.preload(
      queries.writing.sidebarProjects({
        limit: WRITING_SIDEBAR_PAGE_SIZE,
      }),
      CACHE_WRITING_NAV,
    )

    return cleanup
  }, [loading, user?.id, z])

  return null
}
