import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { cn } from '@rift/utils'
import { Button } from '@rift/ui/button'
import { isPathActive } from '@/utils/nav-utils'
import type { NavItemType } from './app-sidebar-nav.config'

export function SidebarNavItem({
  item,
  pathname,
}: {
  item: NavItemType
  pathname: string
}) {
  const [hovered, setHovered] = useState(false)
  const { name, href, icon: Icon, exact, isActive: customIsActive } = item

  const isActive = useMemo(
    () =>
      customIsActive
        ? customIsActive(pathname, href)
        : isPathActive(pathname, href, exact),
    [pathname, href, exact, customIsActive],
  )

  return (
    <Button
      asChild
      variant="sidebarNavItem"
      size="sidebarNavItem"
    >
      <Link
        to={href}
        data-active={isActive}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        className="group"
      >
        <span className="flex items-center gap-2.5">
          {Icon ? (
            <Icon
              className={cn('size-4', isActive ? 'text-content-info' : '')}
              data-hovered={hovered}
            />
          ) : null}
          {name}
        </span>
      </Link>
    </Button>
  )
}
