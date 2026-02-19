import { ThemeToggle } from '@rift/ui/theme-toggle'
import {
  getCurrentArea,
  NAV_AREAS,
} from '@/components/layout/sidebar/app-sidebar-nav.config'
import { SidebarAreaPanel } from '@/components/layout/sidebar/sidebar-area-panel'
import { SETTINGS_AREA_KEY } from '@/components/layout/sidebar/app-sidebar-nav.config'
import { UserProfileAvatar } from '@/components/layout/user-profile-avatar'
import { Avatar, AvatarFallback } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import { SidebarGroupTooltip, TooltipProvider } from '@rift/ui/tooltip'
import { useAuth } from '@workos/authkit-tanstack-react-start/client'
import { Link, useLocation } from '@tanstack/react-router'
import type { ComponentType } from 'react'
import { useMemo } from 'react'

const SIDEBAR_GROUPS_WIDTH = 64
const SIDEBAR_AREAS_WIDTH = 240
const SIDEBAR_WIDTH = SIDEBAR_GROUPS_WIDTH + SIDEBAR_AREAS_WIDTH

export const AppSidebar: ComponentType = () => {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const currentArea = getCurrentArea(pathname)
  const showAreaPanel = currentArea !== null

  const sidebarWidth =
    showAreaPanel ? SIDEBAR_WIDTH : SIDEBAR_GROUPS_WIDTH
  const sidebarStyle = useMemo(
    () =>
      ({
        '--sidebar-width': `${sidebarWidth}px`,
        '--sidebar-groups-width': `${SIDEBAR_GROUPS_WIDTH}px`,
        '--sidebar-areas-width': `${SIDEBAR_AREAS_WIDTH}px`,
      }) as React.CSSProperties,
    [sidebarWidth],
  )

  return (
    <div
      className="h-full w-[var(--sidebar-width)] grid grid-cols-[var(--sidebar-groups-width)_1fr] bg-bg-emphasis transition-[width] duration-300"
      style={sidebarStyle}
    >
      <nav className="flex size-full flex-col items-center justify-between p-2">
        <TooltipProvider delay={100}>
          <div className="flex flex-col items-center gap-3">
            <div className="pb-1 pt-2" />
            <Button variant="sidebarIcon" size="iconSidebar" aria-label="Workspace">
              <Avatar size="xs">
                <AvatarFallback />
              </Avatar>
            </Button>
            {Object.entries(NAV_AREAS)
              .filter(([key]) => key !== SETTINGS_AREA_KEY)
              .map(([areaKey, areaFn]) => {
                const config = areaFn({ pathname })
                const Icon = config.icon
                return (
                  <SidebarGroupTooltip
                    key={areaKey}
                    name={config.title ?? areaKey}
                    description={config.description}
                    learnMoreHref={config.learnMoreHref}
                  >
                    <Button
                      asChild
                      variant="sidebarIcon"
                      size="iconSidebar"
                      data-active={currentArea === areaKey}
                    >
                      <Link to={config.href} aria-label={config.title}>
                        <Icon className="size-5 text-content-default" />
                      </Link>
                    </Button>
                  </SidebarGroupTooltip>
                )
              })}
          </div>
        </TooltipProvider>
        <div className="flex flex-col items-center gap-3">
          <ThemeToggle />
          <UserProfileAvatar user={user ?? undefined} />
        </div>
      </nav>
      <div
        className={`size-full overflow-hidden py-2 pr-2 transition-opacity duration-300 ${showAreaPanel ? '' : 'pointer-events-none opacity-0'}`}
      >
        <div className="scrollbar-hide relative flex h-full w-[calc(var(--sidebar-areas-width)-0.5rem)] flex-col overflow-y-auto overflow-x-hidden rounded-xl bg-bg-subtle">
          <div className="relative flex grow flex-col p-3 text-content-muted">
            <SidebarAreaPanel
              areas={NAV_AREAS}
              currentArea={currentArea}
              data={{ pathname }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
