import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { cn } from '@rift/utils'
import { Button, buttonVariants } from '@rift/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@rift/ui/context-menu'
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
  const {
    name,
    href,
    icon: Icon,
    exact,
    isActive: customIsActive,
    trailing,
    contextMenuContent,
    label: customLabel,
    disableLink,
  } = item

  const isActive = useMemo(
    () =>
      customIsActive
        ? customIsActive(pathname, href)
        : isPathActive(pathname, href, exact),
    [pathname, href, exact, customIsActive],
  )

  const labelContent = customLabel ?? (
    <span className="min-w-0 flex-1 truncate">{name}</span>
  )

  const linkContent = disableLink ? (
    <div
      className={cn(
        buttonVariants({ variant: 'sidebarNavItem', size: 'sidebarNavItem' }),
        'group bg-bg-inverted/5',
      )}
      role="presentation"
    >
      <span
        className="flex w-full items-center gap-2.5"
        data-active={isActive}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {Icon ? (
          <Icon
            className={cn('size-4', isActive ? 'text-content-info' : '')}
            data-hovered={hovered}
          />
        ) : null}
        {labelContent}
        {trailing}
      </span>
    </div>
  ) : (
    <Button asChild variant="sidebarNavItem" size="sidebarNavItem">
      <Link
        to={href}
        data-active={isActive}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        className="group"
      >
        <span className="flex w-full items-center gap-2.5">
          {Icon ? (
            <Icon
              className={cn('size-4', isActive ? 'text-content-info' : '')}
              data-hovered={hovered}
            />
          ) : null}
          {labelContent}
          {trailing}
        </span>
      </Link>
    </Button>
  )

  if (!contextMenuContent) {
    return linkContent
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block w-full">
        {linkContent}
      </ContextMenuTrigger>
      <ContextMenuContent>{contextMenuContent}</ContextMenuContent>
    </ContextMenu>
  )
}
