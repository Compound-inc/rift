import { directionClass, useDirection } from '@rift/ui/direction'
import { cn } from '@rift/utils'
import type { NavSection } from './app-sidebar-nav.config'
import { SidebarNavItem } from './sidebar-nav-item'

export type SidebarAreaLayoutProps = {
  title?: string
  sections: NavSection[]
  pathname: string
  /**
   * When set, the section with this name gets its items in a scrollable container
   * so only that list scrolls while the section title stays fixed. Use for long
   * lists (e.g. "Chat History"). The layout will use flex/min-h-0 so height is
   * constrained and the scrollable section can take remaining space.
   */
  scrollableSectionName?: string
}

/**
 * Shared layout for sidebar area content: title + sections (name + items).
 * Used by both config-driven areas and component-driven areas (e.g. chat with Zero threads).
 * When scrollableSectionName is set, that section's items are in a scrollable region
 * and the section title remains fixed.
 */
export function SidebarAreaLayout({
  title,
  sections,
  pathname,
  scrollableSectionName,
}: SidebarAreaLayoutProps) {
  const direction = useDirection()
  const useConstrainedLayout = scrollableSectionName != null

  const content = (
    <>
      {title ? (
        <div className="mb-2 flex shrink-0 items-center gap-3 px-3 py-2">
          <span className="text-lg font-semibold text-foreground-strong">
            {title}
          </span>
        </div>
      ) : null}
      <div
        className={
          useConstrainedLayout
            ? 'flex min-h-0 flex-1 flex-col gap-8'
            : 'flex flex-col gap-8'
        }
      >
        {sections.map((section, idx) => {
          const sectionKey = section.name ?? `section-${idx}`
          const isScrollableSection =
            scrollableSectionName != null && section.name === scrollableSectionName

          return (
            <div
              key={sectionKey}
              className={
                isScrollableSection
                  ? 'flex min-h-0 flex-1 flex-col'
                  : 'flex flex-col gap-0.5'
              }
            >
              {section.name ? (
                <div className="mb-2 shrink-0 pl-3 pr-3 text-sm text-foreground-secondary">
                  {section.name}
                </div>
              ) : null}
              {isScrollableSection ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div
                    className={cn(
                      'flex flex-col gap-0.5',
                      directionClass(direction, {
                        ltr: 'pr-3',
                        rtl: 'pl-3',
                      }),
                    )}
                  >
                    {section.items.map((item) => (
                      <div
                        key={item.href}
                        className="min-h-[2.25rem] [contain-intrinsic-size:0_2.25rem] [content-visibility:auto]"
                      >
                        <SidebarNavItem
                          item={item}
                          pathname={pathname}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={directionClass(direction, {
                    ltr: 'pr-3',
                    rtl: 'pl-3',
                  })}
                >
                  {section.items.map((item) => (
                    <SidebarNavItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )

  if (useConstrainedLayout) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {content}
      </div>
    )
  }

  return <>{content}</>
}
