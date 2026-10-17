'use client'

import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation } from '@tanstack/react-router'

export type RightSidebarContextValue = {
  /** Content currently shown in the right sidebar; null when closed. */
  content: ReactNode | null
  /** Open the right sidebar with the given content. Caller owns title, close button, etc. */
  open: (content: ReactNode) => void
  /** Close the right sidebar. */
  close: () => void
  /** A panel can block navigation to another sidebar view while it has unsaved edits. */
  registerCloseGuard: (guard: () => boolean) => () => void
}

const RightSidebarContext = createContext<RightSidebarContextValue | null>(null)

export function useRightSidebar(): RightSidebarContextValue {
  const ctx = useContext(RightSidebarContext)
  if (!ctx) {
    return {
      content: null,
      open: () => {},
      close: () => {},
      registerCloseGuard: () => () => {},
    }
  }
  return ctx
}

type RightSidebarProviderProps = {
  children: ReactNode
}

export function RightSidebarProvider({ children }: RightSidebarProviderProps) {
  const { pathname } = useLocation()
  const [content, setContent] = useState<ReactNode | null>(null)

  const closeGuard = useRef<(() => boolean) | null>(null)
  const registerCloseGuard = useCallback((guard: () => boolean) => {
    closeGuard.current = guard
    return () => {
      if (closeGuard.current === guard) closeGuard.current = null
    }
  }, [])

  const open = useCallback((node: ReactNode) => {
    if (closeGuard.current?.() === false) return
    setContent(node)
  }, [])

  const close = useCallback(() => {
    if (closeGuard.current?.() === false) return
    setContent(null)
  }, [])

  /** Clear sidebar on navigation so content from the previous page (e.g. old thread reasoning) is not shown. */
  useEffect(() => {
    setContent(null)
  }, [pathname])

  const value = useMemo<RightSidebarContextValue>(
    () => ({ content, open, close, registerCloseGuard }),
    [content, open, close, registerCloseGuard],
  )

  return (
    <RightSidebarContext.Provider value={value}>
      {children}
    </RightSidebarContext.Provider>
  )
}
