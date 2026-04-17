import { CHAT_AREA_KEY, chatNavArea, isChatPath } from '@/components/chat'
import {
  isOrgSettingsPath,
  orgSettingsNavArea,
  ORG_SETTINGS_AREA_KEY,
} from '@/routes/(app)/_layout/organization/settings/-organization-settings-nav'
import {
  isSingularityPath,
  singularityNavArea,
  SINGULARITY_AREA_KEY,
} from '@/ee/singularity/components/singularity-nav.config'
import {
  isSettingsPath,
  settingsNavArea,
  SETTINGS_AREA_KEY,
} from '@/routes/(app)/_layout/settings/-settings-nav'
import {
  isWritingPath,
  writingNavArea,
  WRITING_AREA_KEY,
} from '@/routes/(app)/_layout/writing/-writing-nav'
import type { ComponentType, SVGProps } from 'react'

export type SidebarNavData = {
  pathname: string
}

export type NavItemType = {
  name: string
  /** Route target for link items. Optional for action-only items that use onSelect. */
  href?: string
  icon?: ComponentType<SVGProps<SVGSVGElement> & { 'data-hovered'?: boolean }>
  exact?: boolean
  isActive?: (pathname: string, href: string) => boolean
  /** Click handler for action-only items rendered with sidebar nav styling. */
  onSelect?: () => void
  /** Optional trailing element (e.g. status indicator) shown after the label */
  trailing?: React.ReactNode
  /** Optional context-menu content shown on right-click for this nav item. */
  contextMenuContent?: React.ReactNode
  /** When set, rendered instead of name (e.g. inline edit input). Implies no navigation. */
  label?: React.ReactNode
  /** When true, item is not a link (e.g. while editing). */
  disableLink?: boolean
}

export type NavSection = {
  name?: string
  items: NavItemType[]
}

export type SidebarNavAreaConfig = {
  title?: string
  /** Static sections; required when no ContentComponent. Optional when ContentComponent is set (panel ignores it). */
  content?: NavSection[]
  href: string
  description?: string
  learnMoreHref?: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  ContentComponent?: ComponentType<{ pathname: string }>
}

export type SidebarNavAreas = Record<
  string,
  (data: SidebarNavData) => SidebarNavAreaConfig
>

export const NAV_AREAS: SidebarNavAreas = {
  [SINGULARITY_AREA_KEY]: singularityNavArea,
  [ORG_SETTINGS_AREA_KEY]: orgSettingsNavArea,
  [WRITING_AREA_KEY]: writingNavArea,
  [CHAT_AREA_KEY]: chatNavArea,
  [SETTINGS_AREA_KEY]: settingsNavArea,
}

export { CHAT_AREA_KEY }
export { SETTINGS_AREA_KEY }
export { SINGULARITY_AREA_KEY }
export { WRITING_AREA_KEY }

/**
 * Resolve current area from pathname.
 */
export function getCurrentArea(pathname: string): string | null {
  if (isSingularityPath(pathname)) return SINGULARITY_AREA_KEY
  if (isOrgSettingsPath(pathname)) return ORG_SETTINGS_AREA_KEY
  if (isWritingPath(pathname)) return WRITING_AREA_KEY
  if (isSettingsPath(pathname)) return SETTINGS_AREA_KEY
  if (isChatPath(pathname)) return CHAT_AREA_KEY
  return null
}
