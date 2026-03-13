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
  contextMenuResetToken = 0,
}: {
  item: NavItemType
  pathname: string
  contextMenuResetToken?: number
}) {
  const [hovered, setHovered] = useState(false)
  const {
    name,
    href,
    icon: Icon,
    exact,
    isActive: customIsActive,
    onSelect,
    trailing,
    contextMenuContent,
    label: customLabel,
    disableLink,
  } = item

  const isActionItem = typeof onSelect === 'function'
  const isActive = useMemo(
    () =>
      isActionItem || !href
        ? false
        : customIsActive
        ? customIsActive(pathname, href)
        : isPathActive(pathname, href, exact),
    [pathname, href, exact, customIsActive, isActionItem],
  )

  const labelContent = customLabel ?? (
    <span className="min-w-0 flex-1 truncate">{name}</span>
  )
  const rowContent = (
    <span className="flex w-full items-center gap-2">
      {Icon ? (
        <Icon
          className={cn('size-4', isActive ? 'text-foreground-info' : '')}
          data-hovered={hovered}
        />
      ) : null}
      {labelContent}
      {trailing}
    </span>
  )

  const linkContent = disableLink ? (
    <div
      className={cn(
        buttonVariants({ variant: 'sidebarNavItem', size: 'sidebarNavItem' }),
        'group bg-surface-inverse/5',
      )}
      role="presentation"
    >
      <span
        className="flex w-full items-center gap-2"
        data-active={isActive}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {rowContent}
      </span>
    </div>
  ) : isActionItem ? (
    <Button asChild variant="sidebarNavItem" size="sidebarNavItem">
      <a
        href={href ?? '#'}
        data-active={isActive}
        onClick={(event) => {
          event.preventDefault()
          onSelect?.()
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        className="group"
      >
        {rowContent}
      </a>
    </Button>
  ) : (
    <Button asChild variant="sidebarNavItem" size="sidebarNavItem">
      <Link
        to={href}
        /**
         * Warm route code/data when intent is detected (hover/focus/touch),
         * reducing commit latency for frequent sidebar hops.
         */
        preload="intent"
        data-active={isActive}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        className="group"
      >
        {rowContent}
      </Link>
    </Button>
  )

  if (!contextMenuContent) {
    return linkContent
  }

  return (
    <ContextMenu key={contextMenuResetToken}>
      <ContextMenuTrigger className="block w-full">
        {linkContent}
      </ContextMenuTrigger>
      <ContextMenuContent>{contextMenuContent}</ContextMenuContent>
    </ContextMenu>
  )
}
