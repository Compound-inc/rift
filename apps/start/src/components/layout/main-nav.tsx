import { useLocation } from '@tanstack/react-router'
import type { ComponentType, PropsWithChildren } from 'react'
import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { cn } from '@rift/utils'
import { useMediaQuery } from '@rift/ui/hooks/useMediaQuery'

type SideNavContextValue = {
  isOpen: boolean
  setIsOpen: Dispatch<SetStateAction<boolean>>
}

export const SideNavContext = createContext<SideNavContextValue>({
  isOpen: false,
  setIsOpen: () => {},
})

export function MainNav({
  children,
  sidebar: Sidebar,
}: PropsWithChildren<{ sidebar: ComponentType }>) {
  const { pathname } = useLocation()
  const { isMobile } = useMediaQuery()
  const [isOpen, setIsOpen] = useState(false)

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

  return (
    <div className="min-h-screen md:grid md:grid-cols-[min-content_minmax(0,1fr)]">
      <div
        className={cn(
          'fixed left-0 z-50 w-screen transition-[background-color,backdrop-filter] md:sticky md:z-auto md:w-full md:bg-transparent',
          isOpen
            ? 'bg-bg-inverted/20 backdrop-blur-sm'
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
            'relative h-full w-min max-w-full bg-bg-emphasis transition-transform md:translate-x-0',
            !isOpen && '-translate-x-full',
          )}
        >
          <Sidebar />
        </div>
      </div>
      <div className="bg-bg-emphasis pb-[var(--page-bottom-margin)] pt-[var(--page-top-margin)] [--page-bottom-margin:0px] [--page-top-margin:0px] h-screen md:pb-2 md:pr-2 md:[--page-bottom-margin:0.5rem] md:[--page-top-margin:0.5rem]">
        <div className="relative h-full overflow-y-auto bg-bg-subtle pt-px md:rounded-xl md:bg-bg-default">
          <SideNavContext.Provider value={contextValue}>
            {children}
          </SideNavContext.Provider>
        </div>
      </div>
    </div>
  )
}
