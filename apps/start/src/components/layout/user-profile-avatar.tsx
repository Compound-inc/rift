'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import { Link } from '@tanstack/react-router'
import { SETTINGS_HREF } from '@/routes/(app)/_layout/settings/-settings-nav'
import { m } from '@/paraglide/messages.js'

export type UserProfileAvatarUser = {
  image?: string | null
  name?: string | null
  email?: string | null
}

function getInitials(user: UserProfileAvatarUser): string {
  const normalizedName = user.name?.trim() ?? ''
  if (normalizedName.length > 0) {
    const parts = normalizedName.split(/\s+/).filter(Boolean)
    const first = parts[0]?.slice(0, 1) ?? ''
    const last = (parts.length > 1 ? parts[parts.length - 1] : '')?.slice(0, 1) ?? ''
    return (first + last).toUpperCase() || '?'
  }
  const email = user.email ?? ''
  const part = email.split('@')[0]
  return part.slice(0, 2).toUpperCase() || '?'
}

export type UserProfileAvatarProps = {
  user?: UserProfileAvatarUser | null
  isLoading?: boolean
  settingsHref?: string
  size?: 'default' | 'sm' | 'lg' | 'xs'
}

export function UserProfileAvatar({
  user,
  isLoading = false,
  settingsHref = SETTINGS_HREF,
  size = 'xs',
}: UserProfileAvatarProps) {
  const initials = user ? getInitials(user) : '?'
  const showFallback = !isLoading && !user?.image

  return (
    <Button
      asChild
      variant="sidebarIcon"
      size="iconSidebar"
      aria-label={m.layout_open_settings_aria_label()}
    >
      <Link to={settingsHref}>
        <Avatar size={size}>
          {user?.image ? (
            <AvatarImage
              src={user.image}
              alt=""
            />
          ) : null}
          {showFallback ? <AvatarFallback>{initials}</AvatarFallback> : null}
        </Avatar>
      </Link>
    </Button>
  )
}
