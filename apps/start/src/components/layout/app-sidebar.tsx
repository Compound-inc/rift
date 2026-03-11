import { ThemeToggle } from '@rift/ui/theme-toggle'
import {
  getCurrentArea,
  NAV_AREAS,
  SETTINGS_AREA_KEY,
} from '@/components/layout/sidebar/app-sidebar-nav.config'
import { SidebarAreaPanel } from '@/components/layout/sidebar/sidebar-area-panel'
import {
  ORG_SETTINGS_AREA_KEY,
  ORG_SETTINGS_HREF,
} from '@/routes/(app)/_layout/organization/settings/-organization-settings-nav'
import { UserProfileAvatar } from '@/components/layout/user-profile-avatar'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import { directionClass, useDirection } from '@rift/ui/direction'
import { SidebarGroupTooltip } from '@rift/ui/tooltip'
import { cn } from '@rift/utils'
import { useActiveOrganization } from '@/lib/auth/active-organization'
import { useAppAuth } from '@/lib/auth/use-auth'
import { Link, useRouterState } from '@tanstack/react-router'
import type { ComponentType } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { m } from '@/paraglide/messages.js'
import { SidebarChatThreadPreloader } from './sidebar/sidebar-chat-thread-preloader'
import { SidebarUsageMeter } from './sidebar/sidebar-usage-meter'

const SIDEBAR_GROUPS_WIDTH = 64
const SIDEBAR_AREAS_WIDTH = 240
const SIDEBAR_WIDTH = SIDEBAR_GROUPS_WIDTH + SIDEBAR_AREAS_WIDTH

export const AppSidebar: ComponentType = () => {
  const resolvedPathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname,
  })
  const initialPathname = useRouterState({
    select: (state) => state.location?.pathname ?? '/',
  })
  const lastResolvedPathnameRef = useRef(initialPathname)

  useEffect(() => {
    if (resolvedPathname) {
      lastResolvedPathnameRef.current = resolvedPathname
    }
  }, [resolvedPathname])
  const pathname = resolvedPathname ?? lastResolvedPathnameRef.current ?? initialPathname
  const { user, loading, isAnonymous } = useAppAuth()
  const { activeOrganization, loading: activeOrganizationLoading } = useActiveOrganization()
  const direction = useDirection()
  const currentArea = getCurrentArea(pathname)
  const showAreaPanel = currentArea !== null
  const showOrganizationFallback = !activeOrganizationLoading && !activeOrganization?.logo && !!activeOrganization

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
    // Sidebar Page BG
    <div
      className="h-full w-[var(--sidebar-width)] grid grid-cols-[var(--sidebar-groups-width)_1fr] bg-surface-strong transition-[width] duration-300"
      style={sidebarStyle}
    >
      <SidebarChatThreadPreloader />
      <nav className="flex size-full flex-col items-center justify-between p-2">
        <div className="flex flex-col items-center gap-3">
            <div className="pb-1 pt-2" />
            <SidebarGroupTooltip
              name={activeOrganization?.name ?? m.layout_organization_tooltip_name()}
              description={m.layout_organization_tooltip_description()}
            >
              <Button
                asChild
                variant="sidebarIcon"
                size="iconSidebar"
                data-active={currentArea === ORG_SETTINGS_AREA_KEY}
              >
                <Link
                to={isAnonymous ? '/auth/sign-up' : ORG_SETTINGS_HREF}
                preload="intent"
                aria-label={m.layout_organization_settings_aria_label()}
              >
                  <Avatar size="xs">
                    {activeOrganization?.logo ? (
                      <AvatarImage
                        src={activeOrganization.logo}
                        alt={activeOrganization.name ?? m.layout_organization_tooltip_name()}
                      />
                    ) : null}
                    {showOrganizationFallback ? (
                      <AvatarFallback name={activeOrganization.name} />
                    ) : null}
                  </Avatar>
                </Link>
              </Button>
            </SidebarGroupTooltip>
            {Object.entries(NAV_AREAS)
              .filter(
                ([key]) =>
                  key !== SETTINGS_AREA_KEY && key !== ORG_SETTINGS_AREA_KEY,
              )
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
                      <Link
                        to={config.href}
                        preload="intent"
                        aria-label={config.title}
                      >
                        <Icon className="size-5 text-foreground-primary" />
                      </Link>
                    </Button>
                  </SidebarGroupTooltip>
                )
              })}
        </div>
        <div className="flex flex-col items-center gap-3">
          <SidebarUsageMeter />
          <ThemeToggle />
          <UserProfileAvatar
            user={user ?? undefined}
            isLoading={loading}
            settingsHref={isAnonymous ? '/auth/sign-up' : undefined}
          />
        </div>
      </nav>
      <div
        className={cn(
          `size-full overflow-hidden pt-2 transition-opacity duration-300 ${showAreaPanel ? '' : 'pointer-events-none opacity-0'}`,
          directionClass(direction, {
            ltr: 'pr-2',
            rtl: 'pl-2',
          }),
        )}
      >
        <div className="scrollbar-hide relative flex h-full min-h-0 w-[calc(var(--sidebar-areas-width)-0.5rem)] flex-col overflow-y-auto overflow-x-hidden rounded-t-xl border-x border-t border-border-light bg-surface-overlay">
            <div
              className={cn(
                'relative flex min-h-0 flex-1 flex-col overflow-hidden pt-3 pb-3 text-foreground-secondary',
                directionClass(direction, {
                  ltr: 'pl-3 pr-0',
                  rtl: 'pr-3 pl-0',
                }),
              )}
            >
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
