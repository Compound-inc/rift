import { Dialog, DialogContent, DialogTitle } from '@rift/ui/dialog'
import { useDesktopRightSidebar } from './right-sidebar-media'
import { m } from '@/paraglide/messages.js'
import { useLocation } from '@tanstack/react-router'
import type {
  ComponentType,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
} from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { cn } from '@rift/utils'
import { directionClass, useDirection } from '@rift/ui/direction'
import { useMediaQuery } from '@rift/ui/hooks/useMediaQuery'

import { AppRightSidebar } from '@/components/layout/app-right-sidebar'
import { useRightSidebar } from '@/components/layout/right-sidebar-context'

type SideNavContextValue = {
  isOpen: boolean
  setIsOpen: Dispatch<SetStateAction<boolean>>
}

export const SideNavContext = createContext<SideNavContextValue | null>(null)

export function useSideNav() {
  const context = useContext(SideNavContext)
  if (!context) {
    throw new Error('useSideNav must be used within MainNav')
  }
  return context
}

type MainNavProps = PropsWithChildren<{
  sidebar: ComponentType
}>

export function MainNav({ children, sidebar: Sidebar }: MainNavProps) {
  const { pathname } = useLocation()
  const { isMobile } = useMediaQuery()
  const direction = useDirection()
  const [isOpen, setIsOpen] = useState(false)
  const { content: rightSidebarContent, close: closeRightSidebar } = useRightSidebar()
  const desktopRightSidebar = useDesktopRightSidebar()

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
          'bg-surface-base md:bg-surface-strong [--page-bottom-margin:0px] [--page-top-margin:0px] min-w-0 h-dvh md:h-screen pb-0 pt-0 md:pb-[var(--page-bottom-margin)] md:pt-[var(--page-top-margin)] md:[--page-top-margin:0.5rem]',
          directionClass(direction, {
            ltr: 'md:pr-2 md:pl-0',
            rtl: 'md:pl-2 md:pr-0',
          }),
        )}
      >
        <div className="relative h-full overflow-y-auto bg-surface-base md:border-x md:border-t md:border-border-light md:pt-px md:rounded-t-xl">
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
          {desktopRightSidebar ? rightSidebarContent : null}
        </AppRightSidebar>
      </div>
      {!desktopRightSidebar && (
        <Dialog open={showRightSidebar} onOpenChange={(next) => {
          if (!next) closeRightSidebar()
        }}>
        <DialogContent showCloseButton={false} className="inset-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-0 p-3 sm:max-w-none motion-reduce:animate-none">
          <DialogTitle className="sr-only">{m.layout_right_sidebar_aria_label()}</DialogTitle>
          {rightSidebarContent}
        </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
