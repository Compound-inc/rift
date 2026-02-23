import { CHAT_AREA_KEY, chatNavArea, isChatPath } from '@/components/chat'
import {
  isOrgSettingsPath,
  orgSettingsNavArea,
  ORG_SETTINGS_AREA_KEY,
} from '@/routes/(app)/_layout/org-settings/-org-settings-nav'
import {
  isSettingsPath,
  settingsNavArea,
  SETTINGS_AREA_KEY,
} from '@/routes/(app)/_layout/settings/-settings-nav'
import {
  isWriterPath,
  writerNavArea,
  WRITER_AREA_KEY,
} from '@/routes/(app)/_layout/writer/-writer-nav'
import type { ComponentType, SVGProps } from 'react'

export type SidebarNavData = {
  pathname: string
}

export type NavItemType = {
  name: string
  href: string
  icon?: ComponentType<SVGProps<SVGSVGElement> & { 'data-hovered'?: boolean }>
  exact?: boolean
  isActive?: (pathname: string, href: string) => boolean
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
  [ORG_SETTINGS_AREA_KEY]: orgSettingsNavArea,
  [CHAT_AREA_KEY]: chatNavArea,
  [WRITER_AREA_KEY]: writerNavArea,
  [SETTINGS_AREA_KEY]: settingsNavArea,
}

export { SETTINGS_AREA_KEY }

/**
 * Resolve current area from pathname.
 */
export function getCurrentArea(pathname: string): string | null {
  if (isOrgSettingsPath(pathname)) return ORG_SETTINGS_AREA_KEY
  if (isWriterPath(pathname)) return WRITER_AREA_KEY
  if (isSettingsPath(pathname)) return SETTINGS_AREA_KEY
  if (isChatPath(pathname)) return CHAT_AREA_KEY
  return null
}
