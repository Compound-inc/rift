import { ThemeToggle } from '@rift/ui/theme-toggle'
import {
  CHAT_AREA_KEY,
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
import { useActiveOrganization } from '@/lib/frontend/auth/active-organization'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { Link, useRouterState } from '@tanstack/react-router'
import type { ComponentType } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from '@/paraglide/messages.js'
import { SidebarChatThreadPreloader } from './sidebar/sidebar-chat-thread-preloader'
import { SidebarUsageMeter } from './sidebar/sidebar-usage-meter'
import { usePageSidebarVisibility } from './page-sidebar-visibility-context'

const SIDEBAR_GROUPS_WIDTH = 64
const SIDEBAR_AREAS_WIDTH = 240
const SIDEBAR_WIDTH = SIDEBAR_GROUPS_WIDTH + SIDEBAR_AREAS_WIDTH
const SIDEBAR_CONTENT_GAP = 8
let lastKnownAppSidebarArea: string | null = null

export const AppSidebar: ComponentType = () => {
  const resolvedPathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname,
  })
  const initialPathname = useRouterState({
    select: (state) => state.location?.pathname ?? '/',
  })
  const lastResolvedPathnameRef = useRef(initialPathname)
  const [isTransitionReady, setIsTransitionReady] = useState(false)

  useEffect(() => {
    if (resolvedPathname) {
      lastResolvedPathnameRef.current = resolvedPathname
    }
  }, [resolvedPathname])
  const pathname =
    resolvedPathname ?? lastResolvedPathnameRef.current ?? initialPathname
  const currentArea = getCurrentArea(pathname)
  const stableAreaRef = useRef<string | null>(
    getCurrentArea(initialPathname) ?? lastKnownAppSidebarArea,
  )
  if (currentArea != null) {
    stableAreaRef.current = currentArea
  }
  const effectiveCurrentArea = currentArea ?? stableAreaRef.current

  useEffect(() => {
    if (effectiveCurrentArea != null) {
      lastKnownAppSidebarArea = effectiveCurrentArea
    }
  }, [effectiveCurrentArea])

  useEffect(() => {
    if (isTransitionReady || effectiveCurrentArea == null) {
      return
    }

    /**
     * During auth <-> app transitions, router state can briefly point at a
     * non-app pathname before settling on the target app area (e.g. `/chat`).
     * If transitions are enabled during that intermediate state, the sidebar
     * animates from collapsed/fallback into expanded. We only enable transitions
     * after an actual sidebar area is resolved and one paint has occurred.
     */
    const frame = requestAnimationFrame(() => {
      setIsTransitionReady(true)
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [effectiveCurrentArea, isTransitionReady])
  const { user, loading, isAnonymous } = useAppAuth()
  const { activeOrganization, loading: activeOrganizationLoading } =
    useActiveOrganization()
  const { isChatPageSidebarCollapsed } = usePageSidebarVisibility()
  const direction = useDirection()
  // Keep non-chat areas unchanged. For chat routes, allow collapsing just the
  // area panel while keeping the primary icon rail visible.
  const showAreaPanel =
    effectiveCurrentArea !== null &&
    (effectiveCurrentArea !== CHAT_AREA_KEY || !isChatPageSidebarCollapsed)
  const showOrganizationFallback =
    !activeOrganizationLoading &&
    !activeOrganization?.logo &&
    !!activeOrganization

  /**
   * Keep a persistent gutter between the sidebar chrome and the main content.
   * The gutter is included in the container width so collapsing the area panel
   * does not shrink the icon rail itself.
   */
  const sidebarWidth =
    (showAreaPanel ? SIDEBAR_WIDTH : SIDEBAR_GROUPS_WIDTH) + SIDEBAR_CONTENT_GAP
  const sidebarStyle = useMemo(
    () =>
      ({
        '--sidebar-width': `${sidebarWidth}px`,
        '--sidebar-groups-width': `${SIDEBAR_GROUPS_WIDTH}px`,
        '--sidebar-areas-width': `${SIDEBAR_AREAS_WIDTH}px`,
        '--sidebar-content-gap': `${SIDEBAR_CONTENT_GAP}px`,
      }) as React.CSSProperties,
    [sidebarWidth],
  )

  return (
    // Sidebar Page BG
    <div
      className={cn(
        'h-full w-[var(--sidebar-width)] grid grid-cols-[var(--sidebar-groups-width)_1fr] bg-surface-strong',
        isTransitionReady
          ? 'transition-[width] duration-300'
          : 'transition-none',
      )}
      style={sidebarStyle}
    >
      <SidebarChatThreadPreloader />
      {/* Single chrome wrapper so the right-side border and top-right cutout stay
          attached to whichever sidebar surface is currently visible. */}
      <div
        className={cn(
          'relative mt-2 col-span-2 grid h-[calc(100%-0.5rem)] grid-cols-[var(--sidebar-groups-width)_1fr] overflow-hidden rounded-tr-xl border border-l-0 border-border-base bg-surface-overlay',
          directionClass(direction, {
            ltr: 'mr-2',
            rtl: 'ml-2',
          }),
        )}
      >
        <nav
          className={cn(
            'relative z-10 mr-0.5 flex h-full flex-col items-center justify-between p-2',
            isTransitionReady
              ? 'transition-[box-shadow] duration-300'
              : 'transition-none',
            showAreaPanel
              ? 'shadow-[0_18px_36px_-12px_rgba(0,0,0,0.42)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.82)]'
              : 'shadow-none dark:shadow-none',
          )}
        >
          <div className="flex flex-col items-center gap-3 pt-1">
            <SidebarGroupTooltip
              name={
                activeOrganization?.name ?? m.layout_organization_tooltip_name()
              }
              description={m.layout_organization_tooltip_description()}
            >
              <Button
                asChild
                variant="sidebarIcon"
                size="iconSidebar"
                data-active={effectiveCurrentArea === ORG_SETTINGS_AREA_KEY}
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
                        alt={
                          activeOrganization.name ??
                          m.layout_organization_tooltip_name()
                        }
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
                      data-active={effectiveCurrentArea === areaKey}
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
            'size-full overflow-hidden',
            isTransitionReady ? 'transition-opacity duration-300' : 'transition-none',
            showAreaPanel ? '' : 'pointer-events-none opacity-0',
            directionClass(direction, {
              ltr: 'pl-0 pr-2',
              rtl: 'pr-0 pl-2',
            }),
          )}
        >
          <div className="scrollbar-hide relative z-0 flex h-full min-h-0 w-[calc(var(--sidebar-areas-width)-0.5rem)] flex-col overflow-y-auto overflow-x-hidden">
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
                currentArea={effectiveCurrentArea}
                data={{ pathname }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
