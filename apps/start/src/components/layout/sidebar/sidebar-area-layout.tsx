import type { NavItemType, NavSection } from './app-sidebar-nav.config'
import { SidebarNavItem } from './sidebar-nav-item'

export type SidebarAreaLayoutProps = {
  title?: string
  sections: NavSection[]
  pathname: string
}

/**
 * Shared layout for sidebar area content: title + sections (name + items).
 * Used by both config-driven areas and component-driven areas (e.g. chat with Zero threads).
 */
export function SidebarAreaLayout({
  title,
  sections,
  pathname,
}: SidebarAreaLayoutProps) {
  return (
    <>
      {title ? (
        <div className="mb-2 flex items-center gap-3 px-3 py-2">
          <span className="text-lg font-semibold text-content-emphasis">
            {title}
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-8">
        {sections.map((section, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {section.name ? (
              <div className="mb-2 pl-3 text-sm text-content-muted">
                {section.name}
              </div>
            ) : null}
            {section.items.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
