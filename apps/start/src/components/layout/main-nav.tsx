import { useLocation } from '@tanstack/react-router'
import type {
  ComponentType,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
} from 'react'
import {
  createContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { cn } from '@rift/utils'
import { directionClass, useDirection } from '@rift/ui/direction'
import { useMediaQuery } from '@rift/ui/hooks/useMediaQuery'

import { AppRightSidebar } from '@/components/layout/app-right-sidebar'
import { useRightSidebar } from '@/components/layout/right-sidebar-context'

type SideNavContextValue = {
  isOpen: boolean
  setIsOpen: Dispatch<SetStateAction<boolean>>
}

export const SideNavContext = createContext<SideNavContextValue>({
  isOpen: false,
  setIsOpen: () => {},
})

type MainNavProps = PropsWithChildren<{
  sidebar: ComponentType
}>

export function MainNav({ children, sidebar: Sidebar }: MainNavProps) {
  const { pathname } = useLocation()
  const { isMobile } = useMediaQuery()
  const direction = useDirection()
  const [isOpen, setIsOpen] = useState(false)
  const { content: rightSidebarContent } = useRightSidebar()

  const contextValue = useMemo<SideNavContextValue>(
    () => ({ isOpen, setIsOpen }),
    [isOpen],
  )

  useEffect(() => {
    document.body.style.overflow = isOpen && isMobile ? 'hidden' : 'auto'
  }, [isOpen, isMobile])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const showRightSidebar = rightSidebarContent != null
  return (
    <div className="min-h-screen md:grid md:grid-cols-[min-content_minmax(0,1fr)_min-content]">
      <div
        className={cn(
          'fixed z-50 w-screen transition-[background-color,backdrop-filter] md:sticky md:z-auto md:w-full md:bg-transparent',
          directionClass(direction, { ltr: 'left-0', rtl: 'right-0' }),
          isOpen
            ? 'bg-surface-inverse/20 backdrop-blur-sm'
            : 'bg-transparent max-md:pointer-events-none',
          'top-0 h-dvh',
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            e.stopPropagation()
            setIsOpen(false)
          }
        }}
      >
        <div
          className={cn(
            'relative h-full w-min max-w-full bg-surface-base transition-transform md:translate-x-0',
            !isOpen &&
              directionClass(direction, {
                ltr: '-translate-x-full',
                rtl: 'translate-x-full',
              }),
          )}
        >
          <Sidebar />
        </div>
      </div>
      <div
        className={cn(
          'bg-surface-strong pb-[var(--page-bottom-margin)] pt-[var(--page-top-margin)] [--page-bottom-margin:0px] [--page-top-margin:0px] h-screen md:[--page-top-margin:0.5rem] min-w-0',
          directionClass(direction, {
            ltr: 'md:pr-2 md:pl-0',
            rtl: 'md:pl-2 md:pr-0',
          }),
        )}
      >
        <div className="relative h-full overflow-y-auto border-x border-t border-border-light pt-px md:rounded-t-xl md:bg-surface-base">
          <SideNavContext.Provider value={contextValue}>
            {children}
          </SideNavContext.Provider>
        </div>
      </div>
      <div
        className={cn(
          'sticky top-0 hidden h-dvh min-h-0 shrink-0 overflow-hidden bg-surface-strong pt-[var(--page-top-margin)] [--page-top-margin:0.5rem] lg:block',
          showRightSidebar &&
            directionClass(direction, {
              ltr: 'pl-0 pr-2',
              rtl: 'pl-2 pr-0',
            }),
          'transition-[width,padding] duration-220 motion-reduce:transition-none',
          showRightSidebar ? 'ease-out' : 'ease-in',
        )}
        style={{
          width: showRightSidebar ? 'var(--right-sidebar-width)' : '0px',
        }}
        aria-hidden={!showRightSidebar}
      >
        <AppRightSidebar isOpen={showRightSidebar}>
          {rightSidebarContent}
        </AppRightSidebar>
      </div>
    </div>
  )
}
