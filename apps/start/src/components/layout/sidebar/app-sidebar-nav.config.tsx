import { CHAT_AREA_KEY, chatNavArea, isChatPath } from '@/components/chat'
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
  icon: ComponentType<SVGProps<SVGSVGElement> & { 'data-hovered'?: boolean }>
  exact?: boolean
  isActive?: (pathname: string, href: string) => boolean
}

export type NavSection = {
  name?: string
  items: NavItemType[]
}

export type SidebarNavAreaConfig = {
  title?: string
  /** Static sections; ignored when ContentComponent is set. */
  content: NavSection[]
  href: string
  description?: string
  learnMoreHref?: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** When set, this component is rendered instead of content (for dynamic areas e.g. chat threads). */
  ContentComponent?: ComponentType<{ pathname: string }>
}

export type SidebarNavAreas = Record<
  string,
  (data: SidebarNavData) => SidebarNavAreaConfig
>

export const NAV_AREAS: SidebarNavAreas = {
  [CHAT_AREA_KEY]: chatNavArea,
  [WRITER_AREA_KEY]: writerNavArea,
  [SETTINGS_AREA_KEY]: settingsNavArea,
}

export { SETTINGS_AREA_KEY }

/**
 * Resolve current area from pathname.
 */
export function getCurrentArea(pathname: string): string | null {
  if (isWriterPath(pathname)) return WRITER_AREA_KEY
  if (isSettingsPath(pathname)) return SETTINGS_AREA_KEY
  if (isChatPath(pathname)) return CHAT_AREA_KEY
  return null
}
