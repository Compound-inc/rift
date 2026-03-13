'use client'

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { createContext, useContext, useMemo, useState } from 'react'

type PageSidebarVisibilityContextValue = {
  /**
   * Tracks whether the route-level sidebar panel (the wider area next to the icon rail)
   * is collapsed for chat pages.
   */
  isChatPageSidebarCollapsed: boolean
  setIsChatPageSidebarCollapsed: Dispatch<SetStateAction<boolean>>
}

const PageSidebarVisibilityContext =
  createContext<PageSidebarVisibilityContextValue | null>(null)

/**
 * Provides shared visibility state for the per-page sidebar panel so controls
 * rendered in page content (for example, the chat shell) can affect sidebar layout.
 */
export function PageSidebarVisibilityProvider({
  children,
}: {
  children: ReactNode
}) {
  const [isChatPageSidebarCollapsed, setIsChatPageSidebarCollapsed] =
    useState(false)

  const value = useMemo<PageSidebarVisibilityContextValue>(
    () => ({
      isChatPageSidebarCollapsed,
      setIsChatPageSidebarCollapsed,
    }),
    [isChatPageSidebarCollapsed],
  )

  return (
    <PageSidebarVisibilityContext.Provider value={value}>
      {children}
    </PageSidebarVisibilityContext.Provider>
  )
}

/**
 * Hook for reading/updating page-sidebar visibility state.
 * Must be used under DashboardLayout (which mounts the provider).
 */
export function usePageSidebarVisibility() {
  const context = useContext(PageSidebarVisibilityContext)
  if (!context) {
    throw new Error(
      'usePageSidebarVisibility must be used within PageSidebarVisibilityProvider',
    )
  }
  return context
}
